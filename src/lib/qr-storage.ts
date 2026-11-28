import { delMany, keys } from "idb-keyval";

/** Borra del celular todas las credenciales QR guardadas. Nunca lanza errores. */
export async function clearStoredQrCredentials(): Promise<void> {
  try {
    const stored = await keys();
    const qrKeys = stored.filter((k) => typeof k === "string" && k.startsWith("qr:"));
    await delMany(qrKeys);
  } catch {
    // Si IndexedDB falla, cerrar sesión no debe quedar bloqueado.
  }
}
