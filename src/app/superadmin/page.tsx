import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/module-placeholder";
import { requireRole } from "@/lib/auth/require-role";

export const metadata: Metadata = { title: "Superadministrador" };

export default async function SuperadminPage() {
  const user = await requireRole("SUPERADMIN");
  return (
    <ModulePlaceholder
      userName={user.fullName}
      role="Superadministrador"
      modules={[
        { name: "Superadministración", owner: "Omar", requirements: "RF-116 a RF-121" },
        { name: "Auditoría", owner: "Omar", requirements: "RF-122 a RF-124" },
      ]}
    />
  );
}
