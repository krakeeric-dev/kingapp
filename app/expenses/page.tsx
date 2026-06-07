"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { LockOpen, ReceiptText, Search, Send } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { SessionUser } from "@/lib/auth";
import { formatDate, getTodayIsoDate, statusChipClass } from "@/lib/loading-data";
import { formatMoney } from "@/lib/sales-data";
import {
  getExpenseRecords,
  submitBusinessExpenseRecord,
  unlockExpenseRecord,
  type BusinessExpenseInput,
  type ExpenseCategory,
  type ExpensePaymentMethod,
  type ExpenseRecord,
  type ExpenseStatus
} from "@/lib/expenses-data";

type ExpenseForm = {
  amount: string;
  category: ExpenseCategory;
  date: string;
  description: string;
  notes: string;
  paidTo: string;
  paymentMethod: ExpensePaymentMethod;
  receiptNumber: string;
  status: ExpenseStatus;
};

const expenseCategories: ExpenseCategory[] = [
  "Salaries",
  "Rent",
  "Fuel",
  "Internet",
  "Phone",
  "Car Rental",
  "Repairs",
  "Office Costs",
  "Transport",
  "Marketing",
  "Other"
];

const paymentMethods: ExpensePaymentMethod[] = [
  "Cash",
  "Mobile Money",
  "Bank Transfer",
  "Cheque",
  "Card",
  "Other"
];

const expenseStatuses: ExpenseStatus[] = ["Submitted", "Paid", "Pending"];

const initialForm: ExpenseForm = {
  amount: "",
  category: "Fuel",
  date: getTodayIsoDate(),
  description: "",
  notes: "",
  paidTo: "",
  paymentMethod: "Cash",
  receiptNumber: "",
  status: "Submitted"
};

export default function ExpensesPage() {
  return (
    <AppShell allowedRoles={["admin", "supervisor", "accountant"]}>
      {(user) => <ExpensesContent user={user} />}
    </AppShell>
  );
}

