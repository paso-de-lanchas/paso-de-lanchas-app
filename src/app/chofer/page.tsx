import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Chofer" };

export default function DriverPage() {
  return (
    <ModulePlaceholder
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
