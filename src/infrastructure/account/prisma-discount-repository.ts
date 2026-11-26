import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  ALLOWED_CREDENTIAL_MIME_TYPES,
  credentialFileMetaSchema,
} from "@/application/account/discount-input";
import type {
  CreateDiscountRequestData,
  DiscountRepository,
  PendingDiscountItem,
} from "@/application/account/discount-repository";
import {
  type DiscountRequest,
  type DiscountRequestStatus,
  type DiscountType,
  getMexicoTodayUtcMidnight,
} from "@/domain/account/discount";
import { DomainError } from "@/domain/shared/domain-error";
import { prisma } from "@/infrastructure/db/prisma";

const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");

const MIME_TO_EXT: Record<(typeof ALLOWED_CREDENTIAL_MIME_TYPES)[number], string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function resolveSafeUploadPath(relativePath: string): string {
  const resolved = path.resolve(UPLOADS_ROOT, relativePath);
  if (!resolved.startsWith(`${UPLOADS_ROOT}${path.sep}`)) {
    throw new DomainError("INVALID_FILE_PATH", "Ruta de credencial no permitida.");
  }
  return resolved;
}

export async function savePrivateCredentialFile(file: File): Promise<string> {
  const parsedMeta = credentialFileMetaSchema.safeParse({
    type: file.type,
    size: file.size,
  });

  if (!parsedMeta.success) {
    const msg = parsedMeta.error.issues[0]?.message ?? "El archivo de credencial no es válido.";
    throw new DomainError("INVALID_CREDENTIAL_FILE", msg);
  }

  const ext = MIME_TO_EXT[parsedMeta.data.type];
  const relativePath = path.posix.join("credentials", `${randomUUID()}${ext}`);
  const fullPath = resolveSafeUploadPath(relativePath);

  await mkdir(path.dirname(fullPath), { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buffer);

  return relativePath;
}

export async function deletePrivateCredentialFile(relativePath: string): Promise<void> {
  try {
    const fullPath = resolveSafeUploadPath(relativePath);
    await unlink(fullPath);
  } catch {
    // Si el archivo ya no existe en disco, continuamos sin error
  }
}

export async function readPrivateCredentialFile(
  relativePath: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const fullPath = resolveSafeUploadPath(relativePath);
    const buffer = await readFile(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = EXT_TO_MIME[ext] ?? "application/octet-stream";
    return { buffer, contentType };
  } catch {
    return null;
  }
}

interface PrismaDiscountRow {
  id: string;
  userId: string;
  discountType: DiscountType;
  credentialPhotoUrl: string;
  status: DiscountRequestStatus;
  reviewedById: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  validUntil: Date | null;
  createdAt: Date;
}

function mapToDomain(row: PrismaDiscountRow): DiscountRequest {
  return {
    id: row.id,
    userId: row.userId,
    discountType: row.discountType,
    credentialPhotoPath: row.credentialPhotoUrl,
    status: row.status,
    reviewedById: row.reviewedById,
    reviewedAt: row.reviewedAt,
    rejectionReason: row.rejectionReason,
    validUntil: row.validUntil,
    createdAt: row.createdAt,
  };
}

export class PrismaDiscountRepository implements DiscountRepository {
  async findLatestByUserId(userId: string): Promise<DiscountRequest | null> {
    const row = await prisma.discountRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return row ? mapToDomain(row) : null;
  }

  async hasPendingByUserId(userId: string): Promise<boolean> {
    const count = await prisma.discountRequest.count({
      where: { userId, status: "PENDING" },
    });
    return count > 0;
  }

  async findById(requestId: string): Promise<DiscountRequest | null> {
    const row = await prisma.discountRequest.findUnique({
      where: { id: requestId },
    });
    return row ? mapToDomain(row) : null;
  }

  async listPending(): Promise<PendingDiscountItem[]> {
    const rows = await prisma.discountRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    });

    return rows.map((row) => ({
      ...mapToDomain(row),
      passengerName: row.user.fullName,
      passengerEmail: row.user.email,
    }));
  }

  async create(data: CreateDiscountRequestData): Promise<DiscountRequest> {
    const row = await prisma.discountRequest.create({
      data: {
        userId: data.userId,
        discountType: data.discountType,
        credentialPhotoUrl: data.credentialPhotoPath,
        status: "PENDING",
      },
    });
    return mapToDomain(row);
  }

  async approve(
    requestId: string,
    adminId: string,
    validUntil: Date,
    reviewedAt: Date,
  ): Promise<DiscountRequest> {
    const updated = await prisma.discountRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: {
        status: "APPROVED",
        reviewedById: adminId,
        reviewedAt,
        validUntil,
        rejectionReason: null,
      },
    });

    if (updated.count === 0) {
      throw new DomainError(
        "DISCOUNT_ALREADY_REVIEWED",
        "Esta solicitud ya fue revisada anteriormente.",
      );
    }

    const row = await prisma.discountRequest.findUniqueOrThrow({
      where: { id: requestId },
    });
    return mapToDomain(row);
  }

  async reject(
    requestId: string,
    adminId: string,
    rejectionReason: string,
    reviewedAt: Date,
  ): Promise<DiscountRequest> {
    const updated = await prisma.discountRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: {
        status: "REJECTED",
        reviewedById: adminId,
        reviewedAt,
        rejectionReason,
        validUntil: null,
      },
    });

    if (updated.count === 0) {
      throw new DomainError(
        "DISCOUNT_ALREADY_REVIEWED",
        "Esta solicitud ya fue revisada anteriormente.",
      );
    }

    const row = await prisma.discountRequest.findUniqueOrThrow({
      where: { id: requestId },
    });
    return mapToDomain(row);
  }

  async markExpiredBefore(now: Date): Promise<number> {
    const todayMexicoUtc = getMexicoTodayUtcMidnight(now);
    const result = await prisma.discountRequest.updateMany({
      where: {
        status: "APPROVED",
        validUntil: { lt: todayMexicoUtc },
      },
      data: {
        status: "EXPIRED",
      },
    });
    return result.count;
  }
}
