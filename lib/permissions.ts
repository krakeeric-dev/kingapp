import type { SessionUser, UserRole } from "@/lib/auth";

export type PermissionKey =
  | "dashboard.view"
  | "loading.view"
  | "loading.create"
  | "loading.edit"
  | "loading.approve"
  | "loading.confirm"
  | "inventory.view"
  | "inventory.receive"
  | "inventory.adjust"
  | "inventory.product.edit"
  | "inventory.price.change"
  | "rawmaterials.view"
  | "rawmaterials.update"
  | "rawmaterials.edit"
  | "rawmaterials.unlock"
  | "sales.view"
  | "sales.create"
  | "sales.edit"
  | "sales.unlock"
  | "cash.view"
  | "cash.record"
  | "cash.edit"
  | "cash.unlock"
  | "returns.view"
  | "returns.receive"
  | "returns.edit"
  | "expenses.view"
  | "expenses.record"
  | "expenses.approve"
  | "reports.view"
  | "reports.export"
  | "reports.print"
  | "reports.daily.view"
  | "callcenter.view"
  | "callcenter.queue.manage"
  | "callcenter.calls.answer"
  | "callcenter.calls.transfer"
  | "callcenter.recordings.view"
  | "callcenter.messages.view"
  | "callcenter.messages.send"
  | "callcenter.complaints.manage"
  | "callcenter.callbacks.manage"
  | "clientorders.view"
  | "clientorders.approve"
  | "clients.manage"
  | "clients.message"
  | "supplier.view"
  | "supplier.orders.manage"
  | "supplier.message"
  | "admin.users.manage"
  | "admin.companies.manage"
  | "admin.roles.manage"
  | "admin.audit.view"
  | "admin.permissions.manage"
  | "executive.view"
  | "executive.company.switch"
  | "executive.allCompanies.view"
  | "sync.view"
  | "debug.offline.view";

export type PermissionGroup = {
  title: string;
  permissions: Array<{ key: PermissionKey; label: string }>;
};

export const permissionGroups: PermissionGroup[] = [
  { title: "Dashboard", permissions: [{ key: "dashboard.view", label: "View Dashboard" }] },
  {
    title: "Operations",
    permissions: [
      { key: "loading.view", label: "View Loading" },
      { key: "loading.create", label: "Create Loading" },
      { key: "loading.edit", label: "Edit Loading" },
      { key: "loading.approve", label: "Approve Loading" },
      { key: "loading.confirm", label: "Confirm Loading" }
    ]
  },
  {
    title: "Inventory",
    permissions: [
      { key: "inventory.view", label: "View Inventory" },
      { key: "inventory.receive", label: "Receive Stock" },
      { key: "inventory.adjust", label: "Adjust Stock" },
      { key: "inventory.product.edit", label: "Edit Product" },
      { key: "inventory.price.change", label: "Change Price" },
      { key: "rawmaterials.view", label: "View Raw Materials" },
      { key: "rawmaterials.update", label: "Update Raw Materials" },
      { key: "rawmaterials.edit", label: "Edit Raw Material Records" },
      { key: "rawmaterials.unlock", label: "Unlock Raw Material Records" }
    ]
  },
  {
    title: "Sales",
    permissions: [
      { key: "sales.view", label: "View Sales" },
      { key: "sales.create", label: "Create Sales" },
      { key: "sales.edit", label: "Edit Sales" },
      { key: "sales.unlock", label: "Unlock Sales" }
    ]
  },
  {
    title: "Cash",
    permissions: [
      { key: "cash.view", label: "View Cash" },
      { key: "cash.record", label: "Record Cash" },
      { key: "cash.edit", label: "Edit Cash" },
      { key: "cash.unlock", label: "Unlock Cash" }
    ]
  },
  {
    title: "Returns",
    permissions: [
      { key: "returns.view", label: "View Returns" },
      { key: "returns.receive", label: "Receive Returns" },
      { key: "returns.edit", label: "Edit Returns" }
    ]
  },
  {
    title: "Expenses",
    permissions: [
      { key: "expenses.view", label: "View Expenses" },
      { key: "expenses.record", label: "Record Expenses" },
      { key: "expenses.approve", label: "Approve Expenses" }
    ]
  },
  {
    title: "Reports",
    permissions: [
      { key: "reports.view", label: "View Reports" },
      { key: "reports.export", label: "Export Reports" },
      { key: "reports.print", label: "Print Reports" },
      { key: "reports.daily.view", label: "View Daily Report" }
    ]
  },
  {
    title: "Call Center",
    permissions: [
      { key: "callcenter.view", label: "View Call Center" },
      { key: "callcenter.queue.manage", label: "Manage Queue" },
      { key: "callcenter.calls.answer", label: "Answer Calls" },
      { key: "callcenter.calls.transfer", label: "Transfer Calls" },
      { key: "callcenter.recordings.view", label: "View Recordings" },
      { key: "callcenter.messages.view", label: "View Messages" },
      { key: "callcenter.messages.send", label: "Send Messages" },
      { key: "callcenter.complaints.manage", label: "Manage Complaints" },
      { key: "callcenter.callbacks.manage", label: "Manage Callbacks" }
    ]
  },
  {
    title: "Client Portal",
    permissions: [
      { key: "clientorders.view", label: "View Client Orders" },
      { key: "clientorders.approve", label: "Approve Client Orders" },
      { key: "clients.manage", label: "Manage Clients" },
      { key: "clients.message", label: "Message Clients" }
    ]
  },
  {
    title: "Supplier Portal",
    permissions: [
      { key: "supplier.view", label: "View Supplier Dashboard" },
      { key: "supplier.orders.manage", label: "Manage Supplier Orders" },
      { key: "supplier.message", label: "Message Suppliers" }
    ]
  },
  {
    title: "Admin",
    permissions: [
      { key: "admin.users.manage", label: "Manage Users" },
      { key: "admin.companies.manage", label: "Manage Companies" },
      { key: "admin.roles.manage", label: "Manage Roles" },
      { key: "admin.audit.view", label: "View Audit Log" },
      { key: "admin.permissions.manage", label: "Manage Permissions" }
    ]
  },
  {
    title: "Executive",
    permissions: [
      { key: "executive.view", label: "View Executive Control Room" },
      { key: "executive.company.switch", label: "Switch Company" },
      { key: "executive.allCompanies.view", label: "View All Companies" }
    ]
  }
];

