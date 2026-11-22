import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/module-placeholder";
import { requireRole } from "@/lib/auth/require-role";

export const metadata: Metadata = { title: "Chofer" };

export default async function DriverPage() {
  const user = await requireRole("DRIVER");
  return (
    <ModulePlaceholder
      userName={user.fullName}
      role="Chofer"
      modules={[
        {
          name: "Viajes del chofer (GPS en vivo)",
          owner: "Diego",
          requirements: "RF-069 a RF-076",
        },
      ]}
    />
  );
}
