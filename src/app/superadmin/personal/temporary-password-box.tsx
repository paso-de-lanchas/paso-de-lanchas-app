/** La contraseña temporal recién generada. Solo existe en esta respuesta: no se vuelve a mostrar. */
export function TemporaryPasswordBox({
  password,
  email,
  emailSent,
}: {
  password: string;
  email: string;
  emailSent: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <p className="text-sm font-bold">Contraseña temporal</p>
      <code
        data-testid="temporary-password"
        className="rounded-xl bg-white px-3 py-2 text-center font-mono text-xl tracking-wider select-all"
      >
        {password}
      </code>
      <p className="text-sm">
        Cópiala o díctala ahora: <strong>no se volverá a mostrar</strong>. Al entrar tendrá que
        elegir una contraseña nueva.
      </p>
      <p className="text-sm">
        {emailSent
          ? `También se envió a ${email}.`
          : `No se pudo enviar el correo a ${email}: entrégasela en persona.`}
      </p>
    </div>
  );
}
