import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Superadministrador" };

export default function SuperadminPage() {
  return (
    <ModulePlaceholder
      role="Superadministrador"
      modules={[
        { name: "Superadministración", owner: "Omar", requirements: "RF-116 a RF-121" },
        { name: "Auditoría", owner: "Omar", requirements: "RF-122 a RF-124" },
      ]}
    />
  );
}
