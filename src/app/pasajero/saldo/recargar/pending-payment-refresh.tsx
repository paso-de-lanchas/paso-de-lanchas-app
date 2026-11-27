"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function PendingPaymentRefresh() {
  const router = useRouter();

  useEffect(() => {
    const intervalId = window.setInterval(() => router.refresh(), 5_000);
    return () => window.clearInterval(intervalId);
  }, [router]);

  return null;
}
