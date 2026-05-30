"use client";

import { FormEvent, useMemo, useState } from "react";
import { LockOpen, Search } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import type { LoadingRecord } from "@/lib/loading-data";
import {
  formatDate,
  statusChipClass,
  statusLabels,
  unlockLoadingRecord
} from "@/lib/loading-data";

type LoadingRecordsViewProps = {
  records: LoadingRecord[];
  user: SessionUser;
  onRecordsChange: (records: LoadingRecord[]) => void;
  showAdminFilters?: boolean;
  emptyMessage?: string;
};

export function LoadingRecordsView({
  records,
  user,
  onRecordsChange,
  showAdminFilters = false,
  emptyMessage = "No loading records yet."
}: LoadingRecordsViewProps) {
  const [filters, setFilters] = useState({
    date: "",
    marketer: "",
    product: ""
  });
  const [unlockRecordId, setUnlockRecordId] = useState("");
  const [unlockReason, setUnlockReason] = useState("");
  const [unlockError, setUnlockError] = useState("");

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchesDate = !filters.date || record.date === filters.date;
      const matchesMarketer =
        !filters.marketer ||
        record.marketerUsername
          .toLowerCase()
          .includes(filters.marketer.toLowerCase()) ||
        record.marketerName.toLowerCase().includes(filters.marketer.toLowerCase());
      const matchesProduct =
        !filters.product ||
        record.productName.toLowerCase().includes(filters.product.toLowerCase());

      return matchesDate && matchesMarketer && matchesProduct;
    });
  }, [filters, records]);

  function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUnlockError("");

    if (!unlockReason.trim()) {
      setUnlockError("Enter an unlock reason before continuing.");
      return;
    }

    const updatedRecords = unlockLoadingRecord(
      unlockRecordId,
      unlockReason.trim(),
      user
    );
    onRecordsChange(updatedRecords);
    setUnlockRecordId("");
    setUnlockReason("");
  }

  return (
    <div className="space-y-4">
      {showAdminFilters ? (
        <div className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
            <Search className="h-4 w-4 text-brand-700" />
            Filter loading records
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-normal text-slate-500">
                Date
              </span>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
                onChange={(event) =>
                  setFilters((current) => ({ ...current, date: event.target.value }))
                }
                type="date"
                value={filters.date}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-normal text-slate-500">
                Marketer
              </span>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    marketer: event.target.value
                  }))
                }
                placeholder="Search marketer"
                value={filters.marketer}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-normal text-slate-500">
                Product
              </span>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    product: event.target.value
                  }))
                }
                placeholder="Search product"
                value={filters.product}
              />
            </label>
          </div>
        </div>
      ) : null}

      <div className="hidden overflow-hidden rounded-lg border border-brand-100 bg-white shadow-sm lg:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-brand-50 text-xs font-bold uppercase tracking-normal text-brand-900">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Item Code</th>
              <th className="px-4 py-3">Marketer</th>
              <th className="px-4 py-3">Truck</th>
              <th className="px-4 py-3 text-right">Cartons</th>
              <th className="px-4 py-3">Status</th>
              {user.role === "admin" ? <th className="px-4 py-3">Admin</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRecords.map((record) => (
              <tr key={record.id}>
                <td className="px-4 py-3 text-slate-700">{formatDate(record.date)}</td>
                <td className="px-4 py-3 font-semibold text-slate-950">
                  {record.productName}
                </td>
                <td className="px-4 py-3 text-slate-700">{record.itemCode}</td>
                <td className="px-4 py-3 text-slate-700">{record.marketerName}</td>
                <td className="px-4 py-3 text-slate-700">{record.truck}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-950">
                  {record.loadedCartons.toLocaleString()}
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
                {user.role === "admin" ? (
                  <td className="px-4 py-3">
                    {record.locked ? (
                      <button
                        className="inline-flex items-center gap-2 rounded-lg border border-brand-200 px-3 py-2 text-xs font-bold text-brand-800 transition hover:bg-brand-50"
                        onClick={() => setUnlockRecordId(record.id)}
                        type="button"
                      >
                        <LockOpen className="h-4 w-4" />
                        Unlock
                      </button>
                    ) : (
                      <span className="text-xs font-semibold text-slate-500">
                        Unlocked
                      </span>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:hidden">
        {filteredRecords.map((record) => (
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
              <div>
                <span className="block text-xs font-semibold uppercase tracking-normal text-slate-500">
                  Marketer
                </span>
                <span className="font-semibold text-slate-900">
                  {record.marketerName}
                </span>
              </div>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-normal text-slate-500">
                  Truck
                </span>
                <span className="font-semibold text-slate-900">{record.truck}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-normal text-slate-500">
                  Cartons
                </span>
                <span className="font-semibold text-slate-900">
                  {record.loadedCartons.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-normal text-slate-500">
                  Storekeeper
                </span>
                <span className="font-semibold text-slate-900">
                  {record.storekeeperName}
                </span>
              </div>
            </div>
            {record.rejectionReason ? (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {record.rejectionReason}
              </p>
            ) : null}
            {user.role === "admin" && record.locked ? (
              <button
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-brand-200 px-3 py-2 text-sm font-bold text-brand-800 transition hover:bg-brand-50"
                onClick={() => setUnlockRecordId(record.id)}
                type="button"
              >
                <LockOpen className="h-4 w-4" />
                Unlock
              </button>
            ) : null}
          </article>
        ))}
      </div>

      {filteredRecords.length === 0 ? (
        <div className="rounded-lg border border-dashed border-brand-200 bg-white px-5 py-8 text-center text-sm font-semibold text-slate-500">
          {emptyMessage}
        </div>
      ) : null}

      {unlockRecordId ? (
        <div className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
          <form className="space-y-3" onSubmit={handleUnlock}>
            <div>
              <h3 className="font-bold text-slate-950">Unlock confirmed record</h3>
              <p className="mt-1 text-sm text-slate-600">
                A reason is required and will be saved in the audit log.
              </p>
            </div>
            <textarea
              className="min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
              onChange={(event) => setUnlockReason(event.target.value)}
              placeholder="Reason for unlock"
              value={unlockReason}
            />
            {unlockError ? (
              <p className="text-sm font-semibold text-red-700">{unlockError}</p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                className="inline-flex items-center justify-center rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-800"
                type="submit"
              >
                Save unlock
              </button>
              <button
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setUnlockRecordId("");
                  setUnlockReason("");
                  setUnlockError("");
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
