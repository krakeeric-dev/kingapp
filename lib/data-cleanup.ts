const STORAGE_KEYS = {
  productionStartVersion: "kingapp.productionStart.version",
  companies: "kingapp.companies",
  productMaster: "kingapp.productMaster",
  priceHistory: "kingapp.priceHistory",
  loadingRecords: "kingapp.loadingRecords",
  salesRecords: "kingapp.salesRecords",
  cashRecords: "kingapp.cashRecords",
  returnRecords: "kingapp.returnRecords",
  expenseRecords: "kingapp.expenseRecords",
  auditLog: "kingapp.auditLog",
  inventoryMovements: "kingapp.inventoryMovements",
  minimumStock: "kingapp.minimumStock",
  rawMaterialMaster: "kingapp.rawMaterialMaster",
  rawMaterialMinimums: "kingapp.rawMaterialMinimums",
  callCenterClients: "kingapp.callCenter.clients",
  callCenterAgents: "kingapp.callCenter.agents",
  callCenterQueueCalls: "kingapp.callCenter.queueCalls",
  callCenterMissedCalls: "kingapp.callCenter.missedCalls",
  callCenterCallbacks: "kingapp.callCenter.callbacks",
  callCenterComplaints: "kingapp.callCenter.complaints",
  callCenterPaymentFollowUps: "kingapp.callCenter.paymentFollowUps",
  callCenterPendingOrders: "kingapp.callCenter.pendingOrders",
  callCenterFollowUps: "kingapp.callCenter.followUps",
  callCenterNumbers: "kingapp.callCenter.numbers",
  callCenterManualCalls: "kingapp.callCenter.manualCalls",
  callCenterCompanyMessages: "kingapp.callCenter.companyMessages",
  callCenterMessages: "kingapp.callCenter.messages",
  callCenterAnnouncements: "kingapp.callCenter.announcements",
  callCenterNotifications: "kingapp.callCenter.internalNotifications",
  callCenterChatMessages: "kingapp.callCenter.chatMessages",
  clientPortalClients: "kingapp.clientPortal.clients",
  clientPortalSuppliers: "kingapp.clientPortal.suppliers",
  clientPortalSupplierClients: "kingapp.clientPortal.supplierClients",
  clientPortalOrders: "kingapp.clientPortal.orders",
  clientPortalMessages: "kingapp.clientPortal.messages",
  marketerClients: "kingapp.marketerClients",
  customerAccounts: "kingapp.customerAccounts",
  customerDebts: "kingapp.customerDebts",
  customerPayments: "kingapp.customerPayments",
  customerDebtApprovals: "kingapp.customerDebtApprovals",
  deliveryRecords: "kingapp.delivery.records",
  deliveryDrivers: "kingapp.delivery.drivers",
  deliveryVehicles: "kingapp.delivery.vehicles",
  rawMaterialMovements: "kingapp.rawMaterialMovements",
  telephonyRecordings: "kingapp.telephony.recordings"
};

const PRODUCTION_START_VERSION = "2026-06-11-clean-production-start";

type ProductLike = {
  productName?: string;
  name?: string;
  itemCode?: string;
  productKey?: string;
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

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]/g, "");
}

function isLegacyDemoProduct(record: ProductLike) {
  const productName = normalize(record.productName ?? record.name ?? "");
  const itemCode = normalize(record.itemCode ?? "");
  const productKey = normalize(record.productKey ?? "");

  return (
    productName === "water" ||
    itemCode === "mw500" ||
    productKey.includes("water::mw500") ||
    productKey.includes("watermw500")
  );
}

function removeLegacyRows<T extends ProductLike>(key: string) {
  const records = readJson<T[]>(key, []);
  const filteredRecords = records.filter((record) => !isLegacyDemoProduct(record));

  if (filteredRecords.length !== records.length) {
    writeJson(key, filteredRecords);
  }
}

export function cleanupLegacyDemoProductData() {
  resetToCleanProductionStartOnce();
  removeLegacyRows(STORAGE_KEYS.loadingRecords);
  removeLegacyRows(STORAGE_KEYS.salesRecords);
  removeLegacyRows(STORAGE_KEYS.cashRecords);
  removeLegacyRows(STORAGE_KEYS.returnRecords);
  removeLegacyRows(STORAGE_KEYS.expenseRecords);
  removeLegacyRows(STORAGE_KEYS.inventoryMovements);
  removeLegacyRows(STORAGE_KEYS.minimumStock);
  cleanupKnownMockBusinessData();
}

