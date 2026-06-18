"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { LockOpen, Search, Send, WalletCards } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { SessionUser } from "@/lib/auth";
import { formatDate, statusChipClass } from "@/lib/loading-data";
import {
  applyCashToSalesByMarketerDate,
  getSalesRecords,
  formatMoney
} from "@/lib/sales-data";
import type { SalesRecord } from "@/lib/sales-data";
import {
  getCashRecords,
  submitCashRecord,
  unlockCashRecord
} from "@/lib/cash-data";
import type { CashRecord } from "@/lib/cash-data";
import { getPaymentFollowUps, type PaymentFollowUp } from "@/lib/call-center-data";

type DraftCash = Record<string, string>;
type DraftNotes = Record<string, string>;

export default function CashPage() {
  return (
    <AppShell allowedRoles={["admin", "supervisor", "accountant"]}>
      {(user) => <CashContent user={user} />}
    </AppShell>
  );
}

function CashContent({ user }: { user: SessionUser }) {
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [cashRecords, setCashRecords] = useState<CashRecord[]>([]);
  const [paymentFollowUps, setPaymentFollowUps] = useState<PaymentFollowUp[]>([]);
  const [draftCash, setDraftCash] = useState<DraftCash>({});
  const [draftNotes, setDraftNotes] = useState<DraftNotes>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    date: "",
    marketer: ""
  });
  const [unlockRecordId, setUnlockRecordId] = useState("");
  const [unlockReason, setUnlockReason] = useState("");
  const [unlockError, setUnlockError] = useState("");

  useEffect(() => {
    const sales = getSalesRecords().filter(
      (record) => record.status === "sales_submitted"
    );
    const cash = getCashRecords();
    setSalesRecords(sales);
    setCashRecords(cash);
    setPaymentFollowUps(getPaymentFollowUps());
    setDraftCash(
      cash.reduce<DraftCash>((drafts, record) => {
        drafts[record.salesRecordId] = String(record.cashReceived);
        return drafts;
      }, {})
    );
    setDraftNotes(
      cash.reduce<DraftNotes>((drafts, record) => {
        drafts[record.salesRecordId] = record.notes ?? "";
        return drafts;
      }, {})
    );
  }, []);

  const cashBySalesId = useMemo(() => {
    return new Map(
      cashRecords.map((record) => [record.salesRecordId, record] as const)
    );
  }, [cashRecords]);

  const cashRows = useMemo(() => {
    const filteredRecords = salesRecords.filter((record) => {
      const matchesDate = !filters.date || record.date === filters.date;
      const matchesMarketer =
        !filters.marketer ||
        record.marketerName.toLowerCase().includes(filters.marketer.toLowerCase()) ||
        record.marketerUsername
          .toLowerCase()
          .includes(filters.marketer.toLowerCase());

      return matchesDate && matchesMarketer;
    });

    return groupSalesByMarketerDate(filteredRecords);
  }, [filters, salesRecords]);

  const cashSummary = useMemo(() => {
    return cashRows.reduce(
      (summary, salesRecord) => {
        const cashRecord = cashBySalesId.get(salesRecord.id);
        const cashReceived = cashRecord?.cashReceived ?? getDraftCashValue(salesRecord);
        const expectedCash = salesRecord.salesValue;
        const difference = Math.max(0, expectedCash - cashReceived);

        return {
          expectedCash: summary.expectedCash + expectedCash,
          pending: summary.pending + (cashRecord?.locked ? 0 : 1),
          submitted: summary.submitted + (cashRecord?.locked ? 1 : 0),
          totalCashCollected: summary.totalCashCollected + cashReceived,
          totalDifference: summary.totalDifference + difference
        };
      },
      {
        expectedCash: 0,
        pending: 0,
        submitted: 0,
        totalCashCollected: 0,
        totalDifference: 0
      }
    );
  }, [cashBySalesId, cashRows, draftCash]);

  const overallCollectionRate =
    cashSummary.expectedCash > 0
      ? (cashSummary.totalCashCollected / cashSummary.expectedCash) * 100
      : 0;

  function getDraftCashValue(salesRecord: SalesRecord) {
    const existingRecord = cashBySalesId.get(salesRecord.id);
    const rawValue =
      draftCash[salesRecord.id] ??
      (existingRecord ? String(existingRecord.cashReceived) : "");
    const value = Number(rawValue);

    return Number.isFinite(value) ? value : 0;
  }

  function handleSubmitCash(salesRecord: SalesRecord) {
    setMessage("");
    setError("");

    const existingRecord = cashBySalesId.get(salesRecord.id);

    if (existingRecord?.locked) {
      setError("This cash record is locked. Admin must unlock it before edits.");
      return;
    }

    const cashReceived = Number(draftCash[salesRecord.id]);

    if (!Number.isFinite(cashReceived) || cashReceived < 0) {
      setError("Cash received must be zero or greater.");
      return;
    }

    const result = submitCashRecord(
      salesRecord,
      cashReceived,
      user,
      existingRecord,
      draftNotes[salesRecord.id] ?? ""
    );
    const updatedSalesRecords = applyCashToSalesByMarketerDate({
      cashReceived,
      date: salesRecord.date,
      marketerUsername: salesRecord.marketerUsername
    }).filter((record) => record.status === "sales_submitted");
    setCashRecords(result.records);
    setSalesRecords(updatedSalesRecords);
    setDraftCash((current) => ({
      ...current,
      [salesRecord.id]: String(result.record.cashReceived)
    }));
    setDraftNotes((current) => ({
      ...current,
      [salesRecord.id]: result.record.notes ?? ""
    }));
    setMessage("Cash received submitted, locked, and marketer sales payment status updated.");
  }

  function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUnlockError("");

    if (!unlockReason.trim()) {
      setUnlockError("Enter an unlock reason before continuing.");
      return;
    }

    setCashRecords(unlockCashRecord(unlockRecordId, unlockReason.trim(), user));
    setUnlockRecordId("");
    setUnlockReason("");
    setMessage("Cash record unlocked.");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <WalletCards className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-950">
              Cash Collection
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Record actual cash received and control cash variance.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
          <Search className="h-4 w-4 text-brand-700" />
          Filter cash records
        </div>
        <div className="grid gap-3 md:grid-cols-2">
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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CashSummaryCard
          label="Total Cash Collected"
          value={`${formatMoney(cashSummary.totalCashCollected)} RWF`}
        />
        <CashSummaryCard
          label="Total Difference"
          tone={cashSummary.totalDifference > 0 ? "danger" : "default"}
          value={`${formatMoney(cashSummary.totalDifference)} RWF`}
        />
        <CashSummaryCard
          label="Overall Collection Rate"
          tone={overallCollectionRate >= 95 ? "default" : "warning"}
          value={`${overallCollectionRate.toFixed(0)}%`}
        />
        <CashSummaryCard
          label="Marketers Submitted / Pending"
          tone={cashSummary.pending > 0 ? "warning" : "default"}
          value={`${cashSummary.submitted.toLocaleString()} / ${cashSummary.pending.toLocaleString()}`}
        />
      </section>

      <div className="hidden overflow-hidden rounded-lg border border-brand-100 bg-white shadow-sm xl:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-brand-50 text-xs font-bold uppercase tracking-normal text-brand-900">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Marketer</th>
              <th className="px-4 py-3 text-right">Sold Cartons</th>
              <th className="px-4 py-3 text-right">Expected Cash</th>
              <th className="px-4 py-3 text-right">Cash Received</th>
              <th className="px-4 py-3 text-right">Difference</th>
              <th className="px-4 py-3 text-right">Collection Rate</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cashRows.map((salesRecord) => (
              <CashRow
                cashRecord={cashBySalesId.get(salesRecord.id)}
                draftCash={draftCash}
                draftNotes={draftNotes}
                getDraftCashValue={getDraftCashValue}
                handleSubmitCash={handleSubmitCash}
                key={salesRecord.id}
                salesRecord={salesRecord}
                setDraftCash={setDraftCash}
                setDraftNotes={setDraftNotes}
                setUnlockRecordId={setUnlockRecordId}
                user={user}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 xl:hidden">
        {cashRows.map((salesRecord) => (
          <CashCard
            cashRecord={cashBySalesId.get(salesRecord.id)}
            draftCash={draftCash}
            draftNotes={draftNotes}
            getDraftCashValue={getDraftCashValue}
            handleSubmitCash={handleSubmitCash}
            key={salesRecord.id}
            salesRecord={salesRecord}
            setDraftCash={setDraftCash}
            setDraftNotes={setDraftNotes}
            setUnlockRecordId={setUnlockRecordId}
            user={user}
          />
        ))}
      </div>

      {cashRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-brand-200 bg-white px-5 py-8 text-center text-sm font-semibold text-slate-500">
          No sales submitted records are ready for cash collection.
        </div>
      ) : null}

      {paymentFollowUps.length > 0 ? (
        <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-slate-950">Payment Follow-ups from Customer Care & Relationship Management (CCRM)</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Amount Due</th>
                  <th>Days Outstanding</th>
                  <th>Promise Date</th>
                  <th>Status</th>
                  <th>Agent</th>
                  <th>Comment</th>
                </tr>
              </thead>
              <tbody>
                {paymentFollowUps.map((record) => (
                  <tr key={record.id}>
                    <td className="font-bold text-slate-950">{record.clientName}</td>
                    <td>{formatMoney(record.amountDue)} RWF</td>
                    <td>{record.daysOutstanding}</td>
                    <td>{record.promiseToPayDate}</td>
                    <td>{record.status}</td>
                    <td>{record.agent}</td>
                    <td>{record.comment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {unlockRecordId ? (
        <div className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
          <form className="space-y-3" onSubmit={handleUnlock}>
            <div>
              <h3 className="font-bold text-slate-950">Unlock cash record</h3>
              <p className="mt-1 text-sm text-slate-600">
                A reason is required and will be saved in the audit log.
              </p>
            </div>
            <textarea
              className="min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
              onChange={(event) => setUnlockReason(event.target.value)}
              placeholder="Reason for cash unlock"
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

type CashDisplayProps = {
  cashRecord?: CashRecord;
  draftCash: DraftCash;
  draftNotes: DraftNotes;
  getDraftCashValue: (salesRecord: SalesRecord) => number;
  handleSubmitCash: (salesRecord: SalesRecord) => void;
  salesRecord: SalesRecord;
  setDraftCash: React.Dispatch<React.SetStateAction<DraftCash>>;
  setDraftNotes: React.Dispatch<React.SetStateAction<DraftNotes>>;
  setUnlockRecordId: (recordId: string) => void;
  user: SessionUser;
};

function CashRow(props: CashDisplayProps) {
  const {
    cashRecord,
    draftCash,
    draftNotes,
    getDraftCashValue,
    handleSubmitCash,
    salesRecord,
    setDraftCash,
    setDraftNotes,
    setUnlockRecordId,
    user
  } = props;
  const cashReceived = getDraftCashValue(salesRecord);
  const expectedCash = salesRecord.salesValue;
  const difference = expectedCash - cashReceived;
  const collectionRate = expectedCash > 0 ? (cashReceived / expectedCash) * 100 : 0;
  const isLocked = Boolean(cashRecord?.locked);

  return (
    <tr>
      <td className="px-4 py-3 text-slate-700">{formatDate(salesRecord.date)}</td>
      <td className="px-4 py-3 text-slate-700">{salesRecord.marketerName}</td>
      <td className="px-4 py-3 text-right font-semibold">
        {salesRecord.soldCartons.toLocaleString()}
      </td>
      <td className="px-4 py-3 text-right font-semibold text-slate-950">
        {formatMoney(expectedCash)}
      </td>
      <td className="px-4 py-3">
        <input
          className="form-input ml-auto max-w-32 text-right"
          disabled={user.role !== "accountant" || isLocked}
          min="0"
          onChange={(event) =>
            setDraftCash((current) => ({
              ...current,
              [salesRecord.id]: event.target.value
            }))
          }
          type="number"
          value={draftCash[salesRecord.id] ?? ""}
        />
      </td>
      <td
        className={`px-4 py-3 text-right font-bold ${
          difference > 0 ? "text-red-700" : "text-brand-800"
        }`}
      >
        {formatMoney(Number.isFinite(difference) ? difference : 0)}
      </td>
      <td className="px-4 py-3 text-right font-bold text-brand-800">
        {Number.isFinite(collectionRate) ? `${collectionRate.toFixed(0)}%` : "0%"}
      </td>
      <td className="px-4 py-3">
        <CashStatusChip cashRecord={cashRecord} />
      </td>
      <td className="px-4 py-3">
        <input
          className="form-input min-w-44"
          disabled={user.role !== "accountant" || isLocked}
          onChange={(event) =>
            setDraftNotes((current) => ({
              ...current,
              [salesRecord.id]: event.target.value
            }))
          }
          placeholder="Optional note"
          value={draftNotes[salesRecord.id] ?? ""}
        />
      </td>
      <td className="px-4 py-3">
        <CashAction
          cashRecord={cashRecord}
          handleSubmitCash={handleSubmitCash}
          isLocked={isLocked}
          salesRecord={salesRecord}
          setUnlockRecordId={setUnlockRecordId}
          user={user}
        />
      </td>
    </tr>
  );
}

function CashCard(props: CashDisplayProps) {
  const {
    cashRecord,
    draftCash,
    draftNotes,
    getDraftCashValue,
    handleSubmitCash,
    salesRecord,
    setDraftCash,
    setDraftNotes,
    setUnlockRecordId,
    user
  } = props;
  const cashReceived = getDraftCashValue(salesRecord);
  const expectedCash = salesRecord.salesValue;
  const difference = expectedCash - cashReceived;
  const collectionRate = expectedCash > 0 ? (cashReceived / expectedCash) * 100 : 0;
  const isLocked = Boolean(cashRecord?.locked);

  return (
    <article className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-950">{salesRecord.marketerName}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {salesRecord.itemCode} · {formatDate(salesRecord.date)}
          </p>
        </div>
        <CashStatusChip cashRecord={cashRecord} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Info label="Marketer" value={salesRecord.marketerName} />
        <Info label="Total Sold Cartons" value={salesRecord.soldCartons.toLocaleString()} />
        <Info label="Expected Cash" value={formatMoney(expectedCash)} />
        <Info
          label="Difference"
          value={formatMoney(difference)}
        />
        <Info
          label="Collection Rate"
          value={Number.isFinite(collectionRate) ? `${collectionRate.toFixed(0)}%` : "0%"}
        />
      </div>
      <label className="mt-4 block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Cash received
        </span>
        <input
          className="form-input"
          disabled={user.role !== "accountant" || isLocked}
          min="0"
          onChange={(event) =>
            setDraftCash((current) => ({
              ...current,
              [salesRecord.id]: event.target.value
            }))
          }
          type="number"
          value={draftCash[salesRecord.id] ?? ""}
        />
      </label>
      <label className="mt-4 block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Notes
        </span>
        <input
          className="form-input"
          disabled={user.role !== "accountant" || isLocked}
          onChange={(event) =>
            setDraftNotes((current) => ({
              ...current,
              [salesRecord.id]: event.target.value
            }))
          }
          placeholder="Optional note"
          value={draftNotes[salesRecord.id] ?? ""}
        />
      </label>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Metric label="Expected" value={formatMoney(expectedCash)} />
        <Metric label="Received" value={formatMoney(cashReceived)} />
        <Metric label="Difference" value={formatMoney(difference)} warning={difference > 0} />
      </div>
      <div className="mt-4">
        <CashAction
          cashRecord={cashRecord}
          handleSubmitCash={handleSubmitCash}
          isLocked={isLocked}
          salesRecord={salesRecord}
          setUnlockRecordId={setUnlockRecordId}
          user={user}
        />
      </div>
    </article>
  );
}

function CashAction({
  cashRecord,
  handleSubmitCash,
  isLocked,
  salesRecord,
  setUnlockRecordId,
  user
}: {
  cashRecord?: CashRecord;
  handleSubmitCash: (salesRecord: SalesRecord) => void;
  isLocked: boolean;
  salesRecord: SalesRecord;
  setUnlockRecordId: (recordId: string) => void;
  user: SessionUser;
}) {
  if (user.role === "admin") {
    if (cashRecord?.locked) {
      return (
        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-brand-200 px-3 py-2 text-sm font-bold text-brand-800 transition hover:bg-brand-50"
          onClick={() => setUnlockRecordId(cashRecord.id)}
          type="button"
        >
          <LockOpen className="h-4 w-4" />
          Unlock
        </button>
      );
    }

    return (
      <span className="text-xs font-semibold text-slate-500">
        {cashRecord ? "View only" : "No cash yet"}
      </span>
    );
  }

  if (user.role === "supervisor") {
    return (
      <span className="text-xs font-semibold text-slate-500">
        View only
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
      onClick={() => handleSubmitCash(salesRecord)}
      type="button"
    >
      <Send className="h-4 w-4" />
      Submit cash
    </button>
  );
}

function CashStatusChip({ cashRecord }: { cashRecord?: CashRecord }) {
  if (!cashRecord) {
    return (
      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700">
        Not Submitted
      </span>
    );
  }

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
        cashRecord.locked
          ? statusChipClass("confirmed")
          : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
    >
      {cashRecord.locked ? "Cash Submitted" : "Unlocked"}
    </span>
  );
}

function CashSummaryCard({
  label,
  tone = "default",
  value
}: {
  label: string;
  tone?: "danger" | "default" | "warning";
  value: string;
}) {
  const toneClass =
    tone === "danger"
      ? "border-red-100 bg-red-50 text-red-800"
      : tone === "warning"
        ? "border-amber-100 bg-amber-50 text-amber-800"
        : "border-brand-100 bg-white text-brand-900";

  return (
    <article className={`rounded-lg border p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-black uppercase tracking-normal text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </article>
  );
}

function groupSalesByMarketerDate(records: SalesRecord[]) {
  const groups = new Map<string, SalesRecord[]>();

  records.forEach((record) => {
    const key = `${record.date}::${record.marketerUsername}`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  });

  return Array.from(groups.entries()).map(([key, groupRecords]) => {
    const firstRecord = groupRecords[0];
    const salesValue = groupRecords.reduce(
      (total, record) => total + record.salesValue,
      0
    );
    const totalPaid = groupRecords.reduce(
      (total, record) => total + (record.totalPaid ?? record.salesValue),
      0
    );
    const loadedCartons = groupRecords.reduce(
      (total, record) => total + record.loadedCartons,
      0
    );
    const soldCartons = groupRecords.reduce(
      (total, record) => total + record.soldCartons,
      0
    );

    return {
      ...firstRecord,
      id: `CASH-GROUP-${key.replace(/[^a-z0-9]+/gi, "-").toUpperCase()}`,
      productName: "All Products",
      itemCode: "GROUP",
      pricePerCarton: 0,
      loadedCartons,
      soldCartons,
      expectedReturnCartons: loadedCartons - soldCartons,
      salesValue,
      totalPaid,
      totalUnpaidBalance: Math.max(0, salesValue - totalPaid)
    };
  });
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
