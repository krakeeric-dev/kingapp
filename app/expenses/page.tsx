"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { LockOpen, ReceiptText, Search, Send } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { SessionUser } from "@/lib/auth";
import type { CashRecord } from "@/lib/cash-data";
import { getCashRecords } from "@/lib/cash-data";
import { formatDate, statusChipClass } from "@/lib/loading-data";
import { formatMoney } from "@/lib/sales-data";
import {
  calculateTotalExpenses,
  getExpenseRecords,
  submitExpenseRecord,
  unlockExpenseRecord
} from "@/lib/expenses-data";
import type { ExpenseInput, ExpenseRecord } from "@/lib/expenses-data";

type DraftExpenses = Record<string, ExpenseDraft>;

type ExpenseDraft = {
  fuel: string;
  transport: string;
  loaderPayment: string;
  commission: string;
  airtime: string;
  food: string;
  miscellaneous: string;
  notes: string;
};

const emptyDraft: ExpenseDraft = {
  fuel: "",
  transport: "",
  loaderPayment: "",
  commission: "",
  airtime: "",
  food: "",
  miscellaneous: "",
  notes: ""
};

export default function ExpensesPage() {
  return (
    <AppShell allowedRoles={["admin", "supervisor", "accountant"]}>
      {(user) => <ExpensesContent user={user} />}
    </AppShell>
  );
}

