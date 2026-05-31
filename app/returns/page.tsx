"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { LockOpen, PackageCheck, Search, Send } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { SessionUser } from "@/lib/auth";
import { formatDate, statusChipClass } from "@/lib/loading-data";
import { getSalesRecords } from "@/lib/sales-data";
import type { SalesRecord } from "@/lib/sales-data";
import {
  getReturnRecords,
  submitReturnRecord,
  unlockReturnRecord
} from "@/lib/returns-data";
import type { ReturnRecord } from "@/lib/returns-data";

type DraftReturn = Record<string, string>;

export default function ReturnsPage() {
  return (
    <AppShell allowedRoles={["admin", "supervisor", "storekeeper"]}>
      {(user) => <ReturnsContent user={user} />}
    </AppShell>
  );
}

function ReturnsContent({ user }: { user: SessionUser }) {
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [returnRecords, setReturnRecords] = useState<ReturnRecord[]>([]);
  const [draftReturn, setDraftReturn] = useState<DraftReturn>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    date: "",
    marketer: "",
    product: ""
  });
  const [unlockRecordId, setUnlockRecordId] = useState("");
  const [unlockReason, setUnlockReason] = useState("");
  const [unlockError, setUnlockError] = useState("");

  useEffect(() => {
    const sales = getSalesRecords().filter(
      (record) => record.status === "sales_submitted"
    );
    const returns = getReturnRecords();
    setSalesRecords(sales);
    setReturnRecords(returns);
    setDraftReturn(
      returns.reduce<DraftReturn>((drafts, record) => {
        drafts[record.salesRecordId] = String(record.actualReturnCartons);
        return drafts;
      }, {})
    );
  }, []);

  const returnsBySalesId = useMemo(() => {
    return new Map(
      returnRecords.map((record) => [record.salesRecordId, record] as const)
    );
  }, [returnRecords]);

  const filteredSales = useMemo(() => {
    return salesRecords.filter((record) => {
      const matchesDate = !filters.date || record.date === filters.date;
      const matchesMarketer =
        !filters.marketer ||
        record.marketerName.toLowerCase().includes(filters.marketer.toLowerCase()) ||
        record.marketerUsername
          .toLowerCase()
          .includes(filters.marketer.toLowerCase());
      const matchesProduct =
        !filters.product ||
        record.productName.toLowerCase().includes(filters.product.toLowerCase());

      return matchesDate && matchesMarketer && matchesProduct;
    });
  }, [filters, salesRecords]);

  function getDraftReturnValue(salesRecord: SalesRecord) {
    const existingRecord = returnsBySalesId.get(salesRecord.id);
    const rawValue =
      draftReturn[salesRecord.id] ??
      (existingRecord ? String(existingRecord.actualReturnCartons) : "");
    const value = Number(rawValue);

    return Number.isFinite(value) ? value : 0;
  }

  function handleSubmitReturn(salesRecord: SalesRecord) {
    setMessage("");
    setError("");

    const existingRecord = returnsBySalesId.get(salesRecord.id);

    if (existingRecord?.locked) {
      setError("This return record is locked. Admin must unlock it before edits.");
      return;
    }

    const actualReturnCartons = Number(draftReturn[salesRecord.id]);

    if (!Number.isFinite(actualReturnCartons) || actualReturnCartons < 0) {
      setError("Actual return received must be zero or greater.");
      return;
    }

    const result = submitReturnRecord(
      salesRecord,
      actualReturnCartons,
      user,
      existingRecord
    );
    setReturnRecords(result.records);
    setDraftReturn((current) => ({
      ...current,
      [salesRecord.id]: String(result.record.actualReturnCartons)
    }));
    setMessage("Return received submitted and locked.");
  }

  function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUnlockError("");

    if (!unlockReason.trim()) {
      setUnlockError("Enter an unlock reason before continuing.");
      return;
    }

    setReturnRecords(unlockReturnRecord(unlockRecordId, unlockReason.trim(), user));
    setUnlockRecordId("");
    setUnlockReason("");
    setMessage("Return record unlocked.");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <PackageCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-950">
              Returns Receiving
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Receive physical returns and control stock variance.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
          <Search className="h-4 w-4 text-brand-700" />
          Filter return records
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <FilterField label="Date">
            <input
              className="form-input"
              onChange={(event) =>
                setFilters((current) => ({ ...current, date: event.target.value }))
              }
              type="date"
              value={filters.date}
            />
          </FilterField>
          <FilterField label="Marketer">
            <input
              className="form-input"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  marketer: event.target.value
                }))
              }
              placeholder="Search marketer"
              value={filters.marketer}
            />
          </FilterField>
          <FilterField label="Product">
            <input
              className="form-input"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  product: event.target.value
                }))
              }
              placeholder="Search product"
              value={filters.product}
            />
          </FilterField>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="hidden overflow-hidden rounded-lg border border-brand-100 bg-white shadow-sm xl:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-brand-50 text-xs font-bold uppercase tracking-normal text-brand-900">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Item Code</th>
              <th className="px-4 py-3">Marketer</th>
              <th className="px-4 py-3 text-right">Loaded</th>
              <th className="px-4 py-3 text-right">Sold</th>
              <th className="px-4 py-3 text-right">Expected Return</th>
              <th className="px-4 py-3 text-right">Actual Return</th>
              <th className="px-4 py-3 text-right">Stock Variance</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredSales.map((salesRecord) => (
              <ReturnRow
                draftReturn={draftReturn}
                getDraftReturnValue={getDraftReturnValue}
                handleSubmitReturn={handleSubmitReturn}
                key={salesRecord.id}
                returnRecord={returnsBySalesId.get(salesRecord.id)}
                salesRecord={salesRecord}
                setDraftReturn={setDraftReturn}
                setUnlockRecordId={setUnlockRecordId}
                user={user}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 xl:hidden">
        {filteredSales.map((salesRecord) => (
          <ReturnCard
            draftReturn={draftReturn}
            getDraftReturnValue={getDraftReturnValue}
            handleSubmitReturn={handleSubmitReturn}
            key={salesRecord.id}
            returnRecord={returnsBySalesId.get(salesRecord.id)}
            salesRecord={salesRecord}
            setDraftReturn={setDraftReturn}
            setUnlockRecordId={setUnlockRecordId}
            user={user}
          />
        ))}
      </div>

      {filteredSales.length === 0 ? (
        <div className="rounded-lg border border-dashed border-brand-200 bg-white px-5 py-8 text-center text-sm font-semibold text-slate-500">
          No sales submitted records are ready for returns receiving.
        </div>
      ) : null}

      {unlockRecordId ? (
        <div className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
          <form className="space-y-3" onSubmit={handleUnlock}>
            <div>
              <h3 className="font-bold text-slate-950">Unlock return record</h3>
              <p className="mt-1 text-sm text-slate-600">
                A reason is required and will be saved in the audit log.
              </p>
            </div>
            <textarea
              className="min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
              onChange={(event) => setUnlockReason(event.target.value)}
              placeholder="Reason for return unlock"
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

type ReturnDisplayProps = {
  draftReturn: DraftReturn;
  getDraftReturnValue: (salesRecord: SalesRecord) => number;
  handleSubmitReturn: (salesRecord: SalesRecord) => void;
  returnRecord?: ReturnRecord;
  salesRecord: SalesRecord;
  setDraftReturn: React.Dispatch<React.SetStateAction<DraftReturn>>;
  setUnlockRecordId: (recordId: string) => void;
  user: SessionUser;
};

function ReturnRow(props: ReturnDisplayProps) {
  const {
    draftReturn,
    getDraftReturnValue,
    handleSubmitReturn,
    returnRecord,
    salesRecord,
    setDraftReturn,
    setUnlockRecordId,
    user
  } = props;
  const actualReturn = getDraftReturnValue(salesRecord);
  const variance = salesRecord.expectedReturnCartons - actualReturn;
  const isLocked = Boolean(returnRecord?.locked);

  return (
    <tr>
      <td className="px-4 py-3 text-slate-700">{formatDate(salesRecord.date)}</td>
      <td className="px-4 py-3 font-semibold text-slate-950">
        {salesRecord.productName}
      </td>
      <td className="px-4 py-3 text-slate-700">{salesRecord.itemCode}</td>
      <td className="px-4 py-3 text-slate-700">{salesRecord.marketerName}</td>
      <td className="px-4 py-3 text-right">{salesRecord.loadedCartons}</td>
      <td className="px-4 py-3 text-right font-semibold">
        {salesRecord.soldCartons}
      </td>
      <td className="px-4 py-3 text-right font-semibold text-slate-950">
        {salesRecord.expectedReturnCartons}
      </td>
      <td className="px-4 py-3">
        <input
          className="form-input ml-auto max-w-32 text-right"
          disabled={user.role !== "storekeeper" || isLocked}
          min="0"
          onChange={(event) =>
            setDraftReturn((current) => ({
              ...current,
              [salesRecord.id]: event.target.value
            }))
          }
          type="number"
          value={draftReturn[salesRecord.id] ?? ""}
        />
      </td>
      <td className={`px-4 py-3 text-right font-bold ${varianceClass(variance)}`}>
        {varianceLabel(variance)}
      </td>
      <td className="px-4 py-3">
        <ReturnStatusChip returnRecord={returnRecord} />
      </td>
      <td className="px-4 py-3">
        <ReturnAction
          handleSubmitReturn={handleSubmitReturn}
          isLocked={isLocked}
          returnRecord={returnRecord}
          salesRecord={salesRecord}
          setUnlockRecordId={setUnlockRecordId}
          user={user}
        />
      </td>
    </tr>
  );
}

function ReturnCard(props: ReturnDisplayProps) {
  const {
    draftReturn,
    getDraftReturnValue,
    handleSubmitReturn,
    returnRecord,
    salesRecord,
    setDraftReturn,
    setUnlockRecordId,
    user
  } = props;
  const actualReturn = getDraftReturnValue(salesRecord);
  const variance = salesRecord.expectedReturnCartons - actualReturn;
  const isLocked = Boolean(returnRecord?.locked);

  return (
    <article className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-950">{salesRecord.productName}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {salesRecord.itemCode} - {formatDate(salesRecord.date)}
          </p>
        </div>
        <ReturnStatusChip returnRecord={returnRecord} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Info label="Marketer" value={salesRecord.marketerName} />
        <Info label="Loaded" value={salesRecord.loadedCartons.toLocaleString()} />
        <Info label="Sold" value={salesRecord.soldCartons.toLocaleString()} />
        <Info
          label="Expected Return"
          value={salesRecord.expectedReturnCartons.toLocaleString()}
        />
      </div>
      <label className="mt-4 block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Actual return received
        </span>
        <input
          className="form-input"
          disabled={user.role !== "storekeeper" || isLocked}
          min="0"
          onChange={(event) =>
            setDraftReturn((current) => ({
              ...current,
              [salesRecord.id]: event.target.value
            }))
          }
          type="number"
          value={draftReturn[salesRecord.id] ?? ""}
        />
      </label>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Metric
          label="Expected"
          value={salesRecord.expectedReturnCartons.toLocaleString()}
        />
        <Metric label="Actual" value={actualReturn.toLocaleString()} />
        <Metric
          label="Variance"
          value={varianceLabel(variance)}
          warning={variance !== 0}
        />
      </div>
      <div className="mt-4">
        <ReturnAction
          handleSubmitReturn={handleSubmitReturn}
          isLocked={isLocked}
          returnRecord={returnRecord}
          salesRecord={salesRecord}
          setUnlockRecordId={setUnlockRecordId}
          user={user}
        />
      </div>
    </article>
  );
}

function ReturnAction({
  handleSubmitReturn,
  isLocked,
  returnRecord,
  salesRecord,
  setUnlockRecordId,
  user
}: {
  handleSubmitReturn: (salesRecord: SalesRecord) => void;
  isLocked: boolean;
  returnRecord?: ReturnRecord;
  salesRecord: SalesRecord;
  setUnlockRecordId: (recordId: string) => void;
  user: SessionUser;
}) {
  if (user.role === "admin" || user.role === "supervisor") {
    if (returnRecord?.locked) {
      return (
        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-brand-200 px-3 py-2 text-sm font-bold text-brand-800 transition hover:bg-brand-50"
          onClick={() => setUnlockRecordId(returnRecord.id)}
          type="button"
        >
          <LockOpen className="h-4 w-4" />
          Unlock
        </button>
      );
    }

    return (
      <span className="text-xs font-semibold text-slate-500">
        {returnRecord ? "View only" : "No return yet"}
      </span>
    );
  }

  if (isLocked) {
    return (
      <span className="inline-flex rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">
        Locked after submission
      </span>
    );
  }

  return (
    <button
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-800"
      onClick={() => handleSubmitReturn(salesRecord)}
      type="button"
    >
      <Send className="h-4 w-4" />
      Submit return
    </button>
  );
}

function ReturnStatusChip({ returnRecord }: { returnRecord?: ReturnRecord }) {
  if (!returnRecord) {
    return (
      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700">
        Not Received
      </span>
    );
  }

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
        returnRecord.locked
          ? statusChipClass("confirmed")
          : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
    >
      {returnRecord.locked ? "Return Received" : "Unlocked"}
    </span>
  );
}

function varianceLabel(variance: number) {
  if (!Number.isFinite(variance) || variance === 0) {
    return "0";
  }

  if (variance > 0) {
    return `${variance} shortage`;
  }

  return `+${Math.abs(variance)} excess`;
}

function varianceClass(variance: number) {
  if (variance === 0) {
    return "text-brand-800";
  }

  return "text-red-700";
}

function FilterField({
  children,
  label
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-normal text-slate-500">
        {label}
      </span>
      {children}
    </label>
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

function Metric({
  label,
  value,
  warning = false
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className={`rounded-lg px-3 py-2 ${warning ? "bg-red-50" : "bg-brand-50"}`}>
      <span
        className={`block text-xs font-semibold ${
          warning ? "text-red-700" : "text-brand-800"
        }`}
      >
        {label}
      </span>
      <span
        className={`mt-1 block font-bold ${
          warning ? "text-red-800" : "text-brand-900"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
