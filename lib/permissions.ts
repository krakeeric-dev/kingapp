import type { UserRole } from "@/lib/auth";

export const pagePermissions: Record<string, UserRole[]> = {
  "/dashboard": ["admin", "manager", "supervisor", "storekeeper", "marketer", "accountant"],
  "/loading": ["admin", "supervisor", "storekeeper"],
  "/inventory": ["admin", "manager", "supervisor", "storekeeper"],
  "/price-management": ["admin"],
  "/confirm-loading": ["admin", "supervisor", "marketer"],
  "/sales": ["admin", "supervisor", "marketer"],
  "/returns": ["admin", "supervisor", "storekeeper"],
  "/cash": ["admin", "supervisor", "accountant"],
  "/expenses": ["admin", "supervisor", "accountant"],
  "/daily-report": ["admin", "manager", "supervisor", "accountant"],
  "/reports": ["admin", "manager", "supervisor"],
  "/sync-status": ["admin", "manager", "supervisor", "storekeeper", "marketer", "accountant"],
  "/admin/audit-log": ["admin"],
  "/admin/users": ["admin"]
};

export function getAllowedRoles(pathname: string) {
  return pagePermissions[pathname] ?? ["admin"];
}

export function canAccessPage(pathname: string, role: UserRole) {
  return getAllowedRoles(pathname).includes(role);
}
