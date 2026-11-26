import { NextResponse } from "next/server";

import {
  PrismaDiscountRepository,
  readPrivateCredentialFile,
} from "@/infrastructure/account/prisma-discount-repository";
import { requireApiRole } from "@/lib/auth/require-role";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole("ADMIN");
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const repo = new PrismaDiscountRepository();
  const discountRequest = await repo.findById(id);

  if (!discountRequest) {
    return NextResponse.json(
      { error: "No se encontró la solicitud de descuento." },
      { status: 404 },
    );
  }

  const stored = await readPrivateCredentialFile(discountRequest.credentialPhotoPath);
  if (!stored) {
    return NextResponse.json(
      { error: "El archivo de la credencial no está disponible en el servidor." },
      { status: 404 },
    );
  }

  return new NextResponse(new Uint8Array(stored.buffer), {
    status: 200,
    headers: {
      "Content-Type": stored.contentType,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store, private",
    },
  });
}
