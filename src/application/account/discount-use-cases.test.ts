import { describe, expect, it } from "vitest";

import { type DiscountRequest, getMexicoTodayUtcMidnight } from "@/domain/account/discount";
import { DomainError } from "@/domain/shared/domain-error";

import type {
  CreateDiscountRequestData,
  DiscountRepository,
  PendingDiscountItem,
} from "./discount-repository";
import { getMyDiscount } from "./get-my-discount";
import { listPendingDiscounts } from "./list-pending-discounts";
import { requestDiscount } from "./request-discount";
import { reviewDiscount } from "./review-discount";

class InMemoryDiscountRepository implements DiscountRepository {
  private readonly items: DiscountRequest[] = [];
  private seq = 1;

  constructor(initial: DiscountRequest[] = []) {
    this.items = initial.map((item) => ({ ...item }));
  }

  async findLatestByUserId(userId: string): Promise<DiscountRequest | null> {
    const userItems = this.items.filter((i) => i.userId === userId);
    return userItems.length > 0 ? { ...userItems[userItems.length - 1] } : null;
  }

  async hasPendingByUserId(userId: string): Promise<boolean> {
    return this.items.some((i) => i.userId === userId && i.status === "PENDING");
  }

  async findById(requestId: string): Promise<DiscountRequest | null> {
    const found = this.items.find((i) => i.id === requestId);
    return found ? { ...found } : null;
  }

  async listPending(): Promise<PendingDiscountItem[]> {
    return this.items
      .filter((i) => i.status === "PENDING")
      .map((i) => ({
        ...i,
        passengerName: "Pasajera de prueba",
        passengerEmail: "pasajero@pasolanchas.test",
      }));
  }

  async create(data: CreateDiscountRequestData): Promise<DiscountRequest> {
    const created: DiscountRequest = {
      id: `req-${this.seq++}`,
      userId: data.userId,
      discountType: data.discountType,
      credentialPhotoPath: data.credentialPhotoPath,
      status: "PENDING",
      reviewedById: null,
      reviewedAt: null,
      rejectionReason: null,
      validUntil: null,
      createdAt: new Date("2026-11-21T12:00:00.000Z"),
    };
    this.items.push(created);
    return { ...created };
  }

  async approve(
    requestId: string,
    adminId: string,
    validUntil: Date,
    reviewedAt: Date,
  ): Promise<DiscountRequest> {
    const item = this.items.find((i) => i.id === requestId && i.status === "PENDING");
    if (!item) {
      throw new DomainError(
        "DISCOUNT_ALREADY_REVIEWED",
        "Esta solicitud ya fue revisada anteriormente.",
      );
    }
    item.status = "APPROVED";
    item.reviewedById = adminId;
    item.reviewedAt = reviewedAt;
    item.validUntil = validUntil;
    item.rejectionReason = null;
    return { ...item };
  }

  async reject(
    requestId: string,
    adminId: string,
    rejectionReason: string,
    reviewedAt: Date,
  ): Promise<DiscountRequest> {
    const item = this.items.find((i) => i.id === requestId && i.status === "PENDING");
    if (!item) {
      throw new DomainError(
        "DISCOUNT_ALREADY_REVIEWED",
        "Esta solicitud ya fue revisada anteriormente.",
      );
    }
    item.status = "REJECTED";
    item.reviewedById = adminId;
    item.reviewedAt = reviewedAt;
    item.rejectionReason = rejectionReason;
    item.validUntil = null;
    return { ...item };
  }

  async markExpiredBefore(now: Date): Promise<number> {
    const todayMexicoUtc = getMexicoTodayUtcMidnight(now);
    let count = 0;
    for (const item of this.items) {
      if (
        item.status === "APPROVED" &&
        item.validUntil &&
        item.validUntil.getTime() < todayMexicoUtc.getTime()
      ) {
        item.status = "EXPIRED";
        count++;
      }
    }
    return count;
  }
}

