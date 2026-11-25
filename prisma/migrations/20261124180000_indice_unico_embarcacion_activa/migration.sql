-- Índice único parcial: impide que una misma embarcación tenga más de una salida activa en cualquier muelle.
CREATE UNIQUE INDEX "departures_one_active_per_vessel"
  ON "departures" ("vessel_id")
  WHERE "status" IN ('QUEUED', 'BOARDING', 'BOARDING_CLOSED', 'IN_TRANSIT');
