import type { SessionUser } from "@/lib/auth";
import { mirrorRecordsToSupabase } from "@/lib/live-data";
import {
  appendAuditLog,
  getTodayIsoDate,
  type LoadingRecord
} from "@/lib/loading-data";
import { dedupeById } from "@/lib/record-utils";

export type SalesStatus = "draft" | "sales_submitted";

export type PaymentStatus = "Paid" | "Partial" | "Unpaid" | "Not Paid";

export type ClientSaleLine = {
  id: string;
  clientName: string;
  clientPhone: string;
  clientLocation: string;
  saleDate?: string;
  marketerName?: string;
  productName: string;
  itemCode: string;
  productQuantities?: Record<string, number>;
  productAmounts?: Record<string, number>;
  quantityCartons: number;
  pricePerCarton: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  amountPaid: number;
  balance: number;
  notes: string;
};

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
  clientSales?: ClientSaleLine[];
  totalPaid?: number;
  totalUnpaidBalance?: number;
  clientsServed?: number;
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
  return dedupeById(readJson<SalesRecord[]>(SALES_RECORDS_KEY, [])).map(
    normalizeSalesRecord
  );
}

export function saveSalesRecords(records: SalesRecord[]) {
  const normalizedRecords = dedupeById(records).map(normalizeSalesRecord);
  writeJson(SALES_RECORDS_KEY, normalizedRecords);
  mirrorRecordsToSupabase(
    "sales_records",
    normalizedRecords,
    (record) => record.id,
    (record) => record.updatedAt ?? record.createdAt
  );
}

export function normalizeSalesRecord(record: SalesRecord): SalesRecord {
  const clientSales = record.clientSales ?? [];

  if (clientSales.length === 0) {
    return {
      ...record,
      clientsServed: record.clientsServed ?? 0,
      totalPaid: record.totalPaid ?? record.salesValue,
      totalUnpaidBalance: record.totalUnpaidBalance ?? 0
    };
  }

  const soldCartons = clientSales.reduce(
    (total, row) => total + (Number(row.quantityCartons) || 0),
    0
  );
  const salesValue = clientSales.reduce(
    (total, row) => total + (Number(row.totalAmount) || 0),
    0
  );
  const totalPaid = clientSales.reduce(
    (total, row) => total + (Number(row.amountPaid) || 0),
    0
  );
  const totalUnpaidBalance = clientSales.reduce(
    (total, row) => total + (Number(row.balance) || 0),
    0
  );

  return {
    ...record,
    soldCartons,
    expectedReturnCartons: record.loadedCartons - soldCartons,
    salesValue,
    totalPaid,
    totalUnpaidBalance,
    clientsServed: clientSales.length
  };
}

export function getSalesRecordForLoad(loadingRecordId: string) {
  return getSalesRecords().find(
    (record) => record.loadingRecordId === loadingRecordId
  );
}

export function createSalesRecordFromLoad(
  loadingRecord: LoadingRecord,
  soldCartons: number,
  clientSales: ClientSaleLine[] = []
): SalesRecord {
  const now = new Date().toISOString();
  const expectedReturnCartons = loadingRecord.loadedCartons - soldCartons;
  const salesValue =
    clientSales.length > 0
      ? clientSales.reduce((total, row) => total + row.totalAmount, 0)
      : soldCartons * loadingRecord.pricePerCarton;
  const totalPaid = clientSales.reduce((total, row) => total + row.amountPaid, 0);
  const totalUnpaidBalance = clientSales.reduce(
    (total, row) => total + row.balance,
    0
  );

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
    salesValue,
    clientSales,
    totalPaid,
    totalUnpaidBalance,
    clientsServed: clientSales.length,
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
  existingRecord?: SalesRecord,
  clientSales: ClientSaleLine[] = []
) {
  const now = new Date().toISOString();
  const expectedReturnCartons = loadingRecord.loadedCartons - soldCartons;
  const salesValue =
    clientSales.length > 0
      ? clientSales.reduce((total, row) => total + row.totalAmount, 0)
      : soldCartons * loadingRecord.pricePerCarton;
  const totalPaid = clientSales.reduce((total, row) => total + row.amountPaid, 0);
  const totalUnpaidBalance = clientSales.reduce(
    (total, row) => total + row.balance,
    0
  );
  const record = existingRecord
    ? {
        ...existingRecord,
        soldCartons,
        expectedReturnCartons,
        salesValue,
        clientSales,
        totalPaid,
        totalUnpaidBalance,
        clientsServed: clientSales.length,
        status: "sales_submitted" as const,
        locked: true,
        submittedAt: now,
        updatedAt: now
      }
    : createSalesRecordFromLoad(loadingRecord, soldCartons, clientSales);

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
