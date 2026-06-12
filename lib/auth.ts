import { defaultUsers, getUsers, type PlatformUser } from "@/lib/users-data";
import { getCompanyById } from "@/lib/companies-data";
import { canLoginOffline } from "@/lib/storage";

export type UserRole =
  | "admin"
  | "supervisor"
  | "storekeeper"
  | "accountant"
  | "manager"
  | "marketer"
  | "callcenter"
  | "supplier"
  | "client";

export type MockUser = PlatformUser;

export type SessionUser = Omit<MockUser, "password">;

export const mockUsers: MockUser[] = defaultUsers;

export const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  storekeeper: "Storekeeper",
  accountant: "Accountant",
  manager: "Manager",
  marketer: "Marketer",
  callcenter: "Call Center Agent",
  supplier: "Supplier",
  client: "Client"
};

function getAvailableUsers() {
  if (typeof window === "undefined") {
    return mockUsers;
  }

  try {
    return getUsers();
  } catch (error) {
    console.warn("[KingApp] Falling back to default login users", error);
    return mockUsers;
  }
}

export function authenticateUser(
  username: string,
  password: string
): SessionUser | null {
  const normalizedLogin = username.trim().toLowerCase();

  if (
    typeof navigator !== "undefined" &&
    !navigator.onLine &&
    !canLoginOffline(username.trim())
  ) {
    return null;
  }

  const user = getAvailableUsers().find(
    (mockUser) =>
      (mockUser.username.toLowerCase() === normalizedLogin ||
        mockUser.email.toLowerCase() === normalizedLogin) &&
      mockUser.password === password &&
      mockUser.status !== "inactive"
  ) ?? mockUsers.find(
    (mockUser) =>
      (mockUser.username.toLowerCase() === normalizedLogin ||
        mockUser.email.toLowerCase() === normalizedLogin) &&
      mockUser.password === password &&
      mockUser.status !== "inactive"
  );

  if (!user) {
    return null;
  }

  if (user.role !== "admin" && user.companyId) {
    const company = getCompanyById(user.companyId);
    if (!company || company.status !== "active") {
      return null;
    }
  }

  const { password: _password, ...sessionUser } = user;
  return sessionUser;
}
