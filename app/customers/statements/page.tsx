"use client";

import { AppShell } from "@/components/AppShell";
import { CustomerAccountsWorkspace } from "@/components/CustomerAccountsWorkspace";

export default function CustomerStatementsPage() {
  return (
    <AppShell allowedRoles={["admin", "manager", "accountant"]}>
      {(user) => <CustomerAccountsWorkspace mode="statements" user={user} />}
    </AppShell>
  );
}
