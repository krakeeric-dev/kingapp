import type { SessionUser, UserRole } from "@/lib/auth";
import {
  defaultCompanyId,
  defaultCompanyName,
  getCompanyName
} from "@/lib/companies-data";
import { upsertSupabaseRows } from "@/lib/supabase";

export type UserStatus = "active" | "inactive";

export type PlatformUser = {
  id: string;
  username: string;
  password: string;
  name: string;
  displayName: string;
  role: UserRole;
  companyId: string;
  companyName: string;
  phone: string;
  email: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
};

const USERS_KEY = "kingapp.users";
const AUDIT_LOG_KEY = "kingapp.auditLog";
const DEFAULT_CREATED_AT = "2026-05-30T00:00:00.000Z";

export const defaultUsers: PlatformUser[] = [
  {
    id: "USER-ADMIN",
    username: "admin",
    password: "admin123",
    name: "System Admin",
    displayName: "System Admin",
    role: "admin",
    companyId: "all",
    companyName: "All Companies",
    phone: "",
    email: "admin@kingapp.local",
    status: "active",
    createdAt: DEFAULT_CREATED_AT,
    updatedAt: DEFAULT_CREATED_AT
  },
  {
    id: "USER-SUPERVISOR",
    username: "supervisor",
    password: "supervisor123",
    name: "Supervisor",
    displayName: "Supervisor",
    role: "supervisor",
    companyId: defaultCompanyId,
    companyName: defaultCompanyName,
    phone: "",
    email: "supervisor@kingapp.local",
    status: "active",
    createdAt: DEFAULT_CREATED_AT,
    updatedAt: DEFAULT_CREATED_AT
  },
  {
    id: "USER-STOREKEEPER",
    username: "storekeeper",
    password: "store123",
    name: "Storekeeper",
    displayName: "Storekeeper",
    role: "storekeeper",
    companyId: defaultCompanyId,
    companyName: defaultCompanyName,
    phone: "",
    email: "storekeeper@kingapp.local",
    status: "active",
    createdAt: DEFAULT_CREATED_AT,
    updatedAt: DEFAULT_CREATED_AT
  },
  {
    id: "USER-ACCOUNTANT",
    username: "accountant",
    password: "cashier123",
    name: "Accountant",
    displayName: "Accountant",
    role: "accountant",
    companyId: defaultCompanyId,
    companyName: defaultCompanyName,
    phone: "",
    email: "accountant@kingapp.local",
    status: "active",
    createdAt: DEFAULT_CREATED_AT,
    updatedAt: DEFAULT_CREATED_AT
  },
  {
    id: "USER-MANAGER",
    username: "manager",
    password: "manager123",
    name: "Manager",
    displayName: "Manager",
    role: "manager",
    companyId: defaultCompanyId,
    companyName: defaultCompanyName,
    phone: "",
    email: "manager@kingapp.local",
    status: "active",
    createdAt: DEFAULT_CREATED_AT,
    updatedAt: DEFAULT_CREATED_AT
  },
  {
    id: "USER-MARKETER1",
    username: "marketer1",
    password: "marketer123",
    name: "Marketer 1",
    displayName: "Marketer 1",
    role: "marketer",
    companyId: defaultCompanyId,
    companyName: defaultCompanyName,
    phone: "",
    email: "marketer1@kingapp.local",
    status: "active",
    createdAt: DEFAULT_CREATED_AT,
    updatedAt: DEFAULT_CREATED_AT
  },
  {
    id: "USER-CALLCENTER",
    username: "callcenter",
    password: "call123",
    name: "Call Center Agent",
    displayName: "Call Center Agent",
    role: "callcenter",
    companyId: defaultCompanyId,
    companyName: defaultCompanyName,
    phone: "",
    email: "callcenter@kingapp.local",
    status: "active",
    createdAt: DEFAULT_CREATED_AT,
    updatedAt: DEFAULT_CREATED_AT
  }
];

type LegacyUser = Partial<PlatformUser> & {
  username: string;
  password: string;
  displayName: string;
  role: UserRole;
};

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

function appendUserAuditLog(entry: {
  id: string;
  recordId: string;
  action:
    | "user_created"
    | "user_edited"
    | "user_deactivated"
    | "user_password_reset"
    | "user_removed";
  reason: string;
  performedBy: string;
  performedByRole: string;
  createdAt: string;
}) {
  const entries = readJson<typeof entry[]>(AUDIT_LOG_KEY, []);
  const updatedEntries = [entry, ...entries];

  writeJson(AUDIT_LOG_KEY, updatedEntries);
  void upsertSupabaseRows(
    "audit_logs",
    updatedEntries,
    (record) => record.id,
    (record) => record.createdAt
  );
}

