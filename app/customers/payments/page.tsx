"use client";

import { AppShell } from "@/components/AppShell";
import { CustomerAccountsWorkspace } from "@/components/CustomerAccountsWorkspace";

export default function CustomerPaymentsPage() {
  return (
    <AppShell allowedRoles={["admin", "accountant"]}>
      {(user) => <CustomerAccountsWorkspace mode="payments" user={user} />}
    </AppShell>
  );
}
