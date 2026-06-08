export const businessDataResetKeys = [
  "kingapp.loadingRecords",
  "kingapp.salesRecords",
  "kingapp.returnRecords",
  "kingapp.cashRecords",
  "kingapp.expenseRecords",
  "kingapp.inventoryMovements",
  "kingapp.marketerClients",
  "kingapp.rawMaterialMovements",
  "kingapp.auditLog",
  "kingapp.lastSyncTime"
] as const;

export function resetBusinessData() {
  if (typeof window === "undefined") {
    return [];
  }

  businessDataResetKeys.forEach((key) => {
    window.localStorage.removeItem(key);
  });

  window.dispatchEvent(new Event("kingapp:data-synced"));

  return [...businessDataResetKeys];
}