describe("account discount use cases", () => {
  const now = new Date("2026-11-21T12:00:00.000Z");

  it("crea una solicitud PENDING y bloquea duplicados mientras siga pendiente", async () => {
    const repo = new InMemoryDiscountRepository();
    const created = await requestDiscount(
      repo,
      "user-1",
      { discountType: "STUDENT", credentialPhotoPath: "uploads/cred-1.jpg" },
      now,
    );

    expect(created.status).toBe("PENDING");
    expect(created.discountType).toBe("STUDENT");

    await expect(
      requestDiscount(
        repo,
        "user-1",
        { discountType: "INAPAM", credentialPhotoPath: "uploads/cred-2.jpg" },
        now,
      ),
    ).rejects.toThrow("Ya tienes una solicitud de descuento en revisión.");
  });

  it("rechaza entradas inválidas en requestDiscount", async () => {
    const repo = new InMemoryDiscountRepository();
    await expect(
      requestDiscount(repo, "user-1", { discountType: "OTRO", credentialPhotoPath: "" }, now),
    ).rejects.toThrow();
  });

  it("permite al administrador aprobar con fecha futura o rechazar con motivo", async () => {
    const repo = new InMemoryDiscountRepository();
    const req1 = await requestDiscount(
      repo,
      "user-1",
      { discountType: "INAPAM", credentialPhotoPath: "uploads/inapam.png" },
      now,
    );

    const pending = await listPendingDiscounts(repo, now);
    expect(pending).toHaveLength(1);

    const validUntil = new Date("2027-11-21T12:00:00.000Z");
    const approved = await reviewDiscount(
      repo,
      "admin-1",
      { requestId: req1.id, decision: "APPROVE", validUntil },
      now,
    );
    expect(approved.status).toBe("APPROVED");
    expect(approved.validUntil).toEqual(validUntil);

    await expect(
      reviewDiscount(
        repo,
        "admin-1",
        { requestId: req1.id, decision: "REJECT", rejectionReason: "Tarde" },
        now,
      ),
    ).rejects.toThrow("Esta solicitud ya fue revisada anteriormente.");

    const req2 = await requestDiscount(
      repo,
      "user-2",
      { discountType: "STUDENT", credentialPhotoPath: "uploads/est.jpg" },
      now,
    );
    const rejected = await reviewDiscount(
      repo,
      "admin-1",
      { requestId: req2.id, decision: "REJECT", rejectionReason: "Credencial sin sello vigente" },
      now,
    );
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.rejectionReason).toBe("Credencial sin sello vigente");
  });

  it("impide que dos administradores revisen simultáneamente la misma solicitud", async () => {
    const repo = new InMemoryDiscountRepository();
    const req = await requestDiscount(
      repo,
      "user-1",
      { discountType: "STUDENT", credentialPhotoPath: "uploads/cred.jpg" },
      now,
    );

    const results = await Promise.allSettled([
      reviewDiscount(
        repo,
        "admin-1",
        {
          requestId: req.id,
          decision: "APPROVE",
          validUntil: new Date("2027-06-30T00:00:00.000Z"),
        },
        now,
      ),
      reviewDiscount(
        repo,
        "admin-2",
        { requestId: req.id, decision: "REJECT", rejectionReason: "Ilegible" },
        now,
      ),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  it("expira automáticamente las solicitudes vencidas al consultar y permite renovar", async () => {
    const repo = new InMemoryDiscountRepository([
      {
        id: "req-old",
        userId: "user-1",
        discountType: "STUDENT",
        credentialPhotoPath: "uploads/old.jpg",
        status: "APPROVED",
        reviewedById: "admin-1",
        reviewedAt: new Date("2026-01-10T00:00:00.000Z"),
        rejectionReason: null,
        validUntil: new Date("2026-11-20T00:00:00.000Z"),
        createdAt: new Date("2026-01-09T00:00:00.000Z"),
      },
    ]);

    const current = await getMyDiscount(repo, "user-1", now);
    expect(current?.status).toBe("EXPIRED");

    const renewed = await requestDiscount(
      repo,
      "user-1",
      { discountType: "STUDENT", credentialPhotoPath: "uploads/new.jpg" },
      now,
    );
    expect(renewed.status).toBe("PENDING");
  });

  it("impide solicitar otro descuento si ya tiene uno aprobado y vigente", async () => {
    const repo = new InMemoryDiscountRepository([
      {
        id: "req-active",
        userId: "user-1",
        discountType: "INAPAM",
        credentialPhotoPath: "uploads/inapam.jpg",
        status: "APPROVED",
        reviewedById: "admin-1",
        reviewedAt: new Date("2026-11-01T00:00:00.000Z"),
        rejectionReason: null,
        validUntil: new Date("2027-05-01T00:00:00.000Z"),
        createdAt: new Date("2026-11-01T00:00:00.000Z"),
      },
    ]);

    await expect(
      requestDiscount(
        repo,
        "user-1",
        { discountType: "INAPAM", credentialPhotoPath: "uploads/otra.jpg" },
        now,
      ),
    ).rejects.toThrow("Ya cuentas con un descuento aprobado y vigente.");
  });

  it("rechaza revisiones con datos inválidos o solicitud inexistente", async () => {
    const repo = new InMemoryDiscountRepository();
    await expect(
      reviewDiscount(
        repo,
        "admin-1",
        { requestId: "", decision: "APPROVE", validUntil: "invalid" },
        now,
      ),
    ).rejects.toThrow();

    await expect(
      reviewDiscount(
        repo,
        "admin-1",
        { requestId: "no-existe", decision: "REJECT", rejectionReason: "No aplica" },
        now,
      ),
    ).rejects.toThrow("No se encontró la solicitud de descuento.");
  });
});
