"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { FileText, LockOpen, Search, Send } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { SessionUser } from "@/lib/auth";
import {
  formatDate,
  getLoadingRecords,
  statusChipClass
} from "@/lib/loading-data";
import type { LoadingRecord } from "@/lib/loading-data";
import {
  formatMoney,
  getSalesRecords,
  submitSalesRecord,
  unlockSalesRecord
} from "@/lib/sales-data";
import type { SalesRecord } from "@/lib/sales-data";

type DraftSold = Record<string, string>;

export default function SalesPage() {
  return (
    <AppShell allowedRoles={["admin", "marketer"]}>
      {(user) => <SalesContent user={user} />}
    </AppShell>
  );
}

function SalesContent({ user }: { user: SessionUser }) {
  const [loadingRecords, setLoadingRecords] = useState<LoadingRecord[]>([]);
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [draftSold, setDraftSold] = useState<DraftSold>({});
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
    const loads = getLoadingRecords();
    const sales = getSalesRecords();
    setLoadingRecords(loads);
    setSalesRecords(sales);

    const initialDrafts = sales.reduce<DraftSold>((drafts, record) => {
      drafts[record.loadingRecordId] = String(record.soldCartons);
      return drafts;
    }, {});
    setDraftSold(initialDrafts);
  }, []);

  const confirmedLoads = useMemo(() => {
    return loadingRecords.filter((record) => {
      if (record.status !== "confirmed") {
        return false;
      }

      if (user.role === "marketer") {
        return record.marketerUsername === user.username;
      }

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
  }, [filters, loadingRecords, user.role, user.username]);

  const salesByLoadId = useMemo(() => {
    return new Map(
      salesRecords.map((record) => [record.loadingRecordId, record] as const)
    );
  }, [salesRecords]);

  function getDraftSold(load: LoadingRecord) {
    const existingRecord = salesByLoadId.get(load.id);
    const rawValue =
      draftSold[load.id] ?? (existingRecord ? String(existingRecord.soldCartons) : "");
    const value = Number(rawValue);

    return Number.isFinite(value) ? value : 0;
  }

  function handleSoldChange(loadId: string, value: string) {
    setDraftSold((current) => ({ ...current, [loadId]: value }));
  }

  function handleSubmitSales(load: LoadingRecord) {
    setMessage("");
    setError("");

    const existingRecord = salesByLoadId.get(load.id);

    if (existingRecord?.locked) {
      setError("This sales record is locked. Admin must unlock it before edits.");
      return;
    }

    const soldCartons = Number(draftSold[load.id]);

    if (!Number.isFinite(soldCartons) || soldCartons < 0) {
      setError("Sold cartons must be zero or greater.");
      return;
    }

    if (soldCartons > load.loadedCartons) {
      setError("Sold cartons cannot be greater than loaded cartons.");
      return;
    }

    const result = submitSalesRecord(load, soldCartons, existingRecord);
    setSalesRecords(result.records);
    setDraftSold((current) => ({
      ...current,
      [load.id]: String(result.record.soldCartons)
    }));
    setMessage("Sales submitted and locked.");
  }

  function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUnlockError("");

    if (!unlockReason.trim()) {
      setUnlockError("Enter an unlock reason before continuing.");
      return;
    }

    const updatedRecords = unlockSalesRecord(
      unlockRecordId,
      unlockReason.trim(),
      user
    );
    setSalesRecords(updatedRecords);
    setUnlockRecordId("");
    setUnlockReason("");
    setMessage("Sales record unlocked.");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-950">
              Sales & Returns
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Enter sold cartons from confirmed loads and calculate expected returns.
            </p>
          </div>
        </div>
      </div>

      {user.role === "admin" ? (
        <div className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
            <Search className="h-4 w-4 text-brand-700" />
            Filter sales records
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
      ) : null}

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
              <th className="px-4 py-3">Truck</th>
              <th className="px-4 py-3 text-right">Loaded</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Sold</th>
              <th className="px-4 py-3 text-right">Expected Return</th>
              <th className="px-4 py-3 text-right">Sales Value</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {confirmedLoads.map((load) => (
              <SalesRow
                draftSold={draftSold}
                getDraftSold={getDraftSold}
                handleSoldChange={handleSoldChange}
                handleSubmitSales={handleSubmitSales}
                key={load.id}
                load={load}
                salesRecord={salesByLoadId.get(load.id)}
                setUnlockRecordId={setUnlockRecordId}
                user={user}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 xl:hidden">
        {confirmedLoads.map((load) => (
          <SalesCard
            draftSold={draftSold}
            getDraftSold={getDraftSold}
            handleSoldChange={handleSoldChange}
            handleSubmitSales={handleSubmitSales}
            key={load.id}
            load={load}
            salesRecord={salesByLoadId.get(load.id)}
            setUnlockRecordId={setUnlockRecordId}
            user={user}
          />
        ))}
      </div>

      {confirmedLoads.length === 0 ? (
        <div className="rounded-lg border border-dashed border-brand-200 bg-white px-5 py-8 text-center text-sm font-semibold text-slate-500">
          No confirmed loading records are ready for sales entry.
        </div>
      ) : null}

      {unlockRecordId ? (
        <div className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
          <form className="space-y-3" onSubmit={handleUnlock}>
            <div>
              <h3 className="font-bold text-slate-950">Unlock sales record</h3>
              <p className="mt-1 text-sm text-slate-600">
                A reason is required and will be saved in the audit log.
              </p>
            </div>
            <textarea
              className="min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
              onChange={(event) => setUnlockReason(event.target.value)}
              placeholder="Reason for sales unlock"
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

function SalesRow({
  draftSold,
  getDraftSold,
  handleSoldChange,
  handleSubmitSales,
  load,
  salesRecord,
  setUnlockRecordId,
  user
}: SalesDisplayProps) {
  const soldCartons = getDraftSold(load);
  const expectedReturn = load.loadedCartons - soldCartons;
  const salesValue = soldCartons * load.pricePerCarton;
  const isLocked = Boolean(salesRecord?.locked);

  return (
    <tr>
      <td className="px-4 py-3 text-slate-700">{formatDate(load.date)}</td>
      <td className="px-4 py-3 font-semibold text-slate-950">
        {load.productName}
      </td>
      <td className="px-4 py-3 text-slate-700">{load.itemCode}</td>
      <td className="px-4 py-3 text-slate-700">{load.truck}</td>
      <td className="px-4 py-3 text-right font-semibold text-slate-950">
        {load.loadedCartons.toLocaleString()}
      </td>
      <td className="px-4 py-3 text-right text-slate-700">
        {formatMoney(load.pricePerCarton)}
      </td>
      <td className="px-4 py-3">
        <input
          className="form-input ml-auto max-w-28 text-right"
          disabled={user.role === "admin" || isLocked}
          min="0"
          onChange={(event) => handleSoldChange(load.id, event.target.value)}
          type="number"
          value={draftSold[load.id] ?? ""}
        />
      </td>
      <td className="px-4 py-3 text-right font-semibold text-slate-950">
        {Number.isFinite(expectedReturn) ? expectedReturn.toLocaleString() : "0"}
      </td>
      <td className="px-4 py-3 text-right font-semibold text-brand-800">
        {formatMoney(Number.isFinite(salesValue) ? salesValue : 0)}
      </td>
      <td className="px-4 py-3">
        <SalesStatusChip salesRecord={salesRecord} />
      </td>
      <td className="px-4 py-3">
        <SalesAction
          handleSubmitSales={handleSubmitSales}
          isLocked={isLocked}
          load={load}
          salesRecord={salesRecord}
          setUnlockRecordId={setUnlockRecordId}
          user={user}
        />
      </td>
    </tr>
  );
}

function SalesCard(props: SalesDisplayProps) {
  const {
    draftSold,
    getDraftSold,
    handleSoldChange,
    handleSubmitSales,
    load,
    salesRecord,
    setUnlockRecordId,
    user
  } = props;
  const soldCartons = getDraftSold(load);
  const expectedReturn = load.loadedCartons - soldCartons;
  const salesValue = soldCartons * load.pricePerCarton;
  const isLocked = Boolean(salesRecord?.locked);

  return (
    <article className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-950">{load.productName}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {load.itemCode} · {formatDate(load.date)}
          </p>
        </div>
        <SalesStatusChip salesRecord={salesRecord} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Info label="Truck" value={load.truck} />
        <Info label="Loaded" value={load.loadedCartons.toLocaleString()} />
        <Info label="Price" value={formatMoney(load.pricePerCarton)} />
        <Info label="Marketer" value={load.marketerName} />
      </div>
      <label className="mt-4 block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Sold cartons
        </span>
        <input
          className="form-input"
          disabled={user.role === "admin" || isLocked}
          min="0"
          onChange={(event) => handleSoldChange(load.id, event.target.value)}
          type="number"
          value={draftSold[load.id] ?? ""}
        />
      </label>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Metric label="Sold" value={soldCartons.toLocaleString()} />
        <Metric
          label="Expected Return"
          value={Number.isFinite(expectedReturn) ? expectedReturn.toLocaleString() : "0"}
        />
        <Metric
          label="Sales Value"
          value={formatMoney(Number.isFinite(salesValue) ? salesValue : 0)}
        />
      </div>
      <div className="mt-4">
        <SalesAction
          handleSubmitSales={handleSubmitSales}
          isLocked={isLocked}
          load={load}
          salesRecord={salesRecord}
          setUnlockRecordId={setUnlockRecordId}
          user={user}
        />
      </div>
    </article>
  );
}

type SalesDisplayProps = {
  draftSold: DraftSold;
  getDraftSold: (load: LoadingRecord) => number;
  handleSoldChange: (loadId: string, value: string) => void;
  handleSubmitSales: (load: LoadingRecord) => void;
  load: LoadingRecord;
  salesRecord?: SalesRecord;
  setUnlockRecordId: (recordId: string) => void;
  user: SessionUser;
};

function SalesAction({
  handleSubmitSales,
  isLocked,
  load,
  salesRecord,
  setUnlockRecordId,
  user
}: {
  handleSubmitSales: (load: LoadingRecord) => void;
  isLocked: boolean;
  load: LoadingRecord;
  salesRecord?: SalesRecord;
  setUnlockRecordId: (recordId: string) => void;
  user: SessionUser;
}) {
  if (user.role === "admin") {
    if (salesRecord?.locked) {
      return (
        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-brand-200 px-3 py-2 text-sm font-bold text-brand-800 transition hover:bg-brand-50"
          onClick={() => setUnlockRecordId(salesRecord.id)}
          type="button"
        >
          <LockOpen className="h-4 w-4" />
          Unlock
        </button>
      );
    }

    return (
      <span className="text-xs font-semibold text-slate-500">
        {salesRecord ? "Unlocked" : "No sales yet"}
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
      onClick={() => handleSubmitSales(load)}
      type="button"
    >
      <Send className="h-4 w-4" />
      Submit sales
    </button>
  );
}

function SalesStatusChip({ salesRecord }: { salesRecord?: SalesRecord }) {
  if (!salesRecord) {
    return (
      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700">
        Not Submitted
      </span>
    );
  }

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
        salesRecord.locked
          ? statusChipClass("confirmed")
          : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
    >
      {salesRecord.locked ? "Sales Submitted" : "Unlocked"}
    </span>
  );
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-brand-50 px-3 py-2">
      <span className="block text-xs font-semibold text-brand-800">{label}</span>
      <span className="mt-1 block font-bold text-brand-900">{value}</span>
    </div>
  );
}
