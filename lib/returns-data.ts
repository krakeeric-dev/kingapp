import type { SessionUser } from "@/lib/auth";
import { mirrorRecordsToSupabase } from "@/lib/live-data";
import { appendAuditLog, getTodayIsoDate } from "@/lib/loading-data";
import type { SalesRecord } from "@/lib/sales-data";

export type ReturnStatus = "return_received";

export type ReturnRecord = {
  id: string;
  salesRecordId: string;
  date: string;
  productName: string;
  itemCode: string;
  marketerUsername: string;
  marketerName: string;
  loadedCartons: number;
  soldCartons: number;
  expectedReturnCartons: number;
  actualReturnCartons: number;
  stockVariance: number;
  status: ReturnStatus;
  locked: boolean;
  storekeeperUsername: string;
  storekeeperName: string;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
};

const RETURN_RECORDS_KEY = "kingapp.returnRecords";

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

export function getReturnRecords() {
  return readJson<ReturnRecord[]>(RETURN_RECORDS_KEY, []);
}

export function saveReturnRecords(records: ReturnRecord[]) {
  writeJson(RETURN_RECORDS_KEY, records);
  mirrorRecordsToSupabase(
    "returns_records",
    records,
    (record) => record.id,
    (record) => record.updatedAt ?? record.createdAt
  );
}

export function upsertReturnRecord(record: ReturnRecord) {
  const records = getReturnRecords();
  const existingIndex = records.findIndex((item) => item.id === record.id);

  if (existingIndex >= 0) {
    records[existingIndex] = record;
  } else {
    records.unshift(record);
  }

  saveReturnRecords(records);
  return records;
}

export function submitReturnRecord(
  salesRecord: SalesRecord,
  actualReturnCartons: number,
  storekeeper: SessionUser,
  existingRecord?: ReturnRecord
) {
  const now = new Date().toISOString();
  const stockVariance = salesRecord.expectedReturnCartons - actualReturnCartons;
  const record: ReturnRecord = existingRecord
    ? {
        ...existingRecord,
        actualReturnCartons,
        stockVariance,
        status: "return_received",
        locked: true,
        storekeeperUsername: storekeeper.username,
        storekeeperName: storekeeper.displayName,
        submittedAt: now,
        updatedAt: now
      }
    : {
        id: `RET-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase(),
        salesRecordId: salesRecord.id,
        date: salesRecord.date,
        productName: salesRecord.productName,
        itemCode: salesRecord.itemCode,
        marketerUsername: salesRecord.marketerUsername,
        marketerName: salesRecord.marketerName,
        loadedCartons: salesRecord.loadedCartons,
        soldCartons: salesRecord.soldCartons,
        expectedReturnCartons: salesRecord.expectedReturnCartons,
        actualReturnCartons,
        stockVariance,
        status: "return_received",
        locked: true,
        storekeeperUsername: storekeeper.username,
        storekeeperName: storekeeper.displayName,
        submittedAt: now,
        createdAt: now,
        updatedAt: now
      };

  return {
    record,
    records: upsertReturnRecord(record)
  };
}

export function unlockReturnRecord(
  recordId: string,
  reason: string,
  user: SessionUser
) {
  const records = getReturnRecords();
  const updatedRecords = records.map((record) =>
    record.id === recordId
      ? {
          ...record,
          locked: false,
          updatedAt: new Date().toISOString()
        }
      : record
  );

  saveReturnRecords(updatedRecords);
  appendAuditLog({
    id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase(),
    recordId,
    action: "unlock_return",
    reason,
    performedBy: user.displayName,
    performedByRole: user.role,
    createdAt: new Date().toISOString()
  });

  return updatedRecords;
}

export function getReturnsDashboardTotals(records: ReturnRecord[]) {
  const today = getTodayIsoDate();
  const todaysReturns = records.filter((record) => record.date === today);

  return {
    returnsReceivedToday: todaysReturns.reduce(
      (total, record) => total + record.actualReturnCartons,
      0
    ),
    stockVarianceToday: todaysReturns.reduce(
      (total, record) => total + record.stockVariance,
      0
    )
  };
}
