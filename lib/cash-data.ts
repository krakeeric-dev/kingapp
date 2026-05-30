import type { SessionUser } from "@/lib/auth";
import { mirrorRecordsToSupabase } from "@/lib/live-data";
import { appendAuditLog, getTodayIsoDate } from "@/lib/loading-data";
import type { SalesRecord } from "@/lib/sales-data";

export type CashStatus = "cash_submitted";

export type CashRecord = {
  id: string;
  salesRecordId: string;
  date: string;
  productName: string;
  itemCode: string;
  marketerUsername: string;
  marketerName: string;
  loadedCartons: number;
  soldCartons: number;
  pricePerCarton: number;
  expectedCash: number;
  cashReceived: number;
  cashVariance: number;
  status: CashStatus;
  locked: boolean;
  accountantUsername: string;
  accountantName: string;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
};

const CASH_RECORDS_KEY = "kingapp.cashRecords";

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

export function getCashRecords() {
  return readJson<CashRecord[]>(CASH_RECORDS_KEY, []);
}

export function saveCashRecords(records: CashRecord[]) {
  writeJson(CASH_RECORDS_KEY, records);
  mirrorRecordsToSupabase(
    "cash_records",
    records,
    (record) => record.id,
    (record) => record.updatedAt ?? record.createdAt
  );
}

export function submitCashRecord(
  salesRecord: SalesRecord,
  cashReceived: number,
  accountant: SessionUser,
  existingRecord?: CashRecord
) {
  const now = new Date().toISOString();
  const cashVariance = cashReceived - salesRecord.salesValue;
  const record: CashRecord = existingRecord
    ? {
        ...existingRecord,
        cashReceived,
        cashVariance,
        status: "cash_submitted",
        locked: true,
        accountantUsername: accountant.username,
        accountantName: accountant.displayName,
        submittedAt: now,
        updatedAt: now
      }
    : {
        id: `CASH-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase(),
        salesRecordId: salesRecord.id,
        date: salesRecord.date,
        productName: salesRecord.productName,
        itemCode: salesRecord.itemCode,
        marketerUsername: salesRecord.marketerUsername,
        marketerName: salesRecord.marketerName,
        loadedCartons: salesRecord.loadedCartons,
        soldCartons: salesRecord.soldCartons,
        pricePerCarton: salesRecord.pricePerCarton,
        expectedCash: salesRecord.salesValue,
        cashReceived,
        cashVariance,
        status: "cash_submitted",
        locked: true,
        accountantUsername: accountant.username,
        accountantName: accountant.displayName,
        submittedAt: now,
        createdAt: now,
        updatedAt: now
      };

  return {
    record,
    records: upsertCashRecord(record)
  };
}

export function upsertCashRecord(record: CashRecord) {
  const records = getCashRecords();
  const existingIndex = records.findIndex((item) => item.id === record.id);

  if (existingIndex >= 0) {
    records[existingIndex] = record;
  } else {
    records.unshift(record);
  }

  saveCashRecords(records);
  return records;
}

export function unlockCashRecord(
  recordId: string,
  reason: string,
  user: SessionUser
) {
  const records = getCashRecords();
  const updatedRecords = records.map((record) =>
    record.id === recordId
      ? {
          ...record,
          locked: false,
          updatedAt: new Date().toISOString()
        }
      : record
  );

  saveCashRecords(updatedRecords);
  appendAuditLog({
    id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase(),
    recordId,
    action: "unlock_cash",
    reason,
    performedBy: user.displayName,
    performedByRole: user.role,
    createdAt: new Date().toISOString()
  });

  return updatedRecords;
}

export function getCashDashboardTotals(records: CashRecord[]) {
  const today = getTodayIsoDate();
  const todaysCash = records.filter((record) => record.date === today);

  return {
    cashReceivedToday: todaysCash.reduce(
      (total, record) => total + record.cashReceived,
      0
    ),
    cashVarianceToday: todaysCash.reduce(
      (total, record) => total + record.cashVariance,
      0
    )
  };
}
