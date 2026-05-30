import type { SessionUser } from "@/lib/auth";
import { mirrorRecordsToSupabase } from "@/lib/live-data";
import {
  appendAuditLog,
  getTodayIsoDate,
  type LoadingRecord
} from "@/lib/loading-data";

export type SalesStatus = "draft" | "sales_submitted";

export type SalesRecord = {
  id: string;
  loadingRecordId: string;
  date: string;
  productName: string;
  itemCode: string;
  pricePerCarton: number;
  marketerUsername: string;
  marketerName: string;
  truck: string;
  loadedCartons: number;
  soldCartons: number;
  expectedReturnCartons: number;
  salesValue: number;
  status: SalesStatus;
  locked: boolean;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
};

const SALES_RECORDS_KEY = "kingapp.salesRecords";

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

export function getSalesRecords() {
  return readJson<SalesRecord[]>(SALES_RECORDS_KEY, []);
}

export function saveSalesRecords(records: SalesRecord[]) {
  writeJson(SALES_RECORDS_KEY, records);
  mirrorRecordsToSupabase(
    "sales_records",
    records,
    (record) => record.id,
    (record) => record.updatedAt ?? record.createdAt
  );
}

export function getSalesRecordForLoad(loadingRecordId: string) {
  return getSalesRecords().find(
    (record) => record.loadingRecordId === loadingRecordId
  );
}

export function createSalesRecordFromLoad(
  loadingRecord: LoadingRecord,
  soldCartons: number
): SalesRecord {
  const now = new Date().toISOString();
  const expectedReturnCartons = loadingRecord.loadedCartons - soldCartons;

  return {
    id: `SALE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase(),
    loadingRecordId: loadingRecord.id,
    date: loadingRecord.date,
    productName: loadingRecord.productName,
    itemCode: loadingRecord.itemCode,
    pricePerCarton: loadingRecord.pricePerCarton,
    marketerUsername: loadingRecord.marketerUsername,
    marketerName: loadingRecord.marketerName,
    truck: loadingRecord.truck,
    loadedCartons: loadingRecord.loadedCartons,
    soldCartons,
    expectedReturnCartons,
    salesValue: soldCartons * loadingRecord.pricePerCarton,
    status: "sales_submitted",
    locked: true,
    submittedAt: now,
    createdAt: now,
    updatedAt: now
  };
}

export function upsertSalesRecord(record: SalesRecord) {
  const records = getSalesRecords();
  const existingIndex = records.findIndex((item) => item.id === record.id);

  if (existingIndex >= 0) {
    records[existingIndex] = record;
  } else {
    records.unshift(record);
  }

  saveSalesRecords(records);
  return records;
}

export function submitSalesRecord(
  loadingRecord: LoadingRecord,
  soldCartons: number,
  existingRecord?: SalesRecord
) {
  const now = new Date().toISOString();
  const expectedReturnCartons = loadingRecord.loadedCartons - soldCartons;
  const salesValue = soldCartons * loadingRecord.pricePerCarton;
  const record = existingRecord
    ? {
        ...existingRecord,
        soldCartons,
        expectedReturnCartons,
        salesValue,
        status: "sales_submitted" as const,
        locked: true,
        submittedAt: now,
        updatedAt: now
      }
    : createSalesRecordFromLoad(loadingRecord, soldCartons);

  return {
    record,
    records: upsertSalesRecord(record)
  };
}

export function unlockSalesRecord(
  recordId: string,
  reason: string,
  user: SessionUser
) {
  const records = getSalesRecords();
  const updatedRecords = records.map((record) =>
    record.id === recordId
      ? {
          ...record,
          locked: false,
          updatedAt: new Date().toISOString()
        }
      : record
  );

  saveSalesRecords(updatedRecords);
  appendAuditLog({
    id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase(),
    recordId,
    action: "unlock_sales",
    reason,
    performedBy: user.displayName,
    performedByRole: user.role,
    createdAt: new Date().toISOString()
  });

  return updatedRecords;
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  }).format(value);
}

export function getSalesDashboardTotals(records: SalesRecord[]) {
  const today = getTodayIsoDate();
  const todaysSales = records.filter(
    (record) => record.date === today && record.status === "sales_submitted"
  );

  return {
    totalSoldToday: todaysSales.reduce(
      (total, record) => total + record.soldCartons,
      0
    ),
    expectedReturnsToday: todaysSales.reduce(
      (total, record) => total + record.expectedReturnCartons,
      0
    ),
    totalSalesValue: todaysSales.reduce(
      (total, record) => total + record.salesValue,
      0
    )
  };
}
