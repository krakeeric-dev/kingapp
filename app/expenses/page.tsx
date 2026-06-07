"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { LockOpen, ReceiptText, Search, Send } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { SessionUser } from "@/lib/auth";
import { getCashRecords, type CashRecord } from "@/lib/cash-data";
import { formatDate, getTodayIsoDate, statusChipClass } from "@/lib/loading-data";
import { formatMoney } from "@/lib/sales-data";
import {
  calculateTotalExpenses,
  getExpenseRecords,
  submitGeneralExpenseRecord,
  unlockExpenseRecord,
  type ExpenseInput,
  type ExpenseRecord
} from "@/lib/expenses-data";

type ExpenseForm = {
  airtime: string;
  commission: string;
  date: string;
  food: string;
  fuel: string;
  loaderPayment: string;
  marketerUsername: string;
  miscellaneous: string;
  notes: string;
  openingCash: string;
  transport: string;
};

const emptyForm: ExpenseForm = {
  airtime: "",
  commission: "",
  date: getTodayIsoDate(),
  food: "",
  fuel: "",
  loaderPayment: "",
  marketerUsername: "",
  miscellaneous: "",
  notes: "",
  openingCash: "",
  transport: ""
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
  const [form, setForm] = useState<ExpenseForm>(emptyForm);
  const [filters, setFilters] = useState({
    date: "",
    marketer: ""
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [unlockRecordId, setUnlockRecordId] = useState("");
  const [unlockReason, setUnlockReason] = useState("");
  const [unlockError, setUnlockError] = useState("");

  useEffect(() => {
    setCashRecords(getCashRecords().filter((record) => record.status === "cash_submitted"));
    setExpenseRecords(getExpenseRecords());
  }, []);

  const marketers = useMemo(() => {
    const map = new Map<string, string>();
    cashRecords.forEach((record) => {
      map.set(record.marketerUsername, record.marketerName);
    });
    expenseRecords.forEach((record) => {
      if (record.marketerUsername) {
        map.set(record.marketerUsername, record.marketerName);
      }
    });
    return Array.from(map.entries()).map(([username, name]) => ({ name, username }));
  }, [cashRecords, expenseRecords]);

  const selectedMarketer = marketers.find(
    (marketer) => marketer.username === form.marketerUsername
  );

  const cashReceived = useMemo(() => {
    return cashRecords
      .filter(
        (record) =>
          record.date === form.date &&
          (!form.marketerUsername || record.marketerUsername === form.marketerUsername)
      )
      .reduce((total, record) => total + record.cashReceived, 0);
  }, [cashRecords, form.date, form.marketerUsername]);

  const expenseInput = formToExpenseInput(form);
  const totalExpenses = calculateTotalExpenses(expenseInput);
  const openingCash = numberValue(form.openingCash);
  const closingBalance = openingCash + cashReceived - totalExpenses;

  const filteredExpenses = useMemo(() => {
    return expenseRecords
      .filter((record) => record.productName === "General Operations" || record.openingCash !== undefined)
      .filter((record) => {
        const matchesDate = !filters.date || record.date === filters.date;
        const matchesMarketer =
          !filters.marketer ||
          record.marketerName.toLowerCase().includes(filters.marketer.toLowerCase()) ||
          record.marketerUsername.toLowerCase().includes(filters.marketer.toLowerCase());

        return matchesDate && matchesMarketer;
      });
  }, [expenseRecords, filters]);

  function updateForm<Key extends keyof ExpenseForm>(field: Key, value: ExpenseForm[Key]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (user.role !== "accountant" && user.role !== "admin") {
      setError("Only accountant or admin can submit expenses.");
      return;
    }

    if (!form.date) {
      setError("Date is required.");
      return;
    }

    if (
      [
        expenseInput.fuel,
        expenseInput.transport,
        expenseInput.loaderPayment,
        expenseInput.commission,
        expenseInput.airtime,
        expenseInput.food,
        expenseInput.miscellaneous,
        openingCash
      ].some((value) => value < 0)
    ) {
      setError("Amounts cannot be negative.");
      return;
    }

    const existingRecord = expenseRecords.find(
      (record) =>
        record.date === form.date &&
        (record.marketerUsername || "") === (form.marketerUsername || "") &&
        (record.productName === "General Operations" || record.openingCash !== undefined)
    );

    if (existingRecord?.locked) {
      setError("This expense record is locked. Admin must unlock it before edits.");
      return;
    }

    const result = submitGeneralExpenseRecord(
      {
        ...expenseInput,
        cashReceived,
        date: form.date,
        marketerName: selectedMarketer?.name ?? "All Marketers",
        marketerUsername: form.marketerUsername,
        openingCash,
        notes: form.notes.trim()
      },
      user,
      existingRecord
    );
    setExpenseRecords(result.records);
    setForm({ ...emptyForm, date: getTodayIsoDate() });
    setMessage("Expenses submitted and locked.");
  }

  function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUnlockError("");

    if (!unlockReason.trim()) {
      setUnlockError("Enter an unlock reason before continuing.");
      return;
    }

    setExpenseRecords(unlockExpenseRecord(unlockRecordId, unlockReason.trim(), user));
    setUnlockRecordId("");
    setUnlockReason("");
    setMessage("Expense record unlocked.");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <ReceiptText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-950">Expenses Management</h2>
            <p className="mt-1 text-sm text-slate-600">
              Record one general company or marketer-trip expense record for the day.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Expenses" value={`${formatMoney(totalExpenses)} RWF`} />
        <SummaryCard label="Opening Cash" value={`${formatMoney(openingCash)} RWF`} />
        <SummaryCard label="Cash Received" value={`${formatMoney(cashReceived)} RWF`} />
        <SummaryCard
          label="Closing Balance"
          tone={closingBalance < 0 ? "danger" : "default"}
          value={`${formatMoney(closingBalance)} RWF`}
        />
      </section>

      <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-lg font-black text-slate-950">General Expenses Form</h3>
          <p className="text-sm text-slate-600">
            Product sales and cash collection stay separate. This form captures operating expenses only.
          </p>
        </div>
        <form className="grid gap-3 lg:grid-cols-4" onSubmit={handleSubmit}>
          <FormField label="Date">
            <input
              className="form-input"
              disabled={user.role !== "accountant" && user.role !== "admin"}
              onChange={(event) => updateForm("date", event.target.value)}
              type="date"
              value={form.date}
            />
          </FormField>
          <FormField label="Marketer">
            <select
              className="form-input"
              disabled={user.role !== "accountant" && user.role !== "admin"}
              onChange={(event) => updateForm("marketerUsername", event.target.value)}
              value={form.marketerUsername}
            >
              <option value="">All Marketers / Company</option>
              {marketers.map((marketer) => (
                <option key={marketer.username} value={marketer.username}>
                  {marketer.name}
                </option>
              ))}
            </select>
          </FormField>
          <MoneyField label="Opening Cash" onChange={(value) => updateForm("openingCash", value)} value={form.openingCash} disabled={user.role !== "accountant" && user.role !== "admin"} />
          <ReadOnlyMetric label="Cash Received" value={`${formatMoney(cashReceived)} RWF`} />
          <MoneyField label="Fuel" onChange={(value) => updateForm("fuel", value)} value={form.fuel} disabled={user.role !== "accountant" && user.role !== "admin"} />
          <MoneyField label="Transport" onChange={(value) => updateForm("transport", value)} value={form.transport} disabled={user.role !== "accountant" && user.role !== "admin"} />
          <MoneyField label="Loader Payment" onChange={(value) => updateForm("loaderPayment", value)} value={form.loaderPayment} disabled={user.role !== "accountant" && user.role !== "admin"} />
          <MoneyField label="Commission" onChange={(value) => updateForm("commission", value)} value={form.commission} disabled={user.role !== "accountant" && user.role !== "admin"} />
          <MoneyField label="Airtime" onChange={(value) => updateForm("airtime", value)} value={form.airtime} disabled={user.role !== "accountant" && user.role !== "admin"} />
          <MoneyField label="Food" onChange={(value) => updateForm("food", value)} value={form.food} disabled={user.role !== "accountant" && user.role !== "admin"} />
          <MoneyField label="Miscellaneous" onChange={(value) => updateForm("miscellaneous", value)} value={form.miscellaneous} disabled={user.role !== "accountant" && user.role !== "admin"} />
          <ReadOnlyMetric label="Total Expenses" value={`${formatMoney(totalExpenses)} RWF`} />
          <div className="lg:col-span-3">
            <FormField label="Notes">
              <input
                className="form-input"
                disabled={user.role !== "accountant" && user.role !== "admin"}
                onChange={(event) => updateForm("notes", event.target.value)}
                placeholder="Optional notes"
                value={form.notes}
              />
            </FormField>
          </div>
          <div className="flex items-end">
            <button
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-bold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={user.role !== "accountant" && user.role !== "admin"}
              type="submit"
            >
              <Send className="h-4 w-4" />
              Submit Expenses
            </button>
          </div>
        </form>
      </section>

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

      <section className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
          <Search className="h-4 w-4 text-brand-700" />
          Filter expense history
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <FormField label="Date">
            <input
              className="form-input"
              onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))}
              type="date"
              value={filters.date}
            />
          </FormField>
          <FormField label="Marketer">
            <input
              className="form-input"
              onChange={(event) => setFilters((current) => ({ ...current, marketer: event.target.value }))}
              placeholder="Search marketer"
              value={filters.marketer}
            />
          </FormField>
        </div>
      </section>

      <section className="rounded-lg border border-brand-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <h3 className="font-black text-slate-950">General Expense History</h3>
        </div>
        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
            <thead className="bg-brand-50 text-xs font-bold uppercase tracking-normal text-brand-900">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Marketer</th>
                <th className="px-4 py-3 text-right">Fuel</th>
                <th className="px-4 py-3 text-right">Transport</th>
                <th className="px-4 py-3 text-right">Loader</th>
                <th className="px-4 py-3 text-right">Commission</th>
                <th className="px-4 py-3 text-right">Airtime</th>
                <th className="px-4 py-3 text-right">Food</th>
                <th className="px-4 py-3 text-right">Misc.</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Closing</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.map((record) => (
                <ExpenseRow
                  key={record.id}
                  record={record}
                  setUnlockRecordId={setUnlockRecordId}
                  user={user}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 p-4 xl:hidden">
          {filteredExpenses.map((record) => (
            <ExpenseCard key={record.id} record={record} setUnlockRecordId={setUnlockRecordId} user={user} />
          ))}
        </div>
        {filteredExpenses.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm font-semibold text-slate-500">
            No general expense records found.
          </div>
        ) : null}
      </section>

      {unlockRecordId ? (
        <section className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
          <form className="space-y-3" onSubmit={handleUnlock}>
            <div>
              <h3 className="font-bold text-slate-950">Unlock expense record</h3>
              <p className="mt-1 text-sm text-slate-600">
                Only admin can unlock submitted expenses. A reason is required.
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
              <button className="primary-button" type="submit">
                Save unlock
              </button>
              <button
                className="secondary-button"
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
        </section>
      ) : null}
    </div>
  );
}

