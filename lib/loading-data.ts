import type { SessionUser } from "@/lib/auth";
import { mirrorRecordsToSupabase } from "@/lib/live-data";
import { dedupeById } from "@/lib/record-utils";

export type LoadingStatus = "draft" | "pending" | "confirmed" | "rejected";

export type LoadingRecord = {
  id: string;
  date: string;
  productName: string;
  itemCode: string;
  pricePerCarton: number;
  marketerUsername: string;
  marketerName: string;
  truck: string;
  loadedCartons: number;
  notes: string;
  status: LoadingStatus;
  storekeeperUsername: string;
  storekeeperName: string;
  locked: boolean;
  rejectionReason?: string;
  confirmedAt?: string;
  rejectedAt?: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type AuditLogEntry = {
  id: string;
  recordId: string;
  action:
    | "unlock"
    | "unlock_sales"
    | "unlock_cash"
    | "unlock_return"
    | "unlock_expenses"
    | "inventory_adjustment"
    | "price_change"
    | "user_created"
    | "user_edited"
    | "user_deactivated"
    | "user_password_reset"
    | "user_removed";
  reason: string;
  performedBy: string;
  performedByRole: string;
  createdAt: string;
};

const LOADING_RECORDS_KEY = "kingapp.loadingRecords";
const AUDIT_LOG_KEY = "kingapp.auditLog";

export const statusLabels: Record<LoadingStatus, string> = {
  draft: "Draft",
  pending: "Pending Marketer Confirmation",
  confirmed: "Confirmed",
  rejected: "Rejected"
};

export function createRecordId() {
  return `LOAD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

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

export function getLoadingRecords() {
  return dedupeById(readJson<LoadingRecord[]>(LOADING_RECORDS_KEY, []));
}

export function saveLoadingRecords(records: LoadingRecord[]) {
  const dedupedRecords = dedupeById(records);
  writeJson(LOADING_RECORDS_KEY, dedupedRecords);
  mirrorRecordsToSupabase(
    "loading_records",
    dedupedRecords,
    (record) => record.id,
    (record) => record.updatedAt ?? record.createdAt
  );
}

export function upsertLoadingRecord(record: LoadingRecord) {
  const records = getLoadingRecords();
  const existingIndex = records.findIndex((item) => item.id === record.id);

  if (existingIndex >= 0) {
    records[existingIndex] = record;
  } else {
    records.unshift(record);
  }

  saveLoadingRecords(records);
  return records;
}

export function getAuditLog() {
  return readJson<AuditLogEntry[]>(AUDIT_LOG_KEY, []);
}

export function appendAuditLog(entry: AuditLogEntry) {
  const entries = getAuditLog();
  const updatedEntries = [entry, ...entries];
  writeJson(AUDIT_LOG_KEY, updatedEntries);
  mirrorRecordsToSupabase(
    "audit_logs",
    updatedEntries,
    (record) => record.id,
    (record) => record.createdAt
  );
}

export function unlockLoadingRecord(
  recordId: string,
  reason: string,
  user: SessionUser
) {
  const records = getLoadingRecords();
  const updatedRecords = records.map((record) =>
    record.id === recordId
      ? {
          ...record,
          locked: false,
          updatedAt: new Date().toISOString()
        }
      : record
  );

  saveLoadingRecords(updatedRecords);
  appendAuditLog({
    id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase(),
    recordId,
    action: "unlock",
    reason,
    performedBy: user.displayName,
    performedByRole: user.role,
    createdAt: new Date().toISOString()
  });

  return updatedRecords;
}

export function getTodayIsoDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatDate(value: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function statusChipClass(status: LoadingStatus) {
  if (status === "confirmed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "rejected") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (status === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}
