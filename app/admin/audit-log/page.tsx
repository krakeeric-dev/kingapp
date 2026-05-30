"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { AuditLogEntry } from "@/lib/loading-data";
import { formatDateTime, getAuditLog } from "@/lib/loading-data";

export default function AuditLogPage() {
  return (
    <AppShell allowedRoles={["admin"]}>
      {() => <AuditLogContent />}
    </AppShell>
  );
}

function AuditLogContent() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    setEntries(getAuditLog());
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-950">Audit Log</h2>
            <p className="mt-1 text-sm text-slate-600">
              Unlock, adjustment, and price change actions are recorded here.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-brand-100 bg-white shadow-sm">
        {entries.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm font-semibold text-slate-500">
            No audit log entries yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {entries.map((entry) => (
              <article className="p-5" key={entry.id}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="font-bold text-slate-950">
                    {entry.action === "price_change"
                      ? "Price changed"
                      : entry.action === "inventory_adjustment"
                        ? "Inventory adjustment"
                        : entry.action === "unlock_expenses"
                          ? "Expense record unlocked"
                          : entry.action === "unlock_return"
                            ? "Return record unlocked"
                            : entry.action === "unlock_cash"
                              ? "Cash record unlocked"
                              : entry.action === "unlock_sales"
                                ? "Sales record unlocked"
                                : "Loading record unlocked"}
                    : {entry.recordId}
                  </h3>
                  <span className="text-sm font-semibold text-slate-500">
                    {formatDateTime(entry.createdAt)}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {entry.reason}
                </p>
                <p className="mt-3 text-xs font-bold uppercase tracking-normal text-brand-700">
                  {entry.performedBy} - {entry.performedByRole}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
