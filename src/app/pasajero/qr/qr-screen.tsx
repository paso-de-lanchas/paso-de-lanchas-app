"use client";

import { del, get, set } from "idb-keyval";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";

import { buildQrPayload, timeStepAt } from "@/domain/qr/qr-payload";
import { codeForTimeStep } from "@/infrastructure/qr/totp";

type StoredCredential = { credentialId: string; secret: string; stepSeconds: number };
type Status = "loading" | "ready" | "offline" | "error";

const storageKey = (userId: string) => `qr:${userId}`;

// Evita dos POST simultáneos (React ejecuta los efectos dos veces en desarrollo).
let pendingIssue: Promise<StoredCredential> | null = null;

/** true = vigente, false = revocada, null = no se pudo saber (sin red, sesión vencida, error). */
async function checkActive(credentialId: string): Promise<boolean | null> {
  try {
    const response = await fetch(`/api/qr/credential?id=${encodeURIComponent(credentialId)}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { active?: unknown };
    return typeof body.active === "boolean" ? body.active : null;
  } catch {
    return null;
  }
}

async function issueNew(userId: string): Promise<StoredCredential> {
  const response = await fetch("/api/qr/credential", { method: "POST" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const issued = (await response.json()) as StoredCredential;
  await set(storageKey(userId), issued);
  return issued;
}

export function QrScreen({ userId }: { userId: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [credential, setCredential] = useState<StoredCredential | null>(null);
  const [payload, setPayload] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0); // subirlo vuelve a intentar

  // 1) Conseguir la credencial: del celular, o del servidor si es la primera vez.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const saved = await get<StoredCredential>(storageKey(userId));
      if (cancelled) return;

      if (saved) {
        // 1) Mostrar de inmediato la credencial guardada (funciona sin internet).
        setCredential(saved);
        setStatus("ready");
        if (!navigator.onLine) return;

        // 2) Con internet, preguntar si sigue vigente. Solo "false" la descarta.
        if ((await checkActive(saved.credentialId)) !== false) return;
        await del(storageKey(userId));
        if (cancelled) return;
        setCredential(null);
        setPayload(null);
        setStatus("loading");
      } else if (!navigator.onLine) {
        setStatus("offline");
        return;
      }

      // 3) Pedir una credencial nueva.
      pendingIssue ??= issueNew(userId).finally(() => {
        pendingIssue = null;
      });
      const issued = await pendingIssue;
      if (cancelled) return;
      setCredential(issued);
      setStatus("ready");
    })().catch(() => {
      if (!cancelled) setStatus("error");
    });

    return () => {
      cancelled = true;
    };
  }, [userId, attempt]);

  // 2) Calcular el código cada segundo (sin internet): solo cambia al cambiar de ventana.
  useEffect(() => {
    if (!credential) return;
    let lastStep = -1;

    async function tick() {
      if (!credential) return;
      const now = Date.now();
      const { secret, stepSeconds, credentialId } = credential;
      setSecondsLeft(stepSeconds - (Math.floor(now / 1000) % stepSeconds));

      const step = timeStepAt(now, stepSeconds);
      if (step === lastStep) return;
      lastStep = step;
      const code = await codeForTimeStep(secret, step, stepSeconds);
      setPayload(buildQrPayload({ credentialId, code }));
    }

    void tick();
    const id = setInterval(() => void tick(), 1000);
    return () => clearInterval(id);
  }, [credential]);

  // 3) Mantener la pantalla encendida (opcional; no todos los navegadores lo soportan).
  useEffect(() => {
    if (status !== "ready") return;
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock
      ?.request("screen")
      .then((l) => (lock = l))
      .catch(() => {});
    return () => {
      void lock?.release();
    };
  }, [status]);

  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 p-6">
      <h1 className="font-heading text-brand text-2xl font-bold">Mi código QR</h1>

      {status === "loading" && <p className="text-ink-muted">Preparando tu QR…</p>}

      {status === "offline" && (
        <p role="alert" className="text-ink text-center">
          Conéctate una vez a internet para activar tu QR. Después funcionará sin conexión.
        </p>
      )}

      {status === "error" && (
        <div role="alert" className="text-center">
          <p className="text-ink mb-3">No pudimos activar tu QR.</p>
          <button
            type="button"
            onClick={() => {
              setStatus("loading");
              setAttempt((n) => n + 1);
            }}
            className="bg-brand min-h-11 rounded-lg px-4 font-medium text-white"
          >
            Reintentar
          </button>
        </div>
      )}

      {status === "ready" && payload && (
        <>
          <div className="border-line w-full rounded-xl border bg-white p-4">
            <QRCodeSVG value={payload} size={320} level="M" className="h-auto w-full" />
          </div>
          <p className="text-ink-muted" aria-live="off">
            Cambia en {secondsLeft} s
          </p>
        </>
      )}
    </main>
  );
}
