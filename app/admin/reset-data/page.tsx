"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { businessDataResetKeys, resetBusinessData } from "@/lib/reset-data";

const confirmationText =
  "Are you sure you want to clear all business data? This cannot be undone.";

export default function ResetDataPage() {
  return (
    <AppShell allowedRoles={["admin"]}>
      {() => <ResetDataContent />}
    </AppShell>
  );
}

function ResetDataContent() {
  const [confirmed, setConfirmed] = useState(false);
  const [typedConfirmation, setTypedConfirmation] = useState("");
  const [message, setMessage] = useState("");

  function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!confirmed || typedConfirmation !== "RESET") {
      return;
    }

    const clearedKeys = resetBusinessData();
    setMessage(
      `Business data reset complete. ${clearedKeys.length.toLocaleString()} data stores were cleared.`
    );
    setConfirmed(false);
    setTypedConfirmation("");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-red-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-950">Reset Business Data</h2>
              <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-600">
                Clear demo and test transactions so KingApp can start fresh. This does not remove
                users, roles, permissions, products, company settings, or the app design.
              </p>
            </div>
          </div>
          <span className="w-fit rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black uppercase tracking-normal text-red-700">
            Admin only
          </span>
        </div>
      </section>

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <form className="rounded-lg border border-red-200 bg-white p-5 shadow-sm" onSubmit={handleReset}>
          <h3 className="text-lg font-black text-slate-950">Confirm Reset</h3>
          <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
            {confirmationText}
          </p>

          <label className="mt-5 flex items-start gap-3 rounded-lg border border-slate-200 p-4">
            <input
              checked={confirmed}
              className="mt-1 h-4 w-4 accent-brand-700"
              onChange={(event) => setConfirmed(event.target.checked)}
              type="checkbox"
            />
            <span className="text-sm font-semibold text-slate-700">
              I understand this will permanently clear business transaction data from this app.
            </span>
          </label>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              Type RESET to continue
            </span>
            <input
              className="form-input"
              onChange={(event) => setTypedConfirmation(event.target.value)}
              placeholder="RESET"
              value={typedConfirmation}
            />
          </label>

          <button
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={!confirmed || typedConfirmation !== "RESET"}
            type="submit"
          >
            <RefreshCcw className="h-4 w-4" />
            Clear all business data
          </button>
        </form>

        <div className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-950">Data Removed</h3>
          <ul className="mt-4 space-y-2 text-sm font-semibold text-slate-700">
            <li>Sales entries and saved client sales data</li>
            <li>Confirmations and loaded stock records</li>
            <li>Returns, damages, and stock variance records</li>
            <li>Cash collection records</li>
            <li>Expenses and generated report source data</li>
            <li>Finished goods inventory movements</li>
            <li>Raw material movements</li>
            <li>Audit log entries tied to cleared business records</li>
          </ul>

          <h3 className="mt-6 text-lg font-black text-slate-950">Data Kept</h3>
          <ul className="mt-4 space-y-2 text-sm font-semibold text-slate-700">
            <li>Users, roles, and custom permissions</li>
            <li>Product list, prices, and company settings</li>
            <li>Raw material minimum/reorder levels</li>
            <li>App layout, logo, PWA setup, and design</li>
          </ul>

          <details className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <summary className="cursor-pointer text-sm font-black text-slate-700">
              Technical data stores cleared
            </summary>
            <div className="mt-3 grid gap-1 text-xs font-semibold text-slate-500">
              {businessDataResetKeys.map((key) => (
                <span key={key}>{key}</span>
              ))}
            </div>
          </details>
        </div>
      </section>
    </div>
  );
}