function ExpenseRow({
  record,
  setUnlockRecordId,
  user
}: {
  record: ExpenseRecord;
  setUnlockRecordId: (recordId: string) => void;
  user: SessionUser;
}) {
  return (
    <tr>
      <td className="px-4 py-3 text-slate-700">{formatDate(record.date)}</td>
      <td className="px-4 py-3 font-semibold text-slate-900">{record.marketerName || "Company"}</td>
      <MoneyCell value={record.fuel} />
      <MoneyCell value={record.transport} />
      <MoneyCell value={record.loaderPayment} />
      <MoneyCell value={record.commission} />
      <MoneyCell value={record.airtime} />
      <MoneyCell value={record.food} />
      <MoneyCell value={record.miscellaneous} />
      <MoneyCell strong value={record.totalExpenses} />
      <MoneyCell strong value={record.closingBalance} />
      <td className="px-4 py-3">
        <ExpenseStatusChip record={record} />
      </td>
      <td className="px-4 py-3 text-slate-600">{record.notes || "-"}</td>
      <td className="px-4 py-3">
        <ExpenseAction record={record} setUnlockRecordId={setUnlockRecordId} user={user} />
      </td>
    </tr>
  );
}

function ExpenseCard({
  record,
  setUnlockRecordId,
  user
}: {
  record: ExpenseRecord;
  setUnlockRecordId: (recordId: string) => void;
  user: SessionUser;
}) {
  return (
    <article className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-950">{record.marketerName || "Company expense"}</h3>
          <p className="mt-1 text-sm text-slate-600">{formatDate(record.date)}</p>
        </div>
        <ExpenseStatusChip record={record} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <SummaryCard label="Total Expenses" value={`${formatMoney(record.totalExpenses)} RWF`} />
        <SummaryCard
          label="Closing Balance"
          tone={record.closingBalance < 0 ? "danger" : "default"}
          value={`${formatMoney(record.closingBalance)} RWF`}
        />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-600">{record.notes || "No notes"}</p>
      <div className="mt-4">
        <ExpenseAction record={record} setUnlockRecordId={setUnlockRecordId} user={user} />
      </div>
    </article>
  );
}

