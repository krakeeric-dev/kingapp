import type { SessionUser } from "@/lib/auth";
import { appendAuditLog } from "@/lib/loading-data";

export type HistoricalDeleteType =
  | "sales"
  | "cash"
  | "expenses"
  | "inventory"
  | "raw-materials"
  | "clients"
  | "loading"
  | "returns"
  | "reports"
  | "everything";

export type HistoricalDeleteOption = {
  description: string;
  key: HistoricalDeleteType;
  label: string;
  localStorageKeys: string[];
};

export const historicalDeleteOptions: HistoricalDeleteOption[] = [
  {
    description: "Delete old marketer sales entries and payment status attached to sales.",
    key: "sales",
    label: "Delete Sales History",
    localStorageKeys: ["kingapp.salesRecords"]
  },
  {
    description: "Delete old accountant cash collection records.",
    key: "cash",
    label: "Delete Cash History",
    localStorageKeys: ["kingapp.cashRecords"]
  },
  {
    description: "Delete old expense and closing cash records.",
    key: "expenses",
    label: "Delete Expense History",
    localStorageKeys: ["kingapp.expenseRecords"]
  },
  {
    description: "Delete old finished goods inventory movement history.",
    key: "inventory",
    label: "Delete Inventory History",
    localStorageKeys: ["kingapp.inventoryMovements"]
  },
  {
    description: "Delete old factory raw material movement history.",
    key: "raw-materials",
    label: "Delete Raw Material History",
    localStorageKeys: ["kingapp.rawMaterialMovements"]
  },
  {
    description: "Delete saved marketer client sales history.",
    key: "clients",
    label: "Delete Client History",
    localStorageKeys: ["kingapp.marketerClients"]
  },
  {
    description: "Delete old loading and marketer confirmation records.",
    key: "loading",
    label: "Delete Loading History",
    localStorageKeys: ["kingapp.loadingRecords"]
  },
  {
    description: "Delete old returns, damages, and stock variance records.",
    key: "returns",
    label: "Delete Returns and Damages",
    localStorageKeys: ["kingapp.returnRecords"]
  },
  {
    description: "Delete historical report source data across sales, cash, expenses, returns, and loading.",
    key: "reports",
    label: "Delete Selected Report",
    localStorageKeys: [
      "kingapp.loadingRecords",
      "kingapp.salesRecords",
      "kingapp.returnRecords",
      "kingapp.cashRecords",
      "kingapp.expenseRecords"
    ]
  }
];

export const businessDataResetKeys = Array.from(
  new Set(
    historicalDeleteOptions
      .filter((option) => option.key !== "reports")
      .flatMap((option) => option.localStorageKeys)
      .concat(["kingapp.lastSyncTime"])
  )
);

function removeKeys(keys: string[]) {
  if (typeof window === "undefined") {
    return [];
  }

  const uniqueKeys = Array.from(new Set(keys));
  uniqueKeys.forEach((key) => {
    window.localStorage.removeItem(key);
  });
  window.dispatchEvent(new Event("kingapp:data-synced"));
  return uniqueKeys;
}

function auditHistoricalDelete({
  deletedKeys,
  deleteType,
  label,
  user
}: {
  deletedKeys: string[];
  deleteType: HistoricalDeleteType;
  label: string;
  user: SessionUser;
}) {
  appendAuditLog({
    id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase(),
    recordId: deleteType,
    action: deleteType === "everything" ? "business_data_reset" : "historical_data_delete",
    reason: `${label}. Deleted stores: ${deletedKeys.join(", ")}`,
    performedBy: user.displayName,
    performedByRole: user.role,
    createdAt: new Date().toISOString()
  });
}

export function deleteHistoricalData(option: HistoricalDeleteOption, user: SessionUser) {
  const deletedKeys = removeKeys(option.localStorageKeys);
  auditHistoricalDelete({
    deletedKeys,
    deleteType: option.key,
    label: option.label,
    user
  });
  return deletedKeys;
}

export function resetBusinessData(user: SessionUser) {
  const deletedKeys = removeKeys(businessDataResetKeys);
  auditHistoricalDelete({
    deletedKeys,
    deleteType: "everything",
    label: "Delete Everything and Restart",
    user
  });
  return deletedKeys;
}
