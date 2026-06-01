import type { SessionUser } from "@/lib/auth";
import type { CashRecord } from "@/lib/cash-data";
import { mirrorRecordsToSupabase } from "@/lib/live-data";
import { appendAuditLog, getTodayIsoDate } from "@/lib/loading-data";
import { dedupeById } from "@/lib/record-utils";

export type ExpenseStatus = "expenses_submitted";

export type ExpenseRecord = {
  id: string;
  cashRecordId: string;
  date: string;
  productName: string;
  marketerUsername: string;
  marketerName: string;
  expectedCash: number;
  cashReceived: number;
  cashVariance: number;
  fuel: number;
  transport: number;
  loaderPayment: number;
  commission: number;
  airtime: number;
  food: number;
  miscellaneous: number;
  notes: string;
  totalExpenses: number;
  closingBalance: number;
  status: ExpenseStatus;
  locked: boolean;
  accountantUsername: string;
  accountantName: string;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseInput = {
  fuel: number;
  transport: number;
  loaderPayment: number;
  commission: number;
  airtime: number;
  food: number;
  miscellaneous: number;
  notes: string;
};

const EXPENSE_RECORDS_KEY = "kingapp.expenseRecords";

function readJson<T>(key: string, fallback: T): T {
  const rawValue = window.localStorage.getItem(key);

  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    window.localStorage.removeItem(key);
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getExpenseRecords() {
  return dedupeById(readJson<ExpenseRecord[]>(EXPENSE_RECORDS_KEY, []));
}

export function saveExpenseRecords(records: ExpenseRecord[]) {
  const dedupedRecords = dedupeById(records);
  writeJson(EXPENSE_RECORDS_KEY, dedupedRecords);
  mirrorRecordsToSupabase(
    "expenses_records",
    dedupedRecords,
    (record) => record.id,
    (record) => record.updatedAt ?? record.createdAt
  );
}

export function calculateTotalExpenses(input: ExpenseInput) {
  return (
    input.fuel +
    input.transport +
    input.loaderPayment +
    input.commission +
    input.airtime +
    input.food +
    input.miscellaneous
  );
}

export function submitExpenseRecord(
  cashRecord: CashRecord,
  input: ExpenseInput,
  accountant: SessionUser,
  existingRecord?: ExpenseRecord
) {
  const now = new Date().toISOString();
  const totalExpenses = calculateTotalExpenses(input);
  const closingBalance = cashRecord.cashReceived - totalExpenses;
  const record: ExpenseRecord = existingRecord
    ? {
        ...existingRecord,
        ...input,
        totalExpenses,
        closingBalance,
        status: "expenses_submitted",
        locked: true,
        accountantUsername: accountant.username,
        accountantName: accountant.displayName,
        submittedAt: now,
        updatedAt: now
      }
    : {
        id: `EXP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase(),
        cashRecordId: cashRecord.id,
        date: cashRecord.date,
        productName: cashRecord.productName,
        marketerUsername: cashRecord.marketerUsername,
        marketerName: cashRecord.marketerName,
        expectedCash: cashRecord.expectedCash,
        cashReceived: cashRecord.cashReceived,
        cashVariance: cashRecord.cashVariance,
        ...input,
        totalExpenses,
        closingBalance,
        status: "expenses_submitted",
        locked: true,
        accountantUsername: accountant.username,
        accountantName: accountant.displayName,
        submittedAt: now,
        createdAt: now,
        updatedAt: now
      };

  return {
    record,
    records: upsertExpenseRecord(record)
  };
}

export function upsertExpenseRecord(record: ExpenseRecord) {
  const records = getExpenseRecords();
  const existingIndex = records.findIndex((item) => item.id === record.id);

  if (existingIndex >= 0) {
    records[existingIndex] = record;
  } else {
    records.unshift(record);
  }

  saveExpenseRecords(records);
  return records;
}

export function unlockExpenseRecord(
  recordId: string,
  reason: string,
  user: SessionUser
) {
  const records = getExpenseRecords();
  const updatedRecords = records.map((record) =>
    record.id === recordId
      ? {
          ...record,
          locked: false,
          updatedAt: new Date().toISOString()
        }
      : record
  );

  saveExpenseRecords(updatedRecords);
  appendAuditLog({
    id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase(),
    recordId,
    action: "unlock_expenses",
    reason,
    performedBy: user.displayName,
    performedByRole: user.role,
    createdAt: new Date().toISOString()
  });

  return updatedRecords;
}

export function getExpensesDashboardTotals(records: ExpenseRecord[]) {
  const today = getTodayIsoDate();
  const todaysExpenses = records.filter((record) => record.date === today);

  return {
    totalExpensesToday: todaysExpenses.reduce(
      (total, record) => total + record.totalExpenses,
      0
    ),
    closingCashBalanceToday: todaysExpenses.reduce(
      (total, record) => total + record.closingBalance,
      0
    )
  };
}
