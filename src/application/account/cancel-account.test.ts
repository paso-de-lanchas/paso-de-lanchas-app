import { describe, expect, it } from "vitest";

import type { PasswordHasher } from "@/application/auth/ports";
import type { Clock } from "@/application/shared/ports";
import {
  buildAnonymizedAccountData,
  ensureAccountCanBeCancelled,
} from "@/domain/account/account-cancellation";
import { DomainError } from "@/domain/shared/domain-error";
import { Money } from "@/domain/shared/money";

import {
  type AccountCancellationRepository,
  type AccountCancellationSummary,
  createCancelAccount,
  type ExecuteAccountCancellationParams,
  type ExecuteAccountCancellationResult,
  getAccountCancellationPreview,
} from "./cancel-account";

interface StoredUserRecord {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  photoUrl: string | null;
  passwordHash: string;
  status: string;
  deletedAt: Date | null;
}

class InMemoryAccountCancellationRepository implements AccountCancellationRepository {
  users: StoredUserRecord[] = [];
  wallets: Array<{ userId: string; balanceCents: number }> = [];
  qrCredentials: Array<{ id: string; userId: string; revokedAt: Date | null }> = [];
  sessions: Array<{ id: string; userId: string }> = [];
  authTokens: Array<{ id: string; userId: string }> = [];
  pushSubscriptions: Array<{ id: string; userId: string }> = [];
  auditLogs: Array<{
    userId: string;
    action: string;
    entity: string;
    entityId: string;
    details: { forfeitedBalanceCents: number };
  }> = [];

  async findAccountSummaryById(userId: string): Promise<AccountCancellationSummary | null> {
    const user = this.users.find((u) => u.id === userId);
    if (!user) return null;
    const wallet = this.wallets.find((w) => w.userId === userId);
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      passwordHash: user.passwordHash,
      status: user.status,
      deletedAt: user.deletedAt,
      balanceCents: wallet?.balanceCents ?? 0,
    };
  }

  async executeCancellation(
    params: ExecuteAccountCancellationParams,
  ): Promise<ExecuteAccountCancellationResult> {
    const user = this.users.find((u) => u.id === params.userId)!;
    ensureAccountCanBeCancelled(user);

    const wallet = this.wallets.find((w) => w.userId === params.userId);
    const balanceCents = wallet?.balanceCents ?? 0;

    if (balanceCents > 0 && !params.acknowledgeBalanceLoss) {
      const formatted = Money.fromCents(balanceCents).format();
      throw new DomainError(
        "BALANCE_ACKNOWLEDGEMENT_REQUIRED",
        `Tienes un saldo de ${formatted}. Confirma que aceptas perderlo antes de cancelar tu cuenta.`,
      );
    }

    const anonymizedData = buildAnonymizedAccountData(
      params.userId,
      params.randomPasswordHash,
      params.revokedAt,
    );

    user.deletedAt = anonymizedData.deletedAt;
    user.status = anonymizedData.status;
    user.fullName = anonymizedData.fullName;
    user.email = anonymizedData.email;
    user.phone = anonymizedData.phone;
    user.photoUrl = anonymizedData.photoUrl;
    user.passwordHash = anonymizedData.passwordHash;

    for (const qr of this.qrCredentials) {
      if (qr.userId === params.userId && qr.revokedAt === null) {
        qr.revokedAt = params.revokedAt;
      }
    }

    this.sessions = this.sessions.filter((s) => s.userId !== params.userId);
    this.authTokens = this.authTokens.filter((t) => t.userId !== params.userId);
    this.pushSubscriptions = this.pushSubscriptions.filter((p) => p.userId !== params.userId);

    this.auditLogs.push({
      userId: params.userId,
      action: "ACCOUNT_CANCELLED",
      entity: "user",
      entityId: params.userId,
      details: { forfeitedBalanceCents: balanceCents },
    });

    return { forfeitedBalanceCents: balanceCents };
  }
}

const fakeHasher: PasswordHasher = {
  hash: async (plain) => `hashed:${plain}`,
  verify: async (hash, plain) => hash === `hashed:${plain}`,
};

