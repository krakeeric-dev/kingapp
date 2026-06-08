const STORAGE_KEYS = {
  productMaster: "kingapp.productMaster",
  loadingRecords: "kingapp.loadingRecords",
  salesRecords: "kingapp.salesRecords",
  cashRecords: "kingapp.cashRecords",
  returnRecords: "kingapp.returnRecords",
  expenseRecords: "kingapp.expenseRecords",
  inventoryMovements: "kingapp.inventoryMovements",
  minimumStock: "kingapp.minimumStock",
  callCenterClients: "kingapp.callCenter.clients",
  callCenterAgents: "kingapp.callCenter.agents",
  callCenterQueueCalls: "kingapp.callCenter.queueCalls",
  callCenterMissedCalls: "kingapp.callCenter.missedCalls",
  callCenterCallbacks: "kingapp.callCenter.callbacks",
  callCenterMessages: "kingapp.callCenter.messages",
  callCenterAnnouncements: "kingapp.callCenter.announcements",
  callCenterChatMessages: "kingapp.callCenter.chatMessages",
  clientPortalClients: "kingapp.clientPortal.clients",
  clientPortalSuppliers: "kingapp.clientPortal.suppliers",
  clientPortalSupplierClients: "kingapp.clientPortal.supplierClients",
  clientPortalOrders: "kingapp.clientPortal.orders",
  clientPortalMessages: "kingapp.clientPortal.messages",
  rawMaterialMovements: "kingapp.rawMaterialMovements",
  telephonyRecordings: "kingapp.telephony.recordings"
};

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
  removeLegacyRows(STORAGE_KEYS.loadingRecords);
  removeLegacyRows(STORAGE_KEYS.salesRecords);
  removeLegacyRows(STORAGE_KEYS.cashRecords);
  removeLegacyRows(STORAGE_KEYS.returnRecords);
  removeLegacyRows(STORAGE_KEYS.expenseRecords);
  removeLegacyRows(STORAGE_KEYS.inventoryMovements);
  removeLegacyRows(STORAGE_KEYS.minimumStock);
  cleanupKnownMockBusinessData();
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
