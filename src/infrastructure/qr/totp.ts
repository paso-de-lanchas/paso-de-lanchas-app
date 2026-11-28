import { generate, generateSecret } from "otplib";

// Único archivo que conoce otplib; el resto del código usa solo estas funciones.
export function newSecret(): string {
  return generateSecret({ length: 20 });
}

/** Código de 6 dígitos de la ventana número `timeStep` (contada desde 1970). */
export async function codeForTimeStep(
  secret: string,
  timeStep: number,
  stepSeconds: number,
): Promise<string> {
  return generate({
    secret,
    period: stepSeconds,
    epoch: timeStep * stepSeconds, // segundos en que EMPIEZA esa ventana
  });
}