const defaultRolePermissions: Record<UserRole, PermissionKey[]> = {
  admin: permissionGroups.flatMap((group) => group.permissions.map((permission) => permission.key)).concat(["sync.view", "debug.offline.view"]),
  manager: [
    "dashboard.view",
    "loading.view",
    "inventory.view",
    "rawmaterials.view",
    "sales.view",
    "cash.view",
    "returns.view",
    "expenses.view",
    "reports.view",
    "reports.export",
    "reports.print",
    "reports.daily.view"
  ],
  supervisor: [
    "dashboard.view",
    "loading.view",
    "loading.approve",
    "loading.confirm",
    "sales.view",
    "returns.view",
    "cash.view",
    "expenses.view",
    "reports.view",
    "reports.export",
    "reports.print",
    "reports.daily.view",
    "sync.view"
  ],
  storekeeper: [
    "dashboard.view",
    "loading.view",
    "loading.create",
    "loading.edit",
    "returns.view",
    "returns.receive",
    "inventory.view",
    "inventory.receive",
    "rawmaterials.view",
    "rawmaterials.update",
    "sync.view"
  ],
  marketer: [
    "dashboard.view",
    "loading.confirm",
    "sales.view",
    "sales.create",
    "sales.edit",
    "sync.view"
  ],
  accountant: [
    "dashboard.view",
    "cash.view",
    "cash.record",
    "expenses.view",
    "expenses.record",
    "reports.daily.view",
    "sync.view"
  ],
  callcenter: [
    "callcenter.view",
    "callcenter.queue.manage",
    "callcenter.calls.answer",
    "callcenter.calls.transfer",
    "callcenter.messages.view",
    "callcenter.messages.send",
    "callcenter.complaints.manage",
    "callcenter.callbacks.manage"
  ],
  supplier: ["supplier.view", "supplier.orders.manage", "supplier.message"],
  client: ["dashboard.view", "clientorders.view", "clients.message"]
};

export const routePermissions: Record<string, PermissionKey[]> = {
  "/dashboard": ["dashboard.view"],
  "/executive": ["executive.view"],
  "/debug-offline": ["debug.offline.view"],
  "/call-center": ["callcenter.view"],
  "/call-center/queue": ["callcenter.view", "callcenter.queue.manage"],
  "/call-center/agents": ["callcenter.view"],
  "/call-center/missed-calls": ["callcenter.view", "callcenter.callbacks.manage"],
  "/call-center/callbacks": ["callcenter.view", "callcenter.callbacks.manage"],
  "/call-center/messages": ["callcenter.view", "callcenter.messages.view"],
  "/call-center/chat": ["callcenter.view", "callcenter.messages.view"],
  "/call-center/announcements": ["callcenter.view", "callcenter.messages.view"],
  "/call-center/settings": ["callcenter.view"],
  "/call-center/softphone": ["callcenter.view", "callcenter.calls.answer"],
  "/call-center/live-monitor": ["callcenter.view"],
  "/call-center/analytics": ["callcenter.view"],
  "/call-center/performance": ["callcenter.view"],
  "/call-center/recordings": ["callcenter.view", "callcenter.recordings.view"],
  "/call-center/complaints": ["callcenter.view", "callcenter.complaints.manage"],
  "/call-center/wallboard": ["callcenter.view"],
  "/call-center/production-checklist": ["callcenter.view"],
  "/client-portal": ["clientorders.view"],
  "/client-portal/messages": ["clients.message"],
  "/client-orders": ["clientorders.view"],
  "/supplier-dashboard": ["supplier.view"],
  "/loading": ["loading.view"],
  "/inventory": ["inventory.view"],
  "/raw-materials": ["rawmaterials.view"],
  "/price-management": ["inventory.price.change"],
  "/confirm-loading": ["loading.confirm"],
  "/sales": ["sales.view"],
  "/returns": ["returns.view"],
  "/cash": ["cash.view"],
  "/expenses": ["expenses.view"],
  "/daily-report": ["reports.daily.view"],
  "/reports": ["reports.view"],
  "/sync-status": ["sync.view"],
  "/admin/audit-log": ["admin.audit.view"],
  "/admin/users": ["admin.users.manage"],
  "/admin/call-center-numbers": ["admin.permissions.manage"],
  "/admin/reset-data": ["admin.permissions.manage"],
  "/admin/companies": ["admin.companies.manage"]
};

