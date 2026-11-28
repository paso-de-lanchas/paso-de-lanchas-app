import type { Metadata } from "next";

import { requireRole } from "@/lib/auth/require-role";

import { QrScreen } from "./qr-screen";

export const metadata: Metadata = { title: "Mi QR" };

export default async function QrPage() {
  const user = await requireRole("PASSENGER");
  return <QrScreen userId={user.id} />;
}
