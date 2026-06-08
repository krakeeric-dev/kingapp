"use client";

import { AppShell } from "@/components/AppShell";
import { DeliveryWorkspace } from "@/components/DeliveryWorkspace";

export default function DeliveryDriversPage() {
  return (
    <AppShell allowedRoles={["admin", "manager"]}>
      {(user) => <DeliveryWorkspace mode="drivers" user={user} />}
    </AppShell>
  );
}
