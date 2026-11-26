/** Piezas comunes de los formularios (registro, contraseñas). */

export const inputClass = "border-line h-12 rounded-xl border bg-white px-3 font-normal";

export const submitClass =
  "bg-brand flex h-14 items-center justify-center rounded-2xl text-lg font-bold text-white disabled:opacity-60";

export function FieldError({ message, id }: { message?: string; id: string }) {
  if (!message) return null;
  return (
    <span id={id} className="text-sm font-normal text-red-800">
      {message}
    </span>
  );
}

export function FormAlert({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
      {message}
    </p>
  );
}

export function SuccessBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      role="status"
      className="bg-success-bg text-success-ink flex flex-col gap-2 rounded-2xl p-4 text-left"
    >
      <p className="font-bold">{title}</p>
      {children}
    </div>
  );
}

interface PasswordFieldProps {
  name: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  error?: string;
  help?: string;
}

/** Campo de contraseña. La etiqueta va aparte para que su nombre sea solo `label`. */
export function PasswordField({ name, label, autoComplete, error, help }: PasswordFieldProps) {
  const describedBy = [help && `${name}-help`, `${name}-error`].filter(Boolean).join(" ");
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="font-bold">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="password"
        autoComplete={autoComplete}
        required
        maxLength={128}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={inputClass}
      />
      {help && (
        <span id={`${name}-help`} className="text-ink-muted text-sm font-normal">
          {help}
        </span>
      )}
      <FieldError id={`${name}-error`} message={error} />
    </div>
  );
}

export const NEW_PASSWORD_HELP = "Mínimo 8 caracteres, con al menos una letra y un número.";
