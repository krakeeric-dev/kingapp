import type { UserRole } from "@/lib/auth";

export const pagePermissions: Record<string, UserRole[]> = {
  "/dashboard": ["admin", "manager", "supervisor", "storekeeper", "marketer", "accountant"],
  "/call-center": ["admin", "manager", "callcenter"],
  "/call-center/queue": ["admin", "manager", "callcenter"],
  "/call-center/agents": ["admin", "manager", "callcenter"],
  "/call-center/missed-calls": ["admin", "manager", "callcenter"],
  "/call-center/callbacks": ["admin", "manager", "callcenter"],
  "/call-center/settings": ["admin"],
  "/call-center/softphone": ["admin", "callcenter"],
  "/call-center/live-monitor": ["admin", "manager"],
  "/call-center/analytics": ["admin", "manager"],
  "/call-center/production-checklist": ["admin", "manager"],
  "/client-orders": ["admin", "storekeeper", "accountant", "marketer", "manager", "supervisor"],
  "/loading": ["admin", "supervisor", "storekeeper"],
  "/inventory": ["admin", "manager", "supervisor", "storekeeper"],
  "/price-management": ["admin"],
  "/confirm-loading": ["admin", "supervisor", "marketer"],
  "/sales": ["admin", "manager", "supervisor", "marketer", "accountant"],
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
