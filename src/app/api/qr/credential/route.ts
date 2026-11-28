import { issueQrCredential } from "@/application/qr/issue-qr-credential";
import { createPrismaQrRepository } from "@/infrastructure/qr/prisma-qr-repository";
import { getQrStepSeconds } from "@/infrastructure/qr/qr-settings";
import { encryptSecret } from "@/infrastructure/qr/secret-cipher";
import { newSecret } from "@/infrastructure/qr/totp";
import { requireApiRole } from "@/lib/auth/require-role";
import { getQrSigningSecret } from "@/infrastructure/qr/qr-key";
import { z } from "zod";
import { isCredentialActiveForUser } from "@/application/qr/check-qr-credential";

export async function POST() {
  const auth = await requireApiRole("PASSENGER");
  if (!auth.ok) return auth.response;

  const result = await issueQrCredential(auth.user.id, {
    repository: createPrismaQrRepository(),
    newSecret,
    encryptSecret: (plain) => encryptSecret(plain, getQrSigningSecret()),
    stepSeconds: await getQrStepSeconds(),
  });

  // El secreto viaja una sola vez: que ningún caché lo guarde.
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}

const idSchema = z.string().min(1).max(64);

export async function GET(request: Request) {
  const auth = await requireApiRole("PASSENGER");
  if (!auth.ok) return auth.response;

  const id = idSchema.safeParse(new URL(request.url).searchParams.get("id"));
  const active = id.success
    ? await isCredentialActiveForUser(id.data, auth.user.id, createPrismaQrRepository())
    : false;

  return Response.json({ active }, { headers: { "Cache-Control": "no-store" } });
}
