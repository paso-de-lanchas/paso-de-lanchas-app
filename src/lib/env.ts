import { z } from "zod";

// Variables de entorno del servidor, validadas al arrancar. Si falta una obligatoria,
// la app falla de inmediato con un mensaje claro en vez de fallar a la mitad de un cobro.
// Cuando agregues una variable: agrégala aquí, en .env.example y en Vercel.
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url({ message: "DATABASE_URL debe ser una URL de PostgreSQL" }),
  APP_URL: z.url().default("http://localhost:3000"),
  AUTH_SECRET: z.string().optional(),
  QR_SIGNING_SECRET: z.string().optional(),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default("Paso de Lanchas <no-responder@pasolanchas.test>"),
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function loadEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(
      `Variables de entorno inválidas (revisa tu .env.local contra .env.example):\n${issues.join("\n")}`,
    );
  }
  return parsed.data;
}

export const env = loadEnv();
