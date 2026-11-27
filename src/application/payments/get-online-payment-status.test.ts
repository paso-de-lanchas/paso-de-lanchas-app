import { describe, expect, it, vi } from "vitest";

import { createGetOnlinePaymentStatus } from "./get-online-payment-status";

describe("createGetOnlinePaymentStatus", () => {
  it("only requests status for a valid payment id and the signed-in user", async () => {
    const getPaymentStatus = vi.fn(async () => "PENDING" as const);
    const getStatus = createGetOnlinePaymentStatus({ getPaymentStatus });

    await expect(getStatus("2fd6a4ed-07c7-4d55-ae46-68c415ff8799", "passenger-id")).resolves.toBe(
      "PENDING",
    );
    expect(getPaymentStatus).toHaveBeenCalledWith(
      "2fd6a4ed-07c7-4d55-ae46-68c415ff8799",
      "passenger-id",
    );
  });

  it("does not query the repository for malformed payment ids", async () => {
    const getPaymentStatus = vi.fn();
    const getStatus = createGetOnlinePaymentStatus({ getPaymentStatus });

    await expect(getStatus("not-a-uuid", "passenger-id")).resolves.toBeNull();
    expect(getPaymentStatus).not.toHaveBeenCalled();
  });
});
