export type UserRole =
  | "admin"
  | "supervisor"
  | "storekeeper"
  | "accountant"
  | "manager"
  | "marketer";

export type MockUser = {
  username: string;
  password: string;
  displayName: string;
  role: UserRole;
};

export type SessionUser = Omit<MockUser, "password">;

export const mockUsers: MockUser[] = [
  {
    username: "admin",
    password: "admin123",
    displayName: "System Admin",
    role: "admin"
  },
  {
    username: "supervisor",
    password: "supervisor123",
    displayName: "Supervisor",
    role: "supervisor"
  },
  {
    username: "storekeeper",
    password: "store123",
    displayName: "Storekeeper",
    role: "storekeeper"
  },
  {
    username: "accountant",
    password: "cashier123",
    displayName: "Accountant",
    role: "accountant"
  },
  {
    username: "manager",
    password: "manager123",
    displayName: "Manager",
    role: "manager"
  },
  {
    username: "marketer1",
    password: "marketer123",
    displayName: "Marketer 1",
    role: "marketer"
  }
];

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

  const rawUsers = window.localStorage.getItem("kingapp.users");

  if (!rawUsers) {
    return mockUsers;
  }

  try {
    return JSON.parse(rawUsers) as MockUser[];
  } catch {
    window.localStorage.removeItem("kingapp.users");
    return mockUsers;
  }
}

export function authenticateUser(
  username: string,
  password: string
): SessionUser | null {
  const user = getAvailableUsers().find(
    (mockUser) =>
      mockUser.username.toLowerCase() === username.trim().toLowerCase() &&
      mockUser.password === password
  );

  if (!user) {
    return null;
  }

  const { password: _password, ...sessionUser } = user;
  return sessionUser;
}
