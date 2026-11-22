-- Índices únicos parciales (issue #27). Prisma no los detecta en schema.prisma, por eso se escriben a mano.

-- Un chofer no puede tener dos asignaciones activas a la misma embarcación.
CREATE UNIQUE INDEX "vessel_drivers_one_active_assignment"
  ON "vessel_drivers" ("driver_id", "vessel_id")
  WHERE "unassigned_at" IS NULL;

-- Un pasajero no puede tener dos solicitudes de descuento en revisión.
CREATE UNIQUE INDEX "discount_requests_one_pending_per_user"
  ON "discount_requests" ("user_id")
  WHERE "status" = 'PENDING';
