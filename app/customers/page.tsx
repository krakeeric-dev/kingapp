"use client";

import { AppShell } from "@/components/AppShell";
import { CustomerAccountsWorkspace } from "@/components/CustomerAccountsWorkspace";

export default function CustomersPage() {
  return (
    <AppShell allowedRoles={["admin", "manager", "accountant", "callcenter"]}>
      {(user) => <CustomerAccountsWorkspace mode="accounts" user={user} />}
    </AppShell>
  );
}