export const pagePermissions: Record<string, UserRole[]> = {
  "/dashboard": ["admin", "manager", "supervisor", "storekeeper", "marketer", "accountant", "supplier", "client"],
  "/executive": ["admin"],
  "/debug-offline": ["admin", "manager", "supervisor", "storekeeper", "marketer", "accountant"],
  "/call-center": ["admin", "callcenter"],
  "/call-center/queue": ["admin", "callcenter"],
  "/call-center/agents": ["admin", "callcenter"],
  "/call-center/missed-calls": ["admin", "callcenter"],
  "/call-center/callbacks": ["admin", "callcenter"],
  "/call-center/messages": ["admin", "callcenter"],
  "/call-center/chat": ["admin", "callcenter"],
  "/call-center/announcements": ["admin", "callcenter"],
  "/call-center/settings": ["admin"],
  "/call-center/softphone": ["admin", "callcenter"],
  "/call-center/live-monitor": ["admin"],
  "/call-center/analytics": ["admin"],
  "/call-center/performance": ["admin"],
  "/call-center/recordings": ["admin"],
  "/call-center/complaints": ["admin", "callcenter"],
  "/call-center/wallboard": ["admin"],
  "/call-center/production-checklist": ["admin"],
  "/client-portal": ["admin", "client"],
  "/client-portal/messages": ["admin", "client"],
  "/client-orders": ["admin", "storekeeper", "accountant", "marketer", "manager", "supervisor"],
  "/supplier-dashboard": ["admin", "manager", "supplier"],
  "/loading": ["admin", "supervisor", "storekeeper"],
  "/inventory": ["admin", "manager", "supervisor", "storekeeper"],
  "/raw-materials": ["admin", "manager", "storekeeper"],
  "/price-management": ["admin"],
  "/confirm-loading": ["admin", "supervisor", "marketer"],
  "/sales": ["admin", "manager", "supervisor", "marketer", "accountant"],
  "/returns": ["admin", "supervisor", "storekeeper"],
  "/cash": ["admin", "manager", "supervisor", "accountant"],
  "/expenses": ["admin", "manager", "supervisor", "accountant"],
  "/daily-report": ["admin", "manager", "supervisor", "accountant"],
  "/reports": ["admin", "manager", "supervisor"],
  "/sync-status": ["admin", "manager", "supervisor", "storekeeper", "marketer", "accountant"],
  "/admin/audit-log": ["admin"],
  "/admin/users": ["admin"],
  "/admin/call-center-numbers": ["admin"],
  "/admin/reset-data": ["admin"],
  "/admin/companies": ["admin"]
};

export function getAllowedRoles(pathname: string) {
  return pagePermissions[pathname] ?? ["admin"];
}

export function canAccessPage(pathname: string, role: UserRole) {
  return getAllowedRoles(pathname).includes(role);
}

export function getRoleDefaultPermissions(role: UserRole) {
  return defaultRolePermissions[role] ?? [];
}

export function getUserEffectivePermissions(user: Pick<SessionUser, "role" | "permissions" | "deniedPermissions">) {
  const permissions = new Set<PermissionKey>(getRoleDefaultPermissions(user.role));

  (user.permissions ?? []).forEach((permission) => {
    permissions.add(permission as PermissionKey);
  });

  (user.deniedPermissions ?? []).forEach((permission) => {
    permissions.delete(permission as PermissionKey);
  });

  return Array.from(permissions);
}

export function hasPermission(user: Pick<SessionUser, "role" | "permissions" | "deniedPermissions">, permission: PermissionKey) {
  return getUserEffectivePermissions(user).includes(permission);
}

export function canAccessRoute(user: SessionUser, route: string) {
  const normalizedRoute = route.split("#")[0];
  const requiredPermissions = routePermissions[normalizedRoute];

  if (!canAccessPage(normalizedRoute, user.role)) {
    return false;
  }

  if (!requiredPermissions?.length) {
    return true;
  }

  return requiredPermissions.every((permission) => hasPermission(user, permission));
}