describe("createCancelAccount use case", () => {
  const fixedNow = new Date("2026-11-22T15:00:00.000Z");
  const fixedClock: Clock = { now: () => fixedNow };

  it("anonimiza datos personales, revoca QR, borra sesiones/tokens/push, registra auditoría y conserva registros financieros", async () => {
    const repo = new InMemoryAccountCancellationRepository();
    repo.users.push({
      id: "user-1",
      email: "ana@pasolanchas.test",
      fullName: "Ana López",
      phone: "9211234567",
      photoUrl: "https://ejemplo.test/foto.jpg",
      passwordHash: "hashed:MiClaveSegura123",
      status: "ACTIVE",
      deletedAt: null,
    });
    repo.wallets.push({ userId: "user-1", balanceCents: 0 });
    repo.qrCredentials.push({ id: "qr-1", userId: "user-1", revokedAt: null });
    repo.sessions.push(
      { id: "sess-1", userId: "user-1" },
      { id: "sess-2", userId: "user-1" },
      { id: "sess-other", userId: "user-2" },
    );
    repo.authTokens.push({ id: "tok-1", userId: "user-1" }, { id: "tok-other", userId: "user-2" });
    repo.pushSubscriptions.push(
      { id: "push-1", userId: "user-1" },
      { id: "push-other", userId: "user-2" },
    );

    const cancelAccount = createCancelAccount({
      repo,
      passwordHasher: fakeHasher,
      clock: fixedClock,
      generateRandomSecret: () => "secreto-aleatorio-123",
    });

    const result = await cancelAccount("user-1", {
      currentPassword: "MiClaveSegura123",
      confirmationWord: "cancelar",
    });

    expect(result.cancelledAt).toEqual(fixedNow);
    expect(result.forfeitedBalanceCents).toBe(0);

    const updatedUser = repo.users[0]!;
    expect(updatedUser.deletedAt).toEqual(fixedNow);
    expect(updatedUser.status).toBe("INACTIVE");
    expect(updatedUser.fullName).toBe("Usuario eliminado");
    expect(updatedUser.email).toBe("eliminado-user-1@pasolanchas.invalid");
    expect(updatedUser.phone).toBeNull();
    expect(updatedUser.photoUrl).toBeNull();
    expect(updatedUser.passwordHash).toBe("hashed:secreto-aleatorio-123");

    expect(repo.qrCredentials[0]?.revokedAt).toEqual(fixedNow);
    expect(repo.sessions).toEqual([{ id: "sess-other", userId: "user-2" }]);
    expect(repo.authTokens).toEqual([{ id: "tok-other", userId: "user-2" }]);
    expect(repo.pushSubscriptions).toEqual([{ id: "push-other", userId: "user-2" }]);
    expect(repo.wallets).toHaveLength(1);
    expect(repo.auditLogs).toHaveLength(1);
    expect(repo.auditLogs[0]).toEqual({
      userId: "user-1",
      action: "ACCOUNT_CANCELLED",
      entity: "user",
      entityId: "user-1",
      details: { forfeitedBalanceCents: 0 },
    });
  });

  it("rechaza la cancelación si la contraseña actual no es correcta y no modifica nada", async () => {
    const repo = new InMemoryAccountCancellationRepository();
    repo.users.push({
      id: "user-1",
      email: "ana@pasolanchas.test",
      fullName: "Ana López",
      phone: "9211234567",
      photoUrl: null,
      passwordHash: "hashed:ClaveReal2026",
      status: "ACTIVE",
      deletedAt: null,
    });
    repo.sessions.push({ id: "sess-1", userId: "user-1" });
    repo.authTokens.push({ id: "tok-1", userId: "user-1" });
    repo.pushSubscriptions.push({ id: "push-1", userId: "user-1" });

    const cancelAccount = createCancelAccount({
      repo,
      passwordHasher: fakeHasher,
      clock: fixedClock,
    });

    await expect(
      cancelAccount("user-1", {
        currentPassword: "ClaveIncorrecta",
        confirmationWord: "CANCELAR",
      }),
    ).rejects.toThrow("La contraseña no es correcta.");

    expect(repo.users[0]?.status).toBe("ACTIVE");
    expect(repo.users[0]?.deletedAt).toBeNull();
    expect(repo.sessions).toHaveLength(1);
    expect(repo.authTokens).toHaveLength(1);
    expect(repo.pushSubscriptions).toHaveLength(1);
    expect(repo.auditLogs).toHaveLength(0);
  });

  it("avisa cuando el pasajero tiene saldo mayor a $0 y exige confirmación explícita", async () => {
    const repo = new InMemoryAccountCancellationRepository();
    repo.users.push({
      id: "user-saldo",
      email: "pasajero@pasolanchas.test",
      fullName: "Carlos Ruiz",
      phone: "9219876543",
      photoUrl: null,
      passwordHash: "hashed:PasoLanchas-dev-2026",
      status: "ACTIVE",
      deletedAt: null,
    });
    repo.wallets.push({ userId: "user-saldo", balanceCents: 10000 });

    const preview = await getAccountCancellationPreview(repo, "user-saldo");
    expect(preview.warning.hasBalance).toBe(true);
    expect(preview.warning.message).toContain("100.00");

    const cancelAccount = createCancelAccount({
      repo,
      passwordHasher: fakeHasher,
      clock: fixedClock,
    });

    await expect(
      cancelAccount("user-saldo", {
        currentPassword: "PasoLanchas-dev-2026",
        confirmationWord: "CANCELAR",
        acknowledgeBalanceLoss: false,
      }),
    ).rejects.toThrow("Confirma que aceptas perderlo");

    const confirmed = await cancelAccount("user-saldo", {
      currentPassword: "PasoLanchas-dev-2026",
      confirmationWord: "CANCELAR",
      acknowledgeBalanceLoss: true,
    });
    expect(confirmed.forfeitedBalanceCents).toBe(10000);
    expect(repo.users[0]?.status).toBe("INACTIVE");
  });

  it("rechaza confirmación inválida o cuenta inexistente", async () => {
    const repo = new InMemoryAccountCancellationRepository();
    const cancelAccount = createCancelAccount({
      repo,
      passwordHasher: fakeHasher,
      clock: fixedClock,
    });

    await expect(
      cancelAccount("user-1", {
        currentPassword: "Clave",
        confirmationWord: "NO",
      }),
    ).rejects.toThrow("Debes escribir la palabra CANCELAR");

    await expect(getAccountCancellationPreview(repo, "inexistente")).rejects.toThrow(
      "No se encontró la cuenta del pasajero.",
    );
  });
});
