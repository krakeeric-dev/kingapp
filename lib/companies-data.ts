import type { SessionUser } from "@/lib/auth";
import { upsertSupabaseRows } from "@/lib/supabase";

export type CompanyStatus = "active" | "inactive" | "archived";

export type Company = {
  id: string;
  code: string;
  name: string;
  type: string;
  phone: string;
  email: string;
  address: string;
  logo: string;
  status: CompanyStatus;
  createdAt: string;
  updatedAt: string;
};

const COMPANIES_KEY = "kingapp.companies";
const ACTIVE_COMPANY_KEY = "kingapp.activeCompanyId";
const DEFAULT_CREATED_AT = "2026-06-02T00:00:00.000Z";

export const defaultCompanyId = "";
export const defaultCompanyName = "No company selected";

export const defaultCompanies: Company[] = [];

const retiredCompanyIds = new Set([
  "COMP-AGAHOZO",
  "COMP-TEJU",
  "COMP-KING-HONEY",
  "COMP-KING-EGGS"
]);

const linkedCompanyRecordKeys = [
  "kingapp.users",
  "kingapp.clientPortal.clients",
  "kingapp.clientPortal.suppliers",
  "kingapp.clientPortal.supplierClients",
  "kingapp.clientPortal.orders",
  "kingapp.clientPortal.messages",
  "kingapp.productMaster",
  "kingapp.priceHistory",
  "kingapp.inventoryMovements",
  "kingapp.minimumStock",
  "kingapp.rawMaterialMaster",
  "kingapp.rawMaterialMinimums",
  "kingapp.rawMaterialMovements",
  "kingapp.loadingRecords",
  "kingapp.salesRecords",
  "kingapp.returnRecords",
  "kingapp.cashRecords",
  "kingapp.expenseRecords",
  "kingapp.marketerClients",
  "kingapp.customerAccounts",
  "kingapp.customerDebts",
  "kingapp.customerPayments",
  "kingapp.customerDebtApprovals",
  "kingapp.callCenter.clients",
  "kingapp.callCenter.agents",
  "kingapp.callCenter.queueCalls",
  "kingapp.callCenter.missedCalls",
  "kingapp.callCenter.callbacks",
  "kingapp.callCenter.complaints",
  "kingapp.callCenter.paymentFollowUps",
  "kingapp.callCenter.pendingOrders",
  "kingapp.callCenter.followUps",
  "kingapp.callCenter.numbers",
  "kingapp.callCenter.manualCalls",
  "kingapp.callCenter.companyMessages",
  "kingapp.callCenter.messages",
  "kingapp.callCenter.announcements",
  "kingapp.callCenter.internalNotifications",
  "kingapp.callCenter.chatMessages",
  "kingapp.delivery.records",
  "kingapp.delivery.drivers",
  "kingapp.delivery.vehicles",
  "kingapp.telephony.recordings"
];

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

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

function normalizeCompany(company: Partial<Company> & { id: string; name: string; type?: string; status?: CompanyStatus }): Company {
  const now = new Date().toISOString();
  return {
    id: company.id,
    code: company.code ?? "",
    name: company.name,
    type: company.type ?? "",
    phone: company.phone ?? "",
    email: company.email ?? "",
    address: company.address ?? "",
    logo: company.logo ?? "",
    status: company.status ?? "active",
    createdAt: company.createdAt ?? now,
    updatedAt: company.updatedAt ?? company.createdAt ?? now
  };
}

export function getCompanies(options: { includeArchived?: boolean } = {}) {
  const current = readJson<Company[]>(COMPANIES_KEY, defaultCompanies);
  const merged = current
    .filter((company) => !retiredCompanyIds.has(company.id))
    .map(normalizeCompany)
    .filter((company) => options.includeArchived || company.status !== "archived");
  const changed = merged.length !== current.length;

  if (changed) {
    writeJson(COMPANIES_KEY, merged);
  }

  return merged;
}

export function saveCompanies(companies: Company[]) {
  writeJson(COMPANIES_KEY, companies);
  void upsertSupabaseRows(
    "companies",
    companies,
    (record) => record.id,
    (record) => record.updatedAt
  );
  return companies;
}

export function getCompanyById(companyId?: string) {
  return getCompanies({ includeArchived: true }).find((company) => company.id === companyId) ?? null;
}

export function getCompanyName(companyId?: string, fallback = defaultCompanyName) {
  return getCompanyById(companyId)?.name ?? fallback;
}

export function getActiveCompanyId(user?: Pick<SessionUser, "role" | "companyId"> | null) {
  if (typeof window === "undefined") return user?.companyId ?? defaultCompanyId;
  if (user?.role === "admin") {
    return window.localStorage.getItem(ACTIVE_COMPANY_KEY) ?? user.companyId ?? "all";
  }
  return user?.companyId ?? defaultCompanyId;
}

export function setActiveCompanyId(companyId: string) {
  writeJson(ACTIVE_COMPANY_KEY, companyId);
  return companyId;
}

export function getAssignedCompanyIds(user?: Pick<SessionUser, "assignedCompanies" | "companyId" | "role"> | null) {
  if (!user) return [];
  if (user.role === "admin" || user.assignedCompanies?.includes("all") || user.companyId === "all") {
    return ["all"];
  }
  const assigned = user.assignedCompanies?.length ? user.assignedCompanies : [user.companyId];
  return Array.from(new Set(assigned.filter(Boolean)));
}

