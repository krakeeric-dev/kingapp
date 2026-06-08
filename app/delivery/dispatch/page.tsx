"use client";

import { AppShell } from "@/components/AppShell";
import { DeliveryWorkspace } from "@/components/DeliveryWorkspace";

export default function DeliveryDispatchPage() {
  return (
    <AppShell allowedRoles={["admin", "manager", "storekeeper"]}>
      {(user) => <DeliveryWorkspace mode="dispatch" user={user} />}
    </AppShell>
  );
}