function ExpenseAction({
  record,
  setUnlockRecordId,
  user
}: {
  record: ExpenseRecord;
  setUnlockRecordId: (recordId: string) => void;
  user: SessionUser;
}) {
  if (user.role === "admin" && record.locked) {
    return (
      <button className="secondary-button" onClick={() => setUnlockRecordId(record.id)} type="button">
        <LockOpen className="h-4 w-4" />
        Unlock
      </button>
    );
  }

  return (
    <span className="inline-flex rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">
      {record.locked ? "Locked" : "Unlocked"}
    </span>
  );
}

function ExpenseStatusChip({ record }: { record: ExpenseRecord }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
        record.locked
          ? statusChipClass("confirmed")
          : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
    >
      {record.locked ? "Submitted" : "Unlocked"}
    </span>
  );
}

function MoneyCell({ strong = false, value }: { strong?: boolean; value: number }) {
  return (
    <td className={`px-4 py-3 text-right ${strong ? "font-black text-brand-800" : "text-slate-700"}`}>
      {formatMoney(value)}
    </td>
  );
}

function MoneyField({
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
    <FormField label={label}>
      <input
        className="form-input"
        disabled={disabled}
        min="0"
        onChange={(event) => onChange(event.target.value)}
        placeholder="0"
        type="number"
        value={value}
      />
    </FormField>
  );
}

function ReadOnlyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2">
      <p className="text-xs font-bold uppercase tracking-normal text-brand-800">{label}</p>
      <p className="mt-1 font-black text-brand-900">{value}</p>
    </div>
  );
}

function SummaryCard({
  label,
  tone = "default",
  value
}: {
  label: string;
  tone?: "danger" | "default";
  value: string;
}) {
  return (
    <article
      className={`rounded-lg border p-4 shadow-sm ${
        tone === "danger" ? "border-red-100 bg-red-50" : "border-brand-100 bg-white"
      }`}
    >
      <p className="text-xs font-black uppercase tracking-normal text-slate-500">{label}</p>
      <p className={tone === "danger" ? "mt-2 text-xl font-black text-red-800" : "mt-2 text-xl font-black text-brand-900"}>
        {value}
      </p>
    </article>
  );
}

function FormField({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-normal text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function formToExpenseInput(form: ExpenseForm): ExpenseInput {
  return {
    fuel: numberValue(form.fuel),
    transport: numberValue(form.transport),
    loaderPayment: numberValue(form.loaderPayment),
    commission: numberValue(form.commission),
    airtime: numberValue(form.airtime),
    food: numberValue(form.food),
    miscellaneous: numberValue(form.miscellaneous),
    notes: form.notes.trim()
  };
}

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
