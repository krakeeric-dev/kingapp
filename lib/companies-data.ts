import type { SessionUser } from "@/lib/auth";
import { upsertSupabaseRows } from "@/lib/supabase";

export type CompanyStatus = "active" | "inactive";

export type Company = {
  id: string;
  name: string;
  type: string;
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

export function getCompanies() {
  const current = readJson<Company[]>(COMPANIES_KEY, defaultCompanies);
  const merged = current.filter((company) => !retiredCompanyIds.has(company.id));
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
  return getCompanies().find((company) => company.id === companyId) ?? null;
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

export function createCompany(input: Pick<Company, "name" | "type" | "status">) {
  const now = new Date().toISOString();
  const company: Company = {
    ...input,
    id: makeId("COMP"),
    name: input.name.trim(),
    type: input.type.trim(),
    createdAt: now,
    updatedAt: now
  };
  return saveCompanies([company, ...getCompanies()]);
}

export function updateCompany(companyId: string, updates: Pick<Company, "name" | "type" | "status">) {
  return saveCompanies(
    getCompanies().map((company) =>
      company.id === companyId
        ? {
            ...company,
            ...updates,
            name: updates.name.trim(),
            type: updates.type.trim(),
            updatedAt: new Date().toISOString()
          }
        : company
    )
  );
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
