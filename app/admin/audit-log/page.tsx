"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Search, ShieldCheck } from "lucide-react";
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
  const [filters, setFilters] = useState({
    action: "",
    company: "",
    date: "",
    module: "",
    query: "",
    user: ""
  });

  useEffect(() => {
    setEntries(getAuditLog());
  }, []);

  const filteredEntries = useMemo(() => {
    const query = filters.query.trim().toLowerCase();

    return entries.filter((entry) => {
      const searchable = [
        entry.id,
        entry.username,
        entry.performedBy,
        entry.role,
        entry.companyName,
        entry.module,
        entry.action,
        entry.recordId,
        entry.reason,
        entry.oldValue,
        entry.newValue,
        entry.status
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (filters.date && entry.date !== filters.date) return false;
      if (filters.user && (entry.username ?? entry.performedBy) !== filters.user) return false;
      if (filters.company && entry.companyName !== filters.company) return false;
      if (filters.module && entry.module !== filters.module) return false;
      if (filters.action && entry.action !== filters.action) return false;
      if (query && !searchable.includes(query)) return false;
      return true;
    });
  }, [entries, filters]);

  const users = unique(entries.map((entry) => entry.username ?? entry.performedBy).filter(Boolean));
  const companies = unique(entries.map((entry) => entry.companyName).filter(isString));
  const modules = unique(entries.map((entry) => entry.module).filter(isString));
  const actions = unique(entries.map((entry) => entry.action).filter(Boolean));

  function updateFilter(field: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function exportCsv() {
    const headers = [
      "id",
      "date",
      "time",
      "userId",
      "username",
      "role",
      "companyId",
      "companyName",
      "module",
      "action",
      "recordId",
      "oldValue",
      "newValue",
      "reason",
      "status"
    ];
    const rows = filteredEntries.map((entry) =>
      headers.map((header) => csvCell(String((entry as unknown as Record<string, string | undefined>)[header] ?? ""))).join(",")
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `kingapp-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-950">Audit Trail</h2>
              <p className="mt-1 text-sm text-slate-600">
                Read-only record of who did what, when, and in which company.
              </p>
            </div>
          </div>
          <button className="primary-button" onClick={exportCsv} type="button">
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <label className="relative md:col-span-2 xl:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="form-input pl-10"
              onChange={(event) => updateFilter("query", event.target.value)}
              placeholder="Search audit log..."
              value={filters.query}
            />
          </label>
          <input className="form-input" onChange={(event) => updateFilter("date", event.target.value)} type="date" value={filters.date} />
          <SelectFilter label="All users" onChange={(value) => updateFilter("user", value)} options={users} value={filters.user} />
          <SelectFilter label="All companies" onChange={(value) => updateFilter("company", value)} options={companies} value={filters.company} />
          <SelectFilter label="All modules" onChange={(value) => updateFilter("module", value)} options={modules} value={filters.module} />
          <SelectFilter label="All actions" onChange={(value) => updateFilter("action", value)} options={actions} value={filters.action} />
        </div>
      </section>

      <section className="rounded-lg border border-brand-100 bg-white shadow-sm">
        {filteredEntries.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm font-semibold text-slate-500">
            No audit records yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[1500px]">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>Company</th>
                  <th>Module</th>
                  <th>Action</th>
                  <th>Record ID</th>
                  <th>Old Value</th>
                  <th>New Value</th>
                  <th>Reason</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <p className="font-bold text-slate-950">{formatDateTime(entry.createdAt)}</p>
                      <p className="text-xs text-slate-500">{entry.id}</p>
                    </td>
                    <td>
                      <p className="font-bold text-slate-950">{entry.username ?? entry.performedBy}</p>
                      <p className="text-xs text-slate-500">{entry.userId || "No user id"}</p>
                    </td>
                    <td>{entry.role ?? entry.performedByRole}</td>
                    <td>
                      <p>{entry.companyName || "No company"}</p>
                      <p className="text-xs text-slate-500">{entry.companyId || "-"}</p>
                    </td>
                    <td>{entry.module}</td>
                    <td><span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-black text-brand-700">{humanAction(entry.action)}</span></td>
                    <td>{entry.recordId}</td>
                    <td className="max-w-xs truncate">{entry.oldValue || "-"}</td>
                    <td className="max-w-xs truncate">{entry.newValue || "-"}</td>
                    <td className="max-w-sm">{entry.reason || "-"}</td>
                    <td><StatusBadge status={entry.status ?? "success"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function SelectFilter({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: string[]; value: string }) {
  return (
    <select className="form-input" onChange={(event) => onChange(event.target.value)} value={value}>
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className = status === "success"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : status === "failed"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-amber-200 bg-amber-50 text-amber-700";

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${className}`}>{status}</span>;
}

function unique(values: string[]) {
  return Array.from(new Set(values)).sort((first, second) => first.localeCompare(second));
}

function isString(value: string | undefined): value is string {
  return Boolean(value);
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function humanAction(action: string) {
  return action.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