function ExpensesContent({ user }: { user: SessionUser }) {
  const [expenseRecords, setExpenseRecords] = useState<ExpenseRecord[]>([]);
  const [form, setForm] = useState<ExpenseForm>(initialForm);
  const [filters, setFilters] = useState({
    category: "",
    date: "",
    paymentMethod: "",
    status: ""
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [unlockRecordId, setUnlockRecordId] = useState("");
  const [unlockReason, setUnlockReason] = useState("");
  const [unlockError, setUnlockError] = useState("");

  useEffect(() => {
    setExpenseRecords(getExpenseRecords());
  }, []);

  const filteredExpenses = useMemo(() => {
    return expenseRecords.filter((record) => {
      const category = getRecordCategory(record);
      const paymentMethod = getRecordPaymentMethod(record);
      const status = getRecordStatus(record);

      return (
        (!filters.date || record.date === filters.date) &&
        (!filters.category || category === filters.category) &&
        (!filters.paymentMethod || paymentMethod === filters.paymentMethod) &&
        (!filters.status || status === filters.status)
      );
    });
  }, [expenseRecords, filters]);

  const monthlyExpenses = useMemo(() => {
    const currentMonth = getTodayIsoDate().slice(0, 7);
    return expenseRecords
      .filter((record) => record.date.startsWith(currentMonth))
      .reduce((total, record) => total + Number(record.totalExpenses || record.amount || 0), 0);
  }, [expenseRecords]);

  const dashboardTotals = useMemo(() => {
    return filteredExpenses.reduce(
      (totals, record) => {
        const amount = Number(record.totalExpenses || record.amount || 0);
        const category = getRecordCategory(record);
        const status = getRecordStatus(record);

        return {
          fuelTransport:
            totals.fuelTransport +
            (category === "Fuel" || category === "Transport" || category === "Car Rental"
              ? amount
              : 0),
          officeCosts:
            totals.officeCosts +
            (category === "Office Costs" ||
            category === "Internet" ||
            category === "Phone" ||
            category === "Rent" ||
            category === "Repairs"
              ? amount
              : 0),
          pendingExpenses: totals.pendingExpenses + (status === "Pending" ? amount : 0),
          salaries: totals.salaries + (category === "Salaries" ? amount : 0),
          totalExpenses: totals.totalExpenses + amount
        };
      },
      {
        fuelTransport: 0,
        officeCosts: 0,
        pendingExpenses: 0,
        salaries: 0,
        totalExpenses: 0
      }
    );
  }, [filteredExpenses]);

  function updateForm<Key extends keyof ExpenseForm>(field: Key, value: ExpenseForm[Key]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (user.role !== "accountant" && user.role !== "admin") {
      setError("Only accountant or admin can create expenses.");
      return;
    }

    const amount = Number(form.amount);

    if (!form.date || !form.category || !form.description.trim()) {
      setError("Date, category, and description are required.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }

    const input: BusinessExpenseInput = {
      amount,
      category: form.category,
      date: form.date,
      description: form.description.trim(),
      notes: form.notes.trim(),
      paidTo: form.paidTo.trim(),
      paymentMethod: form.paymentMethod,
      receiptNumber: form.receiptNumber.trim(),
      status: form.status
    };
    const result = submitBusinessExpenseRecord(input, user);
    setExpenseRecords(result.records);
    setForm({ ...initialForm, date: getTodayIsoDate() });
    setMessage("Expense submitted and locked.");
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
            <h2 className="text-2xl font-bold text-slate-950">
              Accountant Expenses Management
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Record business expenses, monitor monthly totals, and keep locked finance history.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Total Expenses" value={`${formatMoney(dashboardTotals.totalExpenses)} RWF`} />
        <SummaryCard label="Salaries" value={`${formatMoney(dashboardTotals.salaries)} RWF`} />
        <SummaryCard label="Fuel & Transport" value={`${formatMoney(dashboardTotals.fuelTransport)} RWF`} />
        <SummaryCard label="Office Costs" value={`${formatMoney(dashboardTotals.officeCosts)} RWF`} />
        <SummaryCard label="Pending Expenses" tone="warning" value={`${formatMoney(dashboardTotals.pendingExpenses)} RWF`} />
      </section>

      <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-1">
          <h3 className="text-lg font-black text-slate-950">Record Business Expense</h3>
          <p className="text-sm text-slate-600">
            Submitted expenses are locked immediately. Only admin can unlock or correct records.
          </p>
        </div>
        <form className="grid gap-3 lg:grid-cols-4" onSubmit={handleSubmitExpense}>
          <FormField label="Date">
            <input
              className="form-input"
              disabled={user.role !== "accountant" && user.role !== "admin"}
              onChange={(event) => updateForm("date", event.target.value)}
              type="date"
              value={form.date}
            />
          </FormField>
          <FormField label="Expense Category">
            <select
              className="form-input"
              disabled={user.role !== "accountant" && user.role !== "admin"}
              onChange={(event) => updateForm("category", event.target.value as ExpenseCategory)}
              value={form.category}
            >
              {expenseCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Amount">
            <input
              className="form-input"
              disabled={user.role !== "accountant" && user.role !== "admin"}
              min="0"
              onChange={(event) => updateForm("amount", event.target.value)}
              placeholder="0"
              type="number"
              value={form.amount}
            />
          </FormField>
          <FormField label="Payment Method">
            <select
              className="form-input"
              disabled={user.role !== "accountant" && user.role !== "admin"}
              onChange={(event) =>
                updateForm("paymentMethod", event.target.value as ExpensePaymentMethod)
              }
              value={form.paymentMethod}
            >
              {paymentMethods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Description">
            <input
              className="form-input"
              disabled={user.role !== "accountant" && user.role !== "admin"}
              onChange={(event) => updateForm("description", event.target.value)}
              placeholder="Expense description"
              value={form.description}
            />
          </FormField>
          <FormField label="Paid To">
            <input
              className="form-input"
              disabled={user.role !== "accountant" && user.role !== "admin"}
              onChange={(event) => updateForm("paidTo", event.target.value)}
              placeholder="Supplier or person"
              value={form.paidTo}
            />
          </FormField>
          <FormField label="Receipt Number">
            <input
              className="form-input"
              disabled={user.role !== "accountant" && user.role !== "admin"}
              onChange={(event) => updateForm("receiptNumber", event.target.value)}
              placeholder="Receipt number"
              value={form.receiptNumber}
            />
          </FormField>
          <FormField label="Status">
            <select
              className="form-input"
              disabled={user.role !== "accountant" && user.role !== "admin"}
              onChange={(event) => updateForm("status", event.target.value as ExpenseStatus)}
              value={form.status}
            >
              {expenseStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </FormField>
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
              Submit Expense
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
          <Search className="h-4 w-4 text-brand-700" />
          Filter expense history
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <FormField label="Date">
            <input
              className="form-input"
              onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))}
              type="date"
              value={filters.date}
            />
          </FormField>
          <FormField label="Category">
            <select
              className="form-input"
              onChange={(event) =>
                setFilters((current) => ({ ...current, category: event.target.value }))
              }
              value={filters.category}
            >
              <option value="">All categories</option>
              {expenseCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Payment Method">
            <select
              className="form-input"
              onChange={(event) =>
                setFilters((current) => ({ ...current, paymentMethod: event.target.value }))
              }
              value={filters.paymentMethod}
            >
              <option value="">All methods</option>
              {paymentMethods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Status">
            <select
              className="form-input"
              onChange={(event) =>
                setFilters((current) => ({ ...current, status: event.target.value }))
              }
              value={filters.status}
            >
              <option value="">All statuses</option>
              {expenseStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </FormField>
        </div>
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

      <section className="rounded-lg border border-brand-100 bg-white shadow-sm">
        <div className="flex flex-col gap-1 border-b border-slate-100 p-4">
          <h3 className="font-black text-slate-950">Expense History</h3>
          <p className="text-sm text-slate-600">
            Monthly total: {formatMoney(monthlyExpenses)} RWF
          </p>
        </div>
        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
            <thead className="bg-brand-50 text-xs font-bold uppercase tracking-normal text-brand-900">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Payment Method</th>
                <th className="px-4 py-3">Paid To</th>
                <th className="px-4 py-3">Receipt</th>
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
            <ExpenseMobileCard
              key={record.id}
              record={record}
              setUnlockRecordId={setUnlockRecordId}
              user={user}
            />
          ))}
        </div>
        {filteredExpenses.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm font-semibold text-slate-500">
            No expenses match the selected filters.
          </div>
        ) : null}
      </section>

      {unlockRecordId ? (
        <section className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
          <form className="space-y-3" onSubmit={handleUnlock}>
            <div>
              <h3 className="font-bold text-slate-950">Unlock expense record</h3>
              <p className="mt-1 text-sm text-slate-600">
                Only admin can unlock. The reason will be saved in the audit log.
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
      <td className="px-4 py-3 font-semibold text-slate-900">{getRecordCategory(record)}</td>
      <td className="px-4 py-3 text-slate-700">{record.description || record.productName}</td>
      <td className="px-4 py-3 text-right font-black text-brand-800">
        {formatMoney(Number(record.totalExpenses || record.amount || 0))}
      </td>
      <td className="px-4 py-3 text-slate-700">{getRecordPaymentMethod(record)}</td>
      <td className="px-4 py-3 text-slate-700">{record.paidTo || "-"}</td>
      <td className="px-4 py-3 text-slate-700">{record.receiptNumber || "-"}</td>
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

function ExpenseMobileCard({
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
          <h3 className="font-bold text-slate-950">{record.description || getRecordCategory(record)}</h3>
          <p className="mt-1 text-sm text-slate-600">{formatDate(record.date)}</p>
        </div>
        <ExpenseStatusChip record={record} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Info label="Category" value={getRecordCategory(record)} />
        <Info label="Amount" value={`${formatMoney(Number(record.totalExpenses || record.amount || 0))} RWF`} />
        <Info label="Method" value={getRecordPaymentMethod(record)} />
        <Info label="Paid To" value={record.paidTo || "-"} />
        <Info label="Receipt" value={record.receiptNumber || "-"} />
        <Info label="Notes" value={record.notes || "-"} />
      </div>
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
      <button
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-brand-200 px-3 py-2 text-sm font-bold text-brand-800 transition hover:bg-brand-50"
        onClick={() => setUnlockRecordId(record.id)}
        type="button"
      >
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
  const status = getRecordStatus(record);

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
        record.locked
          ? statusChipClass("confirmed")
          : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
    >
      {status}
    </span>
  );
}

function SummaryCard({
  label,
  tone = "default",
  value
}: {
  label: string;
  tone?: "default" | "warning";
  value: string;
}) {
  return (
    <article
      className={`rounded-lg border p-4 shadow-sm ${
        tone === "warning"
          ? "border-amber-100 bg-amber-50"
          : "border-brand-100 bg-white"
      }`}
    >
      <p className="text-xs font-black uppercase tracking-normal text-slate-500">{label}</p>
      <p className={tone === "warning" ? "mt-2 text-xl font-black text-amber-800" : "mt-2 text-xl font-black text-brand-900"}>
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

function getRecordCategory(record: ExpenseRecord) {
  return record.category ?? legacyCategory(record);
}

function getRecordPaymentMethod(record: ExpenseRecord) {
  return record.paymentMethod ?? "Cash";
}

function getRecordStatus(record: ExpenseRecord) {
  return record.status === "expenses_submitted" ? "Submitted" : record.status;
}

function legacyCategory(record: ExpenseRecord): ExpenseCategory {
  if (record.fuel > 0) return "Fuel";
  if (record.transport > 0) return "Transport";
  if (record.loaderPayment > 0) return "Salaries";
  if (record.commission > 0) return "Marketing";
  if (record.airtime > 0) return "Phone";
  return "Other";
}
