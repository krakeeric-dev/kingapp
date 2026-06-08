"use client";

import { AppShell } from "@/components/AppShell";
import { DeliveryWorkspace } from "@/components/DeliveryWorkspace";

export default function DeliveryReportsPage() {
  return (
    <AppShell allowedRoles={["admin", "manager"]}>
      {(user) => <DeliveryWorkspace mode="reports" user={user} />}
    </AppShell>
  );
}
