import type { SessionUser } from "@/lib/auth";
import type { CashRecord } from "@/lib/cash-data";
import { mirrorRecordsToSupabase } from "@/lib/live-data";
import { appendAuditLog, getTodayIsoDate } from "@/lib/loading-data";
import { dedupeById } from "@/lib/record-utils";

export type ExpenseStatus = "Pending" | "Paid" | "Submitted" | "expenses_submitted";

export type ExpenseCategory =
  | "Salaries"
  | "Rent"
  | "Fuel"
  | "Internet"
  | "Phone"
  | "Car Rental"
  | "Repairs"
  | "Office Costs"
  | "Transport"
  | "Marketing"
  | "Other";

export type ExpensePaymentMethod =
  | "Cash"
  | "Mobile Money"
  | "Bank Transfer"
  | "Cheque"
  | "Card"
  | "Other";

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
  openingCash?: number;
  category?: ExpenseCategory;
  description?: string;
  amount?: number;
  paymentMethod?: ExpensePaymentMethod;
  paidTo?: string;
  receiptNumber?: string;
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

export type BusinessExpenseInput = {
  amount: number;
  category: ExpenseCategory;
  date: string;
  description: string;
  notes: string;
  paidTo: string;
  paymentMethod: ExpensePaymentMethod;
  receiptNumber: string;
  status: ExpenseStatus;
};

export type GeneralExpenseInput = ExpenseInput & {
  cashReceived: number;
  date: string;
  marketerName: string;
  marketerUsername: string;
  openingCash: number;
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

export function submitBusinessExpenseRecord(
  input: BusinessExpenseInput,
  accountant: SessionUser,
  existingRecord?: ExpenseRecord
) {
  const now = new Date().toISOString();
  const amount = input.amount;
  const categoryAmounts = mapCategoryToLegacyAmounts(input.category, amount);
  const record: ExpenseRecord = existingRecord
    ? {
        ...existingRecord,
        ...categoryAmounts,
        amount,
        category: input.category,
        closingBalance: -amount,
        date: input.date,
        description: input.description,
        locked: true,
        notes: input.notes,
        paidTo: input.paidTo,
        paymentMethod: input.paymentMethod,
        receiptNumber: input.receiptNumber,
        status: input.status,
        totalExpenses: amount,
        accountantUsername: accountant.username,
        accountantName: accountant.displayName,
        submittedAt: now,
        updatedAt: now
      }
    : {
        id: `EXP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase(),
        cashRecordId: "",
        date: input.date,
        productName: "Business Expense",
        marketerUsername: "",
        marketerName: "",
        expectedCash: 0,
        cashReceived: 0,
        cashVariance: 0,
        ...categoryAmounts,
        amount,
        category: input.category,
        closingBalance: -amount,
        description: input.description,
        locked: true,
        notes: input.notes,
        paidTo: input.paidTo,
        paymentMethod: input.paymentMethod,
        receiptNumber: input.receiptNumber,
        status: input.status,
        totalExpenses: amount,
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

export function submitGeneralExpenseRecord(
  input: GeneralExpenseInput,
  accountant: SessionUser,
  existingRecord?: ExpenseRecord
) {
  const now = new Date().toISOString();
  const totalExpenses = calculateTotalExpenses(input);
  const closingBalance = input.openingCash + input.cashReceived - totalExpenses;
  const record: ExpenseRecord = existingRecord
    ? {
        ...existingRecord,
        fuel: input.fuel,
        transport: input.transport,
        loaderPayment: input.loaderPayment,
        commission: input.commission,
        airtime: input.airtime,
        food: input.food,
        miscellaneous: input.miscellaneous,
        notes: input.notes,
        cashReceived: input.cashReceived,
        closingBalance,
        date: input.date,
        expectedCash: input.cashReceived,
        locked: true,
        marketerName: input.marketerName,
        marketerUsername: input.marketerUsername,
        openingCash: input.openingCash,
        productName: "General Operations",
        status: "expenses_submitted",
        totalExpenses,
        accountantUsername: accountant.username,
        accountantName: accountant.displayName,
        submittedAt: now,
        updatedAt: now
      }
    : {
        id: `EXP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase(),
        cashRecordId: `GENERAL-${input.date}-${input.marketerUsername || "all"}`,
        date: input.date,
        productName: "General Operations",
        marketerUsername: input.marketerUsername,
        marketerName: input.marketerName,
        expectedCash: input.cashReceived,
        cashReceived: input.cashReceived,
        cashVariance: 0,
        fuel: input.fuel,
        transport: input.transport,
        loaderPayment: input.loaderPayment,
        commission: input.commission,
        airtime: input.airtime,
        food: input.food,
        miscellaneous: input.miscellaneous,
        notes: input.notes,
        closingBalance,
        locked: true,
        openingCash: input.openingCash,
        status: "expenses_submitted",
        totalExpenses,
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

function mapCategoryToLegacyAmounts(category: ExpenseCategory, amount: number) {
  return {
    fuel: category === "Fuel" ? amount : 0,
    transport: category === "Transport" || category === "Car Rental" ? amount : 0,
    loaderPayment: category === "Salaries" ? amount : 0,
    commission: category === "Marketing" ? amount : 0,
    airtime: category === "Phone" || category === "Internet" ? amount : 0,
    food: 0,
    miscellaneous:
      category === "Other" ||
      category === "Rent" ||
      category === "Repairs" ||
      category === "Office Costs"
        ? amount
        : 0
  };
}
