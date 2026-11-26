/**
 * Cuentas de las pruebas de contraseña. `scripts/dev-prepare-e2e-accounts.ts` las crea o
 * restablece antes de cada corrida. Solo existen en la base local.
 */
export const E2E_ACCOUNTS = {
  recover: {
    email: "e2e.recuperar@pasolanchas.test",
    password: "vieja-2026",
    role: "PASSENGER",
    mustChangePassword: false,
  },
  temporary: {
    email: "e2e.temporal@pasolanchas.test",
    password: "temporal-2026",
    role: "DRIVER",
    mustChangePassword: true,
  },
  change: {
    email: "e2e.cambiar@pasolanchas.test",
    password: "actual-2026",
    role: "PASSENGER",
    mustChangePassword: false,
  },
} as const;