function normalizeUser(user: LegacyUser): PlatformUser {
  const defaultUser = defaultUsers.find(
    (item) => item.username.toLowerCase() === user.username.toLowerCase()
  );
  const createdAt = user.createdAt ?? defaultUser?.createdAt ?? new Date().toISOString();

  return {
    id: user.id ?? defaultUser?.id ?? `USER-${user.username.toUpperCase()}`,
    username: user.username,
    password: user.password,
    name: user.name ?? user.displayName,
    displayName: user.displayName,
    role: user.role,
    companyId: user.companyId ?? defaultUser?.companyId ?? defaultCompanyId,
    companyName:
      user.companyName ??
      defaultUser?.companyName ??
      getCompanyName(user.companyId ?? defaultCompanyId),
    phone: user.phone ?? "",
    email: user.email ?? "",
    status: user.status ?? "active",
    createdAt,
    updatedAt: user.updatedAt ?? createdAt
  };
}

function ensureDefaultUsers(users: PlatformUser[]) {
  const mergedUsers = [...users];
  let changed = false;

  defaultUsers.forEach((defaultUser) => {
    const existingIndex = mergedUsers.findIndex(
      (user) => user.username.toLowerCase() === defaultUser.username.toLowerCase()
    );

    if (existingIndex >= 0) {
      mergedUsers[existingIndex] = {
        ...defaultUser,
        ...mergedUsers[existingIndex],
        password: mergedUsers[existingIndex].password || defaultUser.password,
        status: mergedUsers[existingIndex].status || "active"
      };
    } else {
      mergedUsers.push(defaultUser);
      changed = true;
    }
  });

  return { changed, users: mergedUsers };
}

function auditUserAction({
  action,
  reason,
  targetUsername,
  user
}: {
  action:
    | "user_created"
    | "user_edited"
    | "user_deactivated"
    | "user_password_reset"
    | "user_removed";
  reason: string;
  targetUsername: string;
  user: SessionUser;
}) {
  appendUserAuditLog({
    id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase(),
    recordId: targetUsername,
    action,
    reason,
    performedBy: user.displayName,
    performedByRole: user.role,
    createdAt: new Date().toISOString()
  });
}

export function saveUsers(users: PlatformUser[]) {
  writeJson(USERS_KEY, users);
  void upsertSupabaseRows(
    "users",
    users,
    (record) => record.username,
    (record) => record.updatedAt
  );
  return users;
}

export function getUsers() {
  const rawUsers = readJson<LegacyUser[]>(USERS_KEY, defaultUsers);
  const normalizedUsers = rawUsers.map(normalizeUser);
  const { changed, users } = ensureDefaultUsers(normalizedUsers);

  if (changed) {
    writeJson(USERS_KEY, users);
  }

  return users;
}

export function createUser(
  input: Omit<PlatformUser, "id" | "createdAt" | "updatedAt"> & { id?: string },
  admin: SessionUser
) {
  const users = getUsers();
  const now = new Date().toISOString();
  const newUser: PlatformUser = {
    ...input,
    id: input.id || `USER-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase(),
    username: input.username.trim(),
    name: input.name.trim(),
    displayName: input.displayName.trim(),
    companyName: getCompanyName(input.companyId, input.companyName),
    phone: input.phone.trim(),
    email: input.email.trim(),
    createdAt: now,
    updatedAt: now
  };
  const updatedUsers = [newUser, ...users];

  saveUsers(updatedUsers);
  auditUserAction({
    action: "user_created",
    reason: `User created: ${newUser.displayName} (${newUser.role})`,
    targetUsername: newUser.username,
    user: admin
  });
  return updatedUsers;
}

export function updateUser(
  username: string,
  input: Pick<PlatformUser, "displayName" | "role" | "phone" | "email" | "status" | "companyId">,
  admin: SessionUser
) {
  const users = getUsers();
  const updatedUsers = users.map((user) =>
    user.username === username
      ? {
          ...user,
          ...input,
          name: input.displayName.trim(),
          displayName: input.displayName.trim(),
          companyName: getCompanyName(input.companyId, user.companyName),
          phone: input.phone.trim(),
          email: input.email.trim(),
          updatedAt: new Date().toISOString()
        }
      : user
  );

  saveUsers(updatedUsers);
  auditUserAction({
    action: input.status === "inactive" ? "user_deactivated" : "user_edited",
    reason:
      input.status === "inactive"
        ? `User deactivated: ${username}`
        : `User edited: ${username}`,
    targetUsername: username,
    user: admin
  });
  return updatedUsers;
}

export function resetUserPassword(
  username: string,
  password: string,
  admin: SessionUser
) {
  const users = getUsers();
  const updatedUsers = users.map((user) =>
    user.username === username
      ? {
          ...user,
          password,
          updatedAt: new Date().toISOString()
        }
      : user
  );

  saveUsers(updatedUsers);
  auditUserAction({
    action: "user_password_reset",
    reason: `Password reset for user: ${username}`,
    targetUsername: username,
    user: admin
  });
  return updatedUsers;
}

export function removeUser(username: string, admin: SessionUser) {
  const updatedUsers = getUsers().filter((user) => user.username !== username);

  saveUsers(updatedUsers);
  auditUserAction({
    action: "user_removed",
    reason: `User removed: ${username}`,
    targetUsername: username,
    user: admin
  });
  return updatedUsers;
}
