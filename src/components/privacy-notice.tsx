"use client";

import { useId, useState } from "react";

export const PRIVACY_NOTICE_VERSION = "2026-11";

export function PrivacyNoticeContent() {
  return (
    <div className="space-y-3 text-xs leading-relaxed text-slate-700">
      <p>
        <strong className="text-slate-900">1. Responsable del tratamiento:</strong> Servicio de
        Transporte Fluvial <strong>Paso de Lanchas Coatzacoalcos ⇄ Villa Allende</strong>, con
        domicilio operativo en los muelles de Coatzacoalcos y Villa Allende, Veracruz, México, es
        responsable del uso y protección de sus datos personales conforme a la Ley Federal de
        Protección de Datos Personales en Posesión de los Particulares (LFPDPPP).
      </p>

      <p>
        <strong className="text-slate-900">2. Datos personales que recabamos:</strong> Para la
        prestación del servicio recabamos: (a) <em>Pasajeros:</em> nombre completo, correo
        electrónico, número de teléfono celular (opcional), fotografía de perfil (opcional),
        credencial vigente únicamente cuando solicite tarifa preferencial (estudiante o INAPAM),
        datos de vehículos registrados (tipo, marca, modelo, color y placas) e historial de saldo,
        recargas y abordajes. No almacenamos datos bancarios ni de tarjetas. (b){" "}
        <em>Personal operativo (choferes y administradores):</em> nombre completo, correo
        institucional y, durante los viajes activos en servicio, la{" "}
        <strong>ubicación geográfica (GPS) en tiempo real del chofer</strong> para mostrar el
        trayecto y tiempo estimado de arribo de la embarcación.
      </p>

      <p>
        <strong className="text-slate-900">3. Finalidades del tratamiento:</strong> Sus datos se
        utilizan de manera primaria para crear y administrar su cuenta, autenticar su acceso,
        gestionar su monedero electrónico y recargas, generar y validar códigos QR dinámicos de
        abordaje, aplicar tarifas preferenciales autorizadas y brindar seguimiento operativo de las
        salidas. De manera secundaria, para enviar avisos sobre horarios o suspensiones del servicio
        (configurables desde su perfil).
      </p>

      <p>
        <strong className="text-slate-900">4. Transferencia de datos:</strong> Sus datos personales
        no se venden ni ceden a terceros, salvo a proveedores tecnológicos necesarios para procesar
        pagos en línea o correos transaccionales, o por mandato de autoridad competente.
      </p>

      <p>
        <strong className="text-slate-900">5. Derechos ARCO y revocación:</strong> Usted tiene
        derecho a <strong>Acceder, Rectificar, Cancelar u Oponerse (ARCO)</strong> al tratamiento de
        sus datos personales, así como a revocar su consentimiento. Puede ejercer estos derechos
        acudiendo directamente a la taquilla de los muelles de Coatzacoalcos o Villa Allende, o
        enviando una solicitud al correo{" "}
        <span className="font-semibold text-[#0B3C5D]">privacidad@pasolanchas.mx</span> con su
        nombre completo, correo registrado y la descripción clara de su petición (plazo de
        respuesta: 20 días hábiles).
      </p>
    </div>
  );
}

interface PrivacyNoticeConsentProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  name?: string;
  required?: boolean;
  error?: string;
}

export function PrivacyNoticeConsent({
  checked,
  onChange,
  name = "privacyAccepted",
  required = true,
  error,
}: PrivacyNoticeConsentProps) {
  const checkboxId = useId();
  const [internalChecked, setInternalChecked] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isChecked = checked !== undefined ? checked : internalChecked;

  function handleChange(nextValue: boolean) {
    if (checked === undefined) {
      setInternalChecked(nextValue);
    }
    onChange?.(nextValue);
  }

  return (
    <section
      aria-label="Aviso de privacidad"
      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900">Aviso de Privacidad (LFPDPPP)</h2>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="text-xs font-semibold text-[#0B3C5D] underline hover:opacity-80"
        >
          {expanded ? "Contraer texto" : "Expandir texto"}
        </button>
      </div>

      <div
        className={`overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 transition-all ${
          expanded ? "max-h-96" : "max-h-36"
        }`}
      >
        <PrivacyNoticeContent />
      </div>

      <label
        htmlFor={checkboxId}
        className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm text-slate-800"
      >
        <input
          id={checkboxId}
          type="checkbox"
          name={name}
          checked={isChecked}
          required={required}
          onChange={(e) => handleChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0B3C5D] focus:ring-[#0B3C5D]"
        />
        <span>
          He leído y acepto el <strong>Aviso de Privacidad</strong> para completar mi registro.
        </span>
      </label>

      {error ? (
        <p role="alert" className="mt-1.5 text-xs font-semibold text-red-600">
          {error}
        </p>
      ) : null}
    </section>
  );
}