function resetToCleanProductionStartOnce() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(STORAGE_KEYS.productionStartVersion) === PRODUCTION_START_VERSION) return;

  [
    STORAGE_KEYS.companies,
    STORAGE_KEYS.productMaster,
    STORAGE_KEYS.priceHistory,
    STORAGE_KEYS.loadingRecords,
    STORAGE_KEYS.salesRecords,
    STORAGE_KEYS.cashRecords,
    STORAGE_KEYS.returnRecords,
    STORAGE_KEYS.expenseRecords,
    STORAGE_KEYS.auditLog,
    STORAGE_KEYS.inventoryMovements,
    STORAGE_KEYS.minimumStock,
    STORAGE_KEYS.rawMaterialMaster,
    STORAGE_KEYS.rawMaterialMinimums,
    STORAGE_KEYS.callCenterClients,
    STORAGE_KEYS.callCenterAgents,
    STORAGE_KEYS.callCenterQueueCalls,
    STORAGE_KEYS.callCenterMissedCalls,
    STORAGE_KEYS.callCenterCallbacks,
    STORAGE_KEYS.callCenterComplaints,
    STORAGE_KEYS.callCenterPaymentFollowUps,
    STORAGE_KEYS.callCenterPendingOrders,
    STORAGE_KEYS.callCenterFollowUps,
    STORAGE_KEYS.callCenterNumbers,
    STORAGE_KEYS.callCenterManualCalls,
    STORAGE_KEYS.callCenterCompanyMessages,
    STORAGE_KEYS.callCenterMessages,
    STORAGE_KEYS.callCenterAnnouncements,
    STORAGE_KEYS.callCenterNotifications,
    STORAGE_KEYS.callCenterChatMessages,
    STORAGE_KEYS.clientPortalClients,
    STORAGE_KEYS.clientPortalSuppliers,
    STORAGE_KEYS.clientPortalSupplierClients,
    STORAGE_KEYS.clientPortalOrders,
    STORAGE_KEYS.clientPortalMessages,
    STORAGE_KEYS.marketerClients,
    STORAGE_KEYS.customerAccounts,
    STORAGE_KEYS.customerDebts,
    STORAGE_KEYS.customerPayments,
    STORAGE_KEYS.customerDebtApprovals,
    STORAGE_KEYS.deliveryRecords,
    STORAGE_KEYS.deliveryDrivers,
    STORAGE_KEYS.deliveryVehicles,
    STORAGE_KEYS.rawMaterialMovements,
    STORAGE_KEYS.telephonyRecordings
  ].forEach((key) => window.localStorage.removeItem(key));

  window.localStorage.setItem(STORAGE_KEYS.productionStartVersion, PRODUCTION_START_VERSION);
}

function idStartsWith(record: unknown, prefixes: string[]) {
  const id = String((record as { id?: string }).id ?? "");
  return prefixes.some((prefix) => id.startsWith(prefix));
}

function isKnownMockCallCenterClient(record: unknown) {
  return idStartsWith(record, ["CL-00"]) || /^07880000\d{2}$/.test(String((record as { phone?: string }).phone ?? ""));
}

function isKnownMockClientPortalRecord(record: unknown) {
  return idStartsWith(record, ["PORTAL-CL-00", "SUP-00", "LINK-00", "CPO-DEMO", "CLMSG-00", "CLTH-00"]);
}

function isKnownMockMessage(record: unknown) {
  return idStartsWith(record, ["MSG-00", "ANN-00", "CHAT-00", "CLMSG-00"]);
}

function isKnownMockInventoryMovement(record: unknown) {
  const id = String((record as { id?: string }).id ?? "");
  const user = String((record as { user?: string }).user ?? "");
  const reference = String((record as { reference?: string }).reference ?? "");
  return id.startsWith("DEFAULT-OPENING-") || id.startsWith("DEFAULT-RAW-") || (user === "System" && reference.includes("Default"));
}

function removeKnownRows<T>(key: string, predicate: (record: T) => boolean) {
  const records = readJson<T[]>(key, []);
  const filteredRecords = records.filter((record) => !predicate(record));

  if (filteredRecords.length !== records.length) {
    writeJson(key, filteredRecords);
  }
}

export function cleanupKnownMockBusinessData() {
  removeKnownRows(STORAGE_KEYS.inventoryMovements, isKnownMockInventoryMovement);
  removeKnownRows(STORAGE_KEYS.rawMaterialMovements, isKnownMockInventoryMovement);
  removeKnownRows(STORAGE_KEYS.callCenterClients, isKnownMockCallCenterClient);
  removeKnownRows(STORAGE_KEYS.callCenterAgents, (record) => idStartsWith(record, ["AG-00"]));
  removeKnownRows(STORAGE_KEYS.callCenterQueueCalls, (record) => idStartsWith(record, ["QCALL-00"]));
  removeKnownRows(STORAGE_KEYS.callCenterMissedCalls, (record) => idStartsWith(record, ["MIS-00"]));
  removeKnownRows(STORAGE_KEYS.callCenterCallbacks, (record) => idStartsWith(record, ["CB-00"]));
  removeKnownRows(STORAGE_KEYS.callCenterMessages, isKnownMockMessage);
  removeKnownRows(STORAGE_KEYS.callCenterAnnouncements, isKnownMockMessage);
  removeKnownRows(STORAGE_KEYS.callCenterChatMessages, isKnownMockMessage);
  removeKnownRows(STORAGE_KEYS.clientPortalClients, isKnownMockClientPortalRecord);
  removeKnownRows(STORAGE_KEYS.clientPortalSuppliers, isKnownMockClientPortalRecord);
  removeKnownRows(STORAGE_KEYS.clientPortalSupplierClients, isKnownMockClientPortalRecord);
  removeKnownRows(STORAGE_KEYS.clientPortalOrders, isKnownMockClientPortalRecord);
  removeKnownRows(STORAGE_KEYS.clientPortalMessages, isKnownMockClientPortalRecord);
  removeKnownRows(STORAGE_KEYS.telephonyRecordings, (record) => idStartsWith(record, ["REC-"]));
}
