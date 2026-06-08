"use client";

import { AppShell } from "@/components/AppShell";
import { DeliveryWorkspace } from "@/components/DeliveryWorkspace";

export default function DeliveryRoutesPage() {
  return (
    <AppShell allowedRoles={["admin", "manager", "storekeeper", "marketer", "callcenter"]}>
      {(user) => <DeliveryWorkspace mode="routes" user={user} />}
    </AppShell>
  );
}
