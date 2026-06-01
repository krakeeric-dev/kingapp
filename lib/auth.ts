import { defaultUsers, getUsers, type PlatformUser } from "@/lib/users-data";
import { canLoginOffline } from "@/lib/storage";

export type UserRole =
  | "admin"
  | "supervisor"
  | "storekeeper"
  | "accountant"
  | "manager"
  | "marketer";

export type MockUser = PlatformUser;

export type SessionUser = Omit<MockUser, "password">;

export const mockUsers: MockUser[] = defaultUsers;

export const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  storekeeper: "Storekeeper",
  accountant: "Accountant",
  manager: "Manager",
  marketer: "Marketer"
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
  const normalizedUsername = username.trim().toLowerCase();

  if (
    typeof navigator !== "undefined" &&
    !navigator.onLine &&
    !canLoginOffline(username.trim())
  ) {
    return null;
  }

  const user = getAvailableUsers().find(
    (mockUser) =>
      mockUser.username.toLowerCase() === normalizedUsername &&
      mockUser.password === password &&
      mockUser.status !== "inactive"
  ) ?? mockUsers.find(
    (mockUser) =>
      mockUser.username.toLowerCase() === normalizedUsername &&
      mockUser.password === password &&
      mockUser.status !== "inactive"
  );

  if (!user) {
    return null;
  }

  const { password: _password, ...sessionUser } = user;
  return sessionUser;
}
