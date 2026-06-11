import type { CallType } from "@/lib/call-center-data";
import { callCenterCompanies } from "@/lib/call-center-operations";
import { getAssignedCompanyIds, getCompanyWorkspaceId } from "@/lib/companies-data";
import type { SessionUser } from "@/lib/auth";

export type CallCenterNumberStatus = "Active" | "Inactive";
export type CallCenterNumberPurpose =
  | "Sales Calls"
  | "Customer Support"
  | "Payment Follow-up"
  | "Complaints"
  | "Delivery Support";

export type CallCenterNumber = {
  id: string;
  companyId: string;
  companyName: string;
  phoneNumber: string;
  label: string;
  purpose: CallCenterNumberPurpose;
  status: CallCenterNumberStatus;
  assignedAgentUsernames: string[];
  createdAt: string;
  updatedAt: string;
};

export type ManualCallLogStatus = "Open" | "Closed" | "Pending Follow-up";

export type ManualCallLog = {
  id: string;
  clientName: string;
  clientPhone: string;
  companyId: string;
  companyName: string;
  callType: CallType;
  summary: string;
  followUp: string;
  status: ManualCallLogStatus;
  agent: string;
  createdAt: string;
};

export type CompanyMessageLog = {
  id: string;
  clientName: string;
  clientPhone: string;
  companyId: string;
  companyName: string;
  message: string;
  status: "New" | "Read" | "Replied" | "Closed";
  agent: string;
  createdAt: string;
};

const NUMBERS_KEY = "kingapp.callCenter.numbers";
const MANUAL_CALLS_KEY = "kingapp.callCenter.manualCalls";
const MESSAGE_LOGS_KEY = "kingapp.callCenter.companyMessages";

const defaultNumbers: CallCenterNumber[] = [];

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const rawValue = window.localStorage.getItem(key);
  if (!rawValue) return fallback;

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    window.localStorage.removeItem(key);
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function companyName(companyId: string) {
  return callCenterCompanies.find((company) => company.id === companyId)?.name ?? companyId;
}

export function getCallCenterNumbers() {
  const seedIds = new Set(defaultNumbers.map((number) => number.id));
  const records = readJson<CallCenterNumber[]>(NUMBERS_KEY, []);
  const filtered = records.filter((record) => !seedIds.has(record.id));
  if (filtered.length !== records.length) writeJson(NUMBERS_KEY, filtered);
  return filtered;
}

export function saveCallCenterNumber(input: Omit<CallCenterNumber, "id" | "companyName" | "createdAt" | "updatedAt"> & { id?: string }) {
  const records = getCallCenterNumbers();
  const now = new Date().toISOString();
  const nextNumber: CallCenterNumber = {
    ...input,
    id: input.id || `CCN-${Date.now()}`,
    companyName: companyName(input.companyId),
    createdAt: records.find((record) => record.id === input.id)?.createdAt ?? now,
    updatedAt: now
  };
  const updated = records.some((record) => record.id === nextNumber.id)
    ? records.map((record) => (record.id === nextNumber.id ? nextNumber : record))
    : [nextNumber, ...records];
  writeJson(NUMBERS_KEY, updated);
  return updated;
}

export function getNumbersForUser(user: SessionUser) {
  const assignedCompanies = getAssignedCompanyIds(user);
  const activeCompany = getCompanyWorkspaceId(user);
  const records = getCallCenterNumbers();

  if (user.role === "admin") {
    return activeCompany === "all" ? records : records.filter((record) => record.companyId === activeCompany);
  }

  return records.filter((record) => {
    const companyAllowed = assignedCompanies.includes("all") || assignedCompanies.includes(record.companyId);
    const numberAssigned = record.assignedAgentUsernames.includes(user.username);
    return companyAllowed && (user.role !== "callcenter" || numberAssigned);
  });
}

export function getManualCallLogs() {
  return readJson<ManualCallLog[]>(MANUAL_CALLS_KEY, []);
}

export function addManualCallLog(input: Omit<ManualCallLog, "id" | "companyName" | "agent" | "createdAt">, user: SessionUser) {
  const record: ManualCallLog = {
    ...input,
    id: `MCL-${Date.now()}`,
    companyName: companyName(input.companyId),
    agent: user.displayName,
    createdAt: new Date().toISOString()
  };
  const updated = [record, ...getManualCallLogs()];
  writeJson(MANUAL_CALLS_KEY, updated);
  return updated;
}

export function getCompanyMessageLogs() {
  return readJson<CompanyMessageLog[]>(MESSAGE_LOGS_KEY, []);
}

export function addCompanyMessageLog(input: Omit<CompanyMessageLog, "id" | "companyName" | "agent" | "createdAt">, user: SessionUser) {
  const record: CompanyMessageLog = {
    ...input,
    id: `CML-${Date.now()}`,
    companyName: companyName(input.companyId),
    agent: user.displayName,
    createdAt: new Date().toISOString()
  };
  const updated = [record, ...getCompanyMessageLogs()];
  writeJson(MESSAGE_LOGS_KEY, updated);
  return updated;
}
