"use client";

import { AppShell } from "@/components/AppShell";
import { CustomerAccountsWorkspace } from "@/components/CustomerAccountsWorkspace";

export default function CustomerDebtsPage() {
  return (
    <AppShell allowedRoles={["admin", "manager", "accountant", "callcenter"]}>
      {(user) => <CustomerAccountsWorkspace mode="debts" user={user} />}
    </AppShell>
  );
}
