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

export const defaultCompanyId = "COMP-AGAHOZO";
export const defaultCompanyName = "Agahozo Water";

export const defaultCompanies: Company[] = [
  {
    id: "COMP-AGAHOZO",
    name: "Agahozo Water",
    type: "Beverage Distribution",
    status: "active",
    createdAt: DEFAULT_CREATED_AT,
    updatedAt: DEFAULT_CREATED_AT
  },
  {
    id: "COMP-TEJU",
    name: "Teju Juice",
    type: "Juice Distribution",
    status: "active",
    createdAt: DEFAULT_CREATED_AT,
    updatedAt: DEFAULT_CREATED_AT
  },
  {
    id: "COMP-KING-HONEY",
    name: "King Honey",
    type: "Honey Distribution",
    status: "active",
    createdAt: DEFAULT_CREATED_AT,
    updatedAt: DEFAULT_CREATED_AT
  },
  {
    id: "COMP-KING-EGGS",
    name: "King Eggs",
    type: "Fresh Goods Distribution",
    status: "active",
    createdAt: DEFAULT_CREATED_AT,
    updatedAt: DEFAULT_CREATED_AT
  }
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

export function getCompanies() {
  const current = readJson<Company[]>(COMPANIES_KEY, defaultCompanies);
  const merged = [...current];
  let changed = false;

  defaultCompanies.forEach((company) => {
    const exists = merged.some((item) => item.id === company.id);
    if (!exists) {
      merged.push(company);
      changed = true;
    }
  });

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
  if (user.role === "admin") return true;
  if (!recordCompanyId) return true;
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
