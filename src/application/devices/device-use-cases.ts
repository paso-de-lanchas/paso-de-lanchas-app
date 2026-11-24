import { z } from "zod";

import {
  canApproveDevice,
  canRevokeDevice,
  DEVICE_NAME_MAX_LENGTH,
  DEVICE_STATUSES,
  type DeviceStatus,
  isValidDeviceDock,
} from "@/domain/auth/authorized-device";
import { DomainError } from "@/domain/shared/domain-error";

import { InputError, parseInput } from "../shared/input-error";
import type { Clock } from "../shared/ports";
import type { DockOption } from "../staff/ports";
import type { DeviceAdminRepository, DeviceView } from "./ports";

/**
 * Aprobar, renombrar y revocar las computadoras del muelle (RF-120, RF-121). Solo las usa el
 * superadministrador (lo verifica `assertRole("SUPERADMIN")` antes de llamarlas). Cada cambio
 * va con su evento de bitácora, que el repositorio guarda en la misma transacción.
 */

export interface DeviceDeps {
  devices: DeviceAdminRepository;
  clock: Clock;
}

export interface DeviceActor {
  id: string;
}

const nameSchema = z
  .string()
  .trim()
  .min(3, "Escribe un nombre para reconocerla, por ejemplo «Taquilla COA 1».")
  .max(
    DEVICE_NAME_MAX_LENGTH,
    `El nombre puede tener como máximo ${DEVICE_NAME_MAX_LENGTH} caracteres.`,
  );

export const approveDeviceSchema = z.object({
  name: nameSchema,
  // Vacío = computadora de oficina (sin muelle).
  dockId: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || null)
    .pipe(z.uuid("Elige un muelle.").nullable()),
});

export interface ApproveDeviceInput {
  name: string;
  dockId?: string;
}
export type ApproveDeviceField = keyof ApproveDeviceInput;

export const DEVICE_NOT_FOUND = new DomainError("DEVICE_NOT_FOUND", "No existe esa computadora.");
const DEVICE_CHANGED = new DomainError(
  "DEVICE_CHANGED",
  "La computadora cambió mientras tanto. Recarga la pantalla.",
);

async function findOrFail(devices: DeviceAdminRepository, id: unknown): Promise<DeviceView> {
  const parsed = z.uuid().safeParse(id);
  const device = parsed.success ? await devices.findById(parsed.data) : null;
  if (!device) throw DEVICE_NOT_FOUND;
  return device;
}

/** Lista por estado; un estado desconocido muestra las pendientes. */
export function createListDevices(deps: Pick<DeviceDeps, "devices">) {
  return async function listDevices(
    rawStatus: unknown,
  ): Promise<{ status: DeviceStatus; devices: DeviceView[]; docks: DockOption[] }> {
    const status = DEVICE_STATUSES.includes(rawStatus as DeviceStatus)
      ? (rawStatus as DeviceStatus)
      : "PENDING";
    const [devices, docks] = await Promise.all([
      deps.devices.list(status),
      deps.devices.listDocks(),
    ]);
    return { status, devices, docks };
  };
}

/** Aprobar una solicitud asignándola a un muelle (o a la oficina del superadmin). */
export function createApproveDevice(deps: DeviceDeps) {
  return async function approveDevice(
    actor: DeviceActor,
    deviceId: unknown,
    input: ApproveDeviceInput,
  ): Promise<void> {
    const device = await findOrFail(deps.devices, deviceId);
    if (!canApproveDevice(device.status)) {
      throw new DomainError("DEVICE_NOT_PENDING", "Solo se aprueban solicitudes pendientes.");
    }
    const data = parseInput<ApproveDeviceField, typeof approveDeviceSchema>(
      approveDeviceSchema,
      input,
    );
    // La de un administrador solo puede ser de su propio muelle: con otro, el login la
    // rechazaría después (WRONG_DOCK).
    if (!isValidDeviceDock(device.requestedBy, data.dockId)) {
      throw new InputError<ApproveDeviceField>({
        dockId: "La computadora de un administrador debe ser del muelle de ese administrador.",
      });
    }
    if (data.dockId && !(await deps.devices.dockExists(data.dockId))) {
      throw new InputError<ApproveDeviceField>({ dockId: "Elige un muelle de la lista." });
    }

    const approved = await deps.devices.approve(
      device.id,
      { ...data, approvedById: actor.id, at: deps.clock.now() },
      {
        userId: actor.id,
        action: "DEVICE_APPROVED",
        details: { dockId: data.dockId, name: data.name, requestedBy: device.requestedBy.email },
      },
    );
    if (!approved) throw DEVICE_CHANGED;
  };
}

/** Revocar una computadora aprobada o rechazar una solicitud: sus sesiones dejan de servir. */
export function createRevokeDevice(deps: DeviceDeps) {
  return async function revokeDevice(actor: DeviceActor, deviceId: unknown): Promise<void> {
    const device = await findOrFail(deps.devices, deviceId);
    if (!canRevokeDevice(device.status)) {
      throw new DomainError("DEVICE_ALREADY_REVOKED", "La computadora ya está revocada.");
    }
    const revoked = await deps.devices.revoke(device.id, {
      userId: actor.id,
      action: "DEVICE_REVOKED",
      details: { from: device.status },
    });
    if (!revoked) throw DEVICE_CHANGED;
  };
}

/** Cambiar el nombre visible de una computadora pendiente o aprobada. */
export function createRenameDevice(deps: DeviceDeps) {
  return async function renameDevice(
    actor: DeviceActor,
    deviceId: unknown,
    rawName: string,
  ): Promise<void> {
    const device = await findOrFail(deps.devices, deviceId);
    const { name } = parseInput<"name", z.ZodObject<{ name: typeof nameSchema }>>(
      z.object({ name: nameSchema }),
      { name: rawName },
    );
    const renamed = await deps.devices.rename(device.id, name, {
      userId: actor.id,
      action: "DEVICE_RENAMED",
      details: { from: device.name, to: name },
    });
    if (!renamed) {
      throw new DomainError("DEVICE_REVOKED", "No se puede renombrar una computadora revocada.");
    }
  };
}