export function canAccessCompany(
  user: Pick<SessionUser, "assignedCompanies" | "companyId" | "role">,
  companyId?: string | null
) {
  const assigned = getAssignedCompanyIds(user);
  if (assigned.includes("all")) return true;
  if (!companyId) return false;
  return assigned.includes(companyId);
}

export function getCompanyWorkspaceId(user: Pick<SessionUser, "assignedCompanies" | "companyId" | "role">) {
  const assigned = getAssignedCompanyIds(user);
  if (typeof window === "undefined") return assigned[0] ?? user.companyId;
  const active = window.localStorage.getItem(ACTIVE_COMPANY_KEY) ?? user.companyId;
  if (assigned.includes("all")) return active || "all";
  if (active && assigned.includes(active)) return active;
  return assigned[0] ?? user.companyId;
}

export function filterByAssignedCompanies<T extends object>(
  records: T[],
  user: Pick<SessionUser, "assignedCompanies" | "companyId" | "role">,
  getRecordCompanyId?: (record: T) => string | undefined
) {
  const workspaceId = getCompanyWorkspaceId(user);
  return records.filter((record) => {
    const companyId = getRecordCompanyId ? getRecordCompanyId(record) : (record as { companyId?: string }).companyId;
    if (workspaceId !== "all") return companyId === workspaceId;
    return canAccessCompany(user, companyId);
  });
}

export function createCompany(input: Pick<Company, "address" | "code" | "email" | "logo" | "name" | "phone" | "status" | "type">) {
  const now = new Date().toISOString();
  const company: Company = {
    ...input,
    id: makeId("COMP"),
    code: input.code.trim(),
    name: input.name.trim(),
    type: input.type.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    address: input.address.trim(),
    logo: input.logo.trim(),
    createdAt: now,
    updatedAt: now
  };
  return saveCompanies([company, ...getCompanies({ includeArchived: true })]);
}

export function updateCompany(companyId: string, updates: Pick<Company, "address" | "code" | "email" | "logo" | "name" | "phone" | "status" | "type">) {
  return saveCompanies(
    getCompanies({ includeArchived: true }).map((company) =>
      company.id === companyId
        ? {
            ...company,
            ...updates,
            code: updates.code.trim(),
            name: updates.name.trim(),
            type: updates.type.trim(),
            phone: updates.phone.trim(),
            email: updates.email.trim(),
            address: updates.address.trim(),
            logo: updates.logo.trim(),
            updatedAt: new Date().toISOString()
          }
        : company
    )
  );
}

function recordBelongsToCompany(record: unknown, companyId: string) {
  const typedRecord = record as {
    companyId?: string;
    assignedCompanies?: string[];
    supplierId?: string;
    clientId?: string;
  };
  return typedRecord.companyId === companyId || typedRecord.assignedCompanies?.includes(companyId);
}

function removeCompanyLinkedRows(companyId: string) {
  if (typeof window === "undefined") return [];
  const changedKeys: string[] = [];

  linkedCompanyRecordKeys.forEach((key) => {
    const records = readJson<unknown[]>(key, []);
    if (!Array.isArray(records) || records.length === 0) return;
    const filteredRecords = records.filter((record) => !recordBelongsToCompany(record, companyId));
    if (filteredRecords.length !== records.length) {
      writeJson(key, filteredRecords);
      changedKeys.push(key);
    }
  });

  return changedKeys;
}

export function getCompanyLinkedRecordSummary(companyId: string) {
  if (typeof window === "undefined") return { total: 0, byKey: [] as Array<{ key: string; count: number }> };
  const byKey = linkedCompanyRecordKeys
    .map((key) => {
      const records = readJson<unknown[]>(key, []);
      const count = Array.isArray(records) ? records.filter((record) => recordBelongsToCompany(record, companyId)).length : 0;
      return { key, count };
    })
    .filter((item) => item.count > 0);

  return {
    byKey,
    total: byKey.reduce((sum, item) => sum + item.count, 0)
  };
}

export function archiveCompany(companyId: string) {
  const company = getCompanyById(companyId);
  if (!company) return getCompanies({ includeArchived: true });
  return updateCompany(companyId, { ...company, status: "archived" });
}

export function removeCompany(companyId: string, mode: "archive" | "permanent") {
  if (mode === "archive") {
    return { companies: archiveCompany(companyId), removedKeys: [] };
  }

  const removedKeys = removeCompanyLinkedRows(companyId);
  const companies = saveCompanies(getCompanies({ includeArchived: true }).filter((company) => company.id !== companyId));
  if (typeof window !== "undefined" && window.localStorage.getItem(ACTIVE_COMPANY_KEY) === companyId) {
    writeJson(ACTIVE_COMPANY_KEY, "all");
  }

  return { companies, removedKeys };
}

export function canSeeCompanyRecord(
  user: Pick<SessionUser, "role" | "companyId">,
  recordCompanyId?: string
) {
  if (user.role === "admin") {
    const activeCompanyId = getActiveCompanyId(user);
    if (activeCompanyId === "all") return true;
    return recordCompanyId === activeCompanyId;
  }
  if (!recordCompanyId) return false;
  return recordCompanyId === user.companyId;
}

export function filterCompanyRecords<T extends object>(
  records: T[],
  user: Pick<SessionUser, "role" | "companyId">
) {
  return records.filter((record) =>
    canSeeCompanyRecord(user, (record as { companyId?: string }).companyId)
  );
}
