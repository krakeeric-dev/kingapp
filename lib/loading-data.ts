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
  date?: string;
  time?: string;
  userId?: string;
  username?: string;
  role?: string;
  companyId?: string;
  companyName?: string;
  module?: string;
  recordId: string;
  action: string;
  oldValue?: string;
  newValue?: string;
  reason: string;
  status?: string;
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
  return readJson<AuditLogEntry[]>(AUDIT_LOG_KEY, []).map(normalizeAuditEntry);
}

export function appendAuditLog(entry: AuditLogEntry) {
  const entries = getAuditLog();
  const updatedEntries = [normalizeAuditEntry(entry), ...entries];
  writeJson(AUDIT_LOG_KEY, updatedEntries);
  mirrorRecordsToSupabase(
    "audit_logs",
    updatedEntries,
    (record) => record.id,
    (record) => record.createdAt
  );
}

export function logAuditEvent(input: {
  action: string;
  companyId?: string;
  companyName?: string;
  module: string;
  newValue?: unknown;
  oldValue?: unknown;
  reason?: string;
  recordId: string;
  status?: string;
  user?: SessionUser | null;
}) {
  const now = new Date();
  appendAuditLog({
    id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase(),
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 8),
    userId: input.user?.id ?? "",
    username: input.user?.username ?? input.user?.displayName ?? "System",
    role: input.user?.role ?? "system",
    companyId: input.companyId ?? input.user?.companyId ?? "",
    companyName: input.companyName ?? input.user?.companyName ?? "",
    module: input.module,
    action: input.action,
    recordId: input.recordId,
    oldValue: stringifyAuditValue(input.oldValue),
    newValue: stringifyAuditValue(input.newValue),
    reason: input.reason ?? input.action,
    status: input.status ?? "success",
    performedBy: input.user?.displayName ?? "System",
    performedByRole: input.user?.role ?? "system",
    createdAt: now.toISOString()
  });
}

function normalizeAuditEntry(entry: AuditLogEntry): AuditLogEntry {
  const createdAt = entry.createdAt || new Date().toISOString();
  return {
    ...entry,
    date: entry.date ?? createdAt.slice(0, 10),
    time: entry.time ?? new Date(createdAt).toTimeString().slice(0, 8),
    username: entry.username ?? entry.performedBy,
    role: entry.role ?? entry.performedByRole,
    module: entry.module ?? inferAuditModule(entry.action),
    status: entry.status ?? "success",
    createdAt
  };
}

function stringifyAuditValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function inferAuditModule(action: string) {
  if (action.includes("user")) return "Users";
  if (action.includes("price")) return "Prices";
  if (action.includes("inventory")) return "Inventory";
  if (action.includes("cash")) return "Cash";
  if (action.includes("sales")) return "Sales";
  if (action.includes("return")) return "Returns";
  if (action.includes("expense")) return "Expenses";
  if (action.includes("reset") || action.includes("historical")) return "Admin";
  return "Loading";
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
