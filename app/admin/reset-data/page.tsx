"use client";

import { FormEvent, useMemo, useState } from "react";
import { AlertTriangle, RefreshCcw, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { SessionUser } from "@/lib/auth";
import {
  businessDataResetKeys,
  deleteHistoricalData,
  historicalDeleteOptions,
  resetBusinessData,
  type HistoricalDeleteOption
} from "@/lib/reset-data";
import { getUsers } from "@/lib/users-data";

const warningText =
  "WARNING: You are about to permanently delete historical business records. This action cannot be undone.";

export default function ResetDataPage() {
  return (
    <AppShell allowedRoles={["admin"]}>
      {(user) => <HistoricalDataContent user={user} />}
    </AppShell>
  );
}

function HistoricalDataContent({ user }: { user: SessionUser }) {
  const [selectedKey, setSelectedKey] = useState<HistoricalDeleteOption["key"]>("sales");
  const [adminPassword, setAdminPassword] = useState("");
  const [finalConfirmed, setFinalConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selectedOption = useMemo(
    () => historicalDeleteOptions.find((option) => option.key === selectedKey) ?? historicalDeleteOptions[0],
    [selectedKey]
  );

  function validateAdminPassword() {
    const adminUser = getUsers().find((record) => record.username === user.username);
    return Boolean(adminUser && adminUser.password === adminPassword);
  }

  function clearConfirmation() {
    setAdminPassword("");
    setFinalConfirmed(false);
  }

  function runDelete(option: HistoricalDeleteOption) {
    setMessage("");
    setError("");

    if (!validateAdminPassword()) {
      setError("Admin password confirmation is incorrect.");
      return;
    }

    if (!finalConfirmed) {
      setError("Final confirmation is required before deleting historical records.");
      return;
    }

    const deletedKeys = deleteHistoricalData(option, user);
    setMessage(`${option.label} complete. ${deletedKeys.length.toLocaleString()} data store(s) cleared and audit logged.`);
    clearConfirmation();
  }

  function handleSelectedDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runDelete(selectedOption);
  }

  function handleFullReset() {
    setMessage("");
    setError("");

    if (!validateAdminPassword()) {
      setError("Admin password confirmation is incorrect.");
      return;
    }

    if (!finalConfirmed) {
      setError("Final confirmation is required before deleting all historical data.");
      return;
    }

    const deletedKeys = resetBusinessData(user);
    setMessage(`Delete Everything and Restart complete. ${deletedKeys.length.toLocaleString()} data store(s) cleared and audit logged.`);
    clearConfirmation();
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
              <h2 className="text-2xl font-black text-slate-950">
                Historical Data Management
              </h2>
              <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-600">
                Delete selected historical business data or restart the business dataset while keeping users,
                roles, permissions, products, company settings, and the app design.
              </p>
            </div>
          </div>
          <span className="w-fit rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black uppercase tracking-normal text-red-700">
            Admin permission required
          </span>
        </div>
      </section>

      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-black uppercase tracking-normal text-red-800">
        {warningText}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
        <form className="rounded-lg border border-red-200 bg-white p-5 shadow-sm" onSubmit={handleSelectedDelete}>
          <h3 className="text-lg font-black text-slate-950">Delete Selected Report</h3>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            Choose exactly which historical records to remove.
          </p>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              Historical data type
            </span>
            <select
              className="form-input"
              onChange={(event) => setSelectedKey(event.target.value as HistoricalDeleteOption["key"])}
              value={selectedKey}
            >
              {historicalDeleteOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-800">{selectedOption.description}</p>
            <div className="mt-3 grid gap-1 text-xs font-semibold text-slate-500">
              {selectedOption.localStorageKeys.map((key) => (
                <span key={key}>{key}</span>
              ))}
            </div>
          </div>

          <ConfirmationFields
            adminPassword={adminPassword}
            finalConfirmed={finalConfirmed}
            setAdminPassword={setAdminPassword}
            setFinalConfirmed={setFinalConfirmed}
          />

          <button
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={!adminPassword || !finalConfirmed}
            type="submit"
          >
            <Trash2 className="h-4 w-4" />
            Delete Selected Report
          </button>
        </form>

        <div className="rounded-lg border border-red-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-950">Delete All Historical Data</h3>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            This clears all business history and restarts operations from a clean dataset.
          </p>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-800">
              Delete Everything and Restart
            </p>
            <div className="mt-3 grid gap-1 text-xs font-semibold text-slate-500">
              {businessDataResetKeys.map((key) => (
                <span key={key}>{key}</span>
              ))}
            </div>
          </div>

          <button
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-800 px-4 py-2.5 text-sm font-black text-white transition hover:bg-red-900 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={!adminPassword || !finalConfirmed}
            onClick={handleFullReset}
            type="button"
          >
            <RefreshCcw className="h-4 w-4" />
            Delete All Historical Data
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-black text-slate-950">Permission Rules</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <RuleCard title="Admin" text="Can delete, reset, correct, unlock, and audit historical data." />
          <RuleCard title="Manager" text="Can view historical reports only. Cannot delete or modify historical records." />
          <RuleCard title="Storekeeper" text="Cannot delete historical records." />
          <RuleCard title="Accountant / Marketer" text="Cannot delete historical records." />
        </div>
      </section>
    </div>
  );
}

function ConfirmationFields({
  adminPassword,
  finalConfirmed,
  setAdminPassword,
  setFinalConfirmed
}: {
  adminPassword: string;
  finalConfirmed: boolean;
  setAdminPassword: (value: string) => void;
  setFinalConfirmed: (value: boolean) => void;
}) {
  return (
    <>
      <label className="mt-5 block">
        <span className="mb-2 block text-sm font-bold text-slate-700">
          Admin password confirmation
        </span>
        <input
          className="form-input"
          onChange={(event) => setAdminPassword(event.target.value)}
          placeholder="Enter your admin password"
          type="password"
          value={adminPassword}
        />
      </label>

      <label className="mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
        <input
          checked={finalConfirmed}
          className="mt-1 h-4 w-4 accent-red-700"
          onChange={(event) => setFinalConfirmed(event.target.checked)}
          type="checkbox"
        />
        <span className="text-sm font-bold text-red-800">
          Final confirmation: permanently delete the selected historical records.
        </span>
      </label>
    </>
  );
}

function RuleCard({ text, title }: { text: string; title: string }) {
  return (
    <article className="rounded-lg border border-brand-100 bg-brand-50 p-4">
      <h4 className="font-black text-brand-950">{title}</h4>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{text}</p>
    </article>
  );
}
