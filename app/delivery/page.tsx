"use client";

import { AppShell } from "@/components/AppShell";
import { DeliveryWorkspace } from "@/components/DeliveryWorkspace";

export default function DeliveryPage() {
  return (
    <AppShell allowedRoles={["admin", "manager", "storekeeper", "marketer", "callcenter"]}>
      {(user) => <DeliveryWorkspace mode="dashboard" user={user} />}
    </AppShell>
  );
}