function ExpensesContent({ user }: { user: SessionUser }) {
  const [cashRecords, setCashRecords] = useState<CashRecord[]>([]);
  const [expenseRecords, setExpenseRecords] = useState<ExpenseRecord[]>([]);
  const [draftExpenses, setDraftExpenses] = useState<DraftExpenses>({});
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
    const cash = getCashRecords().filter(
      (record) => record.status === "cash_submitted"
    );
    const expenses = getExpenseRecords();
    setCashRecords(cash);
    setExpenseRecords(expenses);
    setDraftExpenses(
      expenses.reduce<DraftExpenses>((drafts, record) => {
        drafts[record.cashRecordId] = {
          fuel: String(record.fuel),
          transport: String(record.transport),
          loaderPayment: String(record.loaderPayment),
          commission: String(record.commission),
          airtime: String(record.airtime),
          food: String(record.food),
          miscellaneous: String(record.miscellaneous),
          notes: record.notes
        };
        return drafts;
      }, {})
    );
  }, []);

  const expensesByCashId = useMemo(() => {
    return new Map(
      expenseRecords.map((record) => [record.cashRecordId, record] as const)
    );
  }, [expenseRecords]);

  const filteredCash = useMemo(() => {
    return cashRecords.filter((record) => {
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
  }, [cashRecords, filters]);

  function getDraft(cashRecord: CashRecord) {
    const existingRecord = expensesByCashId.get(cashRecord.id);

    return (
      draftExpenses[cashRecord.id] ??
      (existingRecord
        ? {
            fuel: String(existingRecord.fuel),
            transport: String(existingRecord.transport),
            loaderPayment: String(existingRecord.loaderPayment),
            commission: String(existingRecord.commission),
            airtime: String(existingRecord.airtime),
            food: String(existingRecord.food),
            miscellaneous: String(existingRecord.miscellaneous),
            notes: existingRecord.notes
          }
        : emptyDraft)
    );
  }

  function draftToInput(draft: ExpenseDraft): ExpenseInput {
    return {
      fuel: numberValue(draft.fuel),
      transport: numberValue(draft.transport),
      loaderPayment: numberValue(draft.loaderPayment),
      commission: numberValue(draft.commission),
      airtime: numberValue(draft.airtime),
      food: numberValue(draft.food),
      miscellaneous: numberValue(draft.miscellaneous),
      notes: draft.notes.trim()
    };
  }

  function updateDraft(
    cashRecordId: string,
    field: keyof ExpenseDraft,
    value: string
  ) {
    setDraftExpenses((current) => ({
      ...current,
      [cashRecordId]: {
        ...(current[cashRecordId] ?? emptyDraft),
        [field]: value
      }
    }));
  }

  function handleSubmitExpenses(cashRecord: CashRecord) {
    setMessage("");
    setError("");

    const existingRecord = expensesByCashId.get(cashRecord.id);

    if (existingRecord?.locked) {
      setError("This expense record is locked. Admin must unlock it before edits.");
      return;
    }

    const draft = getDraft(cashRecord);
    const input = draftToInput(draft);

    if (Object.values(input).some((value) => typeof value === "number" && value < 0)) {
      setError("Expense amounts cannot be negative.");
      return;
    }

    const result = submitExpenseRecord(cashRecord, input, user, existingRecord);
    setExpenseRecords(result.records);
    setDraftExpenses((current) => ({
      ...current,
      [cashRecord.id]: {
        fuel: String(result.record.fuel),
        transport: String(result.record.transport),
        loaderPayment: String(result.record.loaderPayment),
        commission: String(result.record.commission),
        airtime: String(result.record.airtime),
        food: String(result.record.food),
        miscellaneous: String(result.record.miscellaneous),
        notes: result.record.notes
      }
    }));
    setMessage("Expenses submitted and locked.");
  }

  function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUnlockError("");

    if (!unlockReason.trim()) {
      setUnlockError("Enter an unlock reason before continuing.");
      return;
    }

    setExpenseRecords(
      unlockExpenseRecord(unlockRecordId, unlockReason.trim(), user)
    );
    setUnlockRecordId("");
    setUnlockReason("");
    setMessage("Expense record unlocked.");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <ReceiptText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-950">
              Expenses & Daily Closing
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Record daily expenses and calculate closing cash balance.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
          <Search className="h-4 w-4 text-brand-700" />
          Filter expense records
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

      <div className="grid gap-4">
        {filteredCash.map((cashRecord) => (
          <ExpenseCard
            cashRecord={cashRecord}
            draft={getDraft(cashRecord)}
            expenseRecord={expensesByCashId.get(cashRecord.id)}
            handleSubmitExpenses={handleSubmitExpenses}
            key={cashRecord.id}
            setUnlockRecordId={setUnlockRecordId}
            updateDraft={updateDraft}
            user={user}
          />
        ))}
      </div>

      {filteredCash.length === 0 ? (
        <div className="rounded-lg border border-dashed border-brand-200 bg-white px-5 py-8 text-center text-sm font-semibold text-slate-500">
          No cash submitted records are ready for expenses.
        </div>
      ) : null}

      {unlockRecordId ? (
        <div className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
          <form className="space-y-3" onSubmit={handleUnlock}>
            <div>
              <h3 className="font-bold text-slate-950">Unlock expense record</h3>
              <p className="mt-1 text-sm text-slate-600">
                A reason is required and will be saved in the audit log.
              </p>
            </div>
            <textarea
              className="min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
              onChange={(event) => setUnlockReason(event.target.value)}
              placeholder="Reason for expense unlock"
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

function ExpenseCard({
  cashRecord,
  draft,
  expenseRecord,
  handleSubmitExpenses,
  setUnlockRecordId,
  updateDraft,
  user
}: {
  cashRecord: CashRecord;
  draft: ExpenseDraft;
  expenseRecord?: ExpenseRecord;
  handleSubmitExpenses: (cashRecord: CashRecord) => void;
  setUnlockRecordId: (recordId: string) => void;
  updateDraft: (
    cashRecordId: string,
    field: keyof ExpenseDraft,
    value: string
  ) => void;
  user: SessionUser;
}) {
  const input = {
    fuel: numberValue(draft.fuel),
    transport: numberValue(draft.transport),
    loaderPayment: numberValue(draft.loaderPayment),
    commission: numberValue(draft.commission),
    airtime: numberValue(draft.airtime),
    food: numberValue(draft.food),
    miscellaneous: numberValue(draft.miscellaneous),
    notes: draft.notes
  };
  const totalExpenses = calculateTotalExpenses(input);
  const closingBalance = cashRecord.cashReceived - totalExpenses;
  const isLocked = Boolean(expenseRecord?.locked);
  const isReadOnly = user.role !== "accountant";

  return (
    <article className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-slate-950">
              {cashRecord.productName}
            </h3>
            <ExpenseStatusChip expenseRecord={expenseRecord} />
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {cashRecord.marketerName} - {formatDate(cashRecord.date)}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[520px]">
          <Metric label="Expected Cash" value={formatMoney(cashRecord.expectedCash)} />
          <Metric label="Cash Received" value={formatMoney(cashRecord.cashReceived)} />
          <Metric
            label="Cash Variance"
            value={formatMoney(cashRecord.cashVariance)}
            warning={cashRecord.cashVariance < 0}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ExpenseInputField
          disabled={isReadOnly || isLocked}
          label="Fuel"
          onChange={(value) => updateDraft(cashRecord.id, "fuel", value)}
          value={draft.fuel}
        />
        <ExpenseInputField
          disabled={isReadOnly || isLocked}
          label="Transport"
          onChange={(value) => updateDraft(cashRecord.id, "transport", value)}
          value={draft.transport}
        />
        <ExpenseInputField
          disabled={isReadOnly || isLocked}
          label="Loader Payment"
          onChange={(value) => updateDraft(cashRecord.id, "loaderPayment", value)}
          value={draft.loaderPayment}
        />
        <ExpenseInputField
          disabled={isReadOnly || isLocked}
          label="Commission"
          onChange={(value) => updateDraft(cashRecord.id, "commission", value)}
          value={draft.commission}
        />
        <ExpenseInputField
          disabled={isReadOnly || isLocked}
          label="Airtime"
          onChange={(value) => updateDraft(cashRecord.id, "airtime", value)}
          value={draft.airtime}
        />
        <ExpenseInputField
          disabled={isReadOnly || isLocked}
          label="Food"
          onChange={(value) => updateDraft(cashRecord.id, "food", value)}
          value={draft.food}
        />
        <ExpenseInputField
          disabled={isReadOnly || isLocked}
          label="Miscellaneous"
          onChange={(value) => updateDraft(cashRecord.id, "miscellaneous", value)}
          value={draft.miscellaneous}
        />
        <label className="block md:col-span-2 xl:col-span-1">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Notes
          </span>
          <input
            className="form-input"
            disabled={isReadOnly || isLocked}
            onChange={(event) =>
              updateDraft(cashRecord.id, "notes", event.target.value)
            }
            placeholder="Optional"
            value={draft.notes}
          />
        </label>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <Metric label="Total Expenses" value={formatMoney(totalExpenses)} />
        <Metric
          label="Closing Balance"
          value={formatMoney(closingBalance)}
          warning={closingBalance < 0}
        />
        <ExpenseAction
          cashRecord={cashRecord}
          expenseRecord={expenseRecord}
          handleSubmitExpenses={handleSubmitExpenses}
          isLocked={isLocked}
          setUnlockRecordId={setUnlockRecordId}
          user={user}
        />
      </div>
    </article>
  );
}

function ExpenseAction({
  cashRecord,
  expenseRecord,
  handleSubmitExpenses,
  isLocked,
  setUnlockRecordId,
  user
}: {
  cashRecord: CashRecord;
  expenseRecord?: ExpenseRecord;
  handleSubmitExpenses: (cashRecord: CashRecord) => void;
  isLocked: boolean;
  setUnlockRecordId: (recordId: string) => void;
  user: SessionUser;
}) {
  if (user.role === "admin" || user.role === "supervisor") {
    if (expenseRecord?.locked) {
      return (
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-brand-200 px-4 text-sm font-bold text-brand-800 transition hover:bg-brand-50"
          onClick={() => setUnlockRecordId(expenseRecord.id)}
          type="button"
        >
          <LockOpen className="h-4 w-4" />
          Unlock
        </button>
      );
    }

    return (
      <span className="inline-flex h-11 items-center text-sm font-semibold text-slate-500">
        {expenseRecord ? "View only" : "No expenses yet"}
      </span>
    );
  }

  if (isLocked) {
    return (
      <span className="inline-flex h-11 items-center rounded-lg bg-slate-100 px-4 text-sm font-bold text-slate-600">
        Locked after submission
      </span>
    );
  }

  return (
    <button
      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-bold text-white transition hover:bg-brand-800"
      onClick={() => handleSubmitExpenses(cashRecord)}
      type="button"
    >
      <Send className="h-4 w-4" />
      Submit expenses
    </button>
  );
}

function ExpenseStatusChip({
  expenseRecord
}: {
  expenseRecord?: ExpenseRecord;
}) {
  if (!expenseRecord) {
    return (
      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700">
        Not Submitted
      </span>
    );
  }

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
        expenseRecord.locked
          ? statusChipClass("confirmed")
          : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
    >
      {expenseRecord.locked ? "Expenses Submitted" : "Unlocked"}
    </span>
  );
}

function ExpenseInputField({
  disabled,
  label,
  onChange,
  value
}: {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      <input
        className="form-input"
        disabled={disabled}
        min="0"
        onChange={(event) => onChange(event.target.value)}
        placeholder="0"
        type="number"
        value={value}
      />
    </label>
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

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
