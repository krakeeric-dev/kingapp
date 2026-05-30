"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { SessionUser } from "@/lib/auth";
import type { LoadingRecord } from "@/lib/loading-data";
import {
  formatDate,
  getLoadingRecords,
  saveLoadingRecords,
  statusChipClass,
  statusLabels
} from "@/lib/loading-data";

export default function ConfirmLoadingPage() {
  return (
    <AppShell allowedRoles={["admin", "marketer"]}>
      {(user) => <ConfirmLoadingContent user={user} />}
    </AppShell>
  );
}

function ConfirmLoadingContent({ user }: { user: SessionUser }) {
  const [records, setRecords] = useState<LoadingRecord[]>([]);
  const [activeRejectId, setActiveRejectId] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setRecords(getLoadingRecords());
  }, []);

  const visibleRecords = useMemo(() => {
    if (user.role === "admin") {
      return records;
    }

    return records.filter(
      (record) =>
        record.marketerUsername === user.username && record.status !== "draft"
    );
  }, [records, user.role, user.username]);

  function updateRecord(recordId: string, updates: Partial<LoadingRecord>) {
    const now = new Date().toISOString();
    const updatedRecords = records.map((record) =>
      record.id === recordId
        ? {
            ...record,
            ...updates,
            updatedAt: now
          }
        : record
    );
    saveLoadingRecords(updatedRecords);
    setRecords(updatedRecords);
  }

  function confirmRecord(recordId: string) {
    updateRecord(recordId, {
      status: "confirmed",
      locked: true,
      confirmedAt: new Date().toISOString(),
      rejectionReason: ""
    });
  }

  function rejectRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!rejectionReason.trim()) {
      setError("Enter a rejection reason before submitting.");
      return;
    }

    updateRecord(activeRejectId, {
      status: "rejected",
      locked: false,
      rejectedAt: new Date().toISOString(),
      rejectionReason: rejectionReason.trim()
    });
    setActiveRejectId("");
    setRejectionReason("");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-950">
              Confirm Loading
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Review assigned loading records and confirm or reject quantities.
            </p>
          </div>
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-brand-100 bg-white shadow-sm lg:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-brand-50 text-xs font-bold uppercase tracking-normal text-brand-900">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Item Code</th>
              <th className="px-4 py-3">Truck</th>
              <th className="px-4 py-3 text-right">Loaded Cartons</th>
              <th className="px-4 py-3">Storekeeper</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRecords.map((record) => (
              <tr key={record.id}>
                <td className="px-4 py-3 text-slate-700">{formatDate(record.date)}</td>
                <td className="px-4 py-3 font-semibold text-slate-950">
                  {record.productName}
                </td>
                <td className="px-4 py-3 text-slate-700">{record.itemCode}</td>
                <td className="px-4 py-3 text-slate-700">{record.truck}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-950">
                  {record.loadedCartons.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {record.storekeeperName}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusChipClass(
                      record.status
                    )}`}
                  >
                    {statusLabels[record.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <RecordActions
                    activeRejectId={activeRejectId}
                    confirmRecord={confirmRecord}
                    record={record}
                    setActiveRejectId={setActiveRejectId}
                    user={user}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:hidden">
        {visibleRecords.map((record) => (
          <article
            className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm"
            key={record.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-950">{record.productName}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {record.itemCode} · {formatDate(record.date)}
                </p>
              </div>
              <span
                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusChipClass(
                  record.status
                )}`}
              >
                {statusLabels[record.status]}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Info label="Truck" value={record.truck} />
              <Info
                label="Loaded"
                value={record.loadedCartons.toLocaleString()}
              />
              <Info label="Storekeeper" value={record.storekeeperName} />
              <Info label="Marketer" value={record.marketerName} />
            </div>
            {record.rejectionReason ? (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {record.rejectionReason}
              </p>
            ) : null}
            <div className="mt-4">
              <RecordActions
                activeRejectId={activeRejectId}
                confirmRecord={confirmRecord}
                record={record}
                setActiveRejectId={setActiveRejectId}
                user={user}
              />
            </div>
          </article>
        ))}
      </div>

      {visibleRecords.length === 0 ? (
        <div className="rounded-lg border border-dashed border-brand-200 bg-white px-5 py-8 text-center text-sm font-semibold text-slate-500">
          No loading records assigned yet.
        </div>
      ) : null}

      {activeRejectId ? (
        <div className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
          <form className="space-y-3" onSubmit={rejectRecord}>
            <div>
              <h3 className="font-bold text-slate-950">Reject loading record</h3>
              <p className="mt-1 text-sm text-slate-600">
                Add a clear reason so the storekeeper can correct and resubmit.
              </p>
            </div>
            <textarea
              className="min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="Quantity received does not match loaded cartons..."
              value={rejectionReason}
            />
            {error ? (
              <p className="text-sm font-semibold text-red-700">{error}</p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700"
                type="submit"
              >
                Submit rejection
              </button>
              <button
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setActiveRejectId("");
                  setRejectionReason("");
                  setError("");
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function RecordActions({
  activeRejectId,
  confirmRecord,
  record,
  setActiveRejectId,
  user
}: {
  activeRejectId: string;
  confirmRecord: (recordId: string) => void;
  record: LoadingRecord;
  setActiveRejectId: (recordId: string) => void;
  user: SessionUser;
}) {
  if (user.role === "admin") {
    return (
      <span className="text-xs font-semibold text-slate-500">
        Admin view only
      </span>
    );
  }

  if (record.status !== "pending") {
    return (
      <span className="text-xs font-semibold text-slate-500">
        No action needed
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
      <button
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-3 py-2 text-sm font-bold text-white transition hover:bg-brand-800"
        onClick={() => confirmRecord(record.id)}
        type="button"
      >
        <CheckCircle2 className="h-4 w-4" />
        Confirm quantity received
      </button>
      <button
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50"
        onClick={() => setActiveRejectId(activeRejectId === record.id ? "" : record.id)}
        type="button"
      >
        <XCircle className="h-4 w-4" />
        Reject
      </button>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-xs font-semibold uppercase tracking-normal text-slate-500">
        {label}
      </span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
