import { defaultProducts } from "@/lib/products-data";

const STORAGE_KEYS = {
  productMaster: "kingapp.productMaster",
  loadingRecords: "kingapp.loadingRecords",
  salesRecords: "kingapp.salesRecords",
  cashRecords: "kingapp.cashRecords",
  returnRecords: "kingapp.returnRecords",
  expenseRecords: "kingapp.expenseRecords",
  inventoryMovements: "kingapp.inventoryMovements",
  minimumStock: "kingapp.minimumStock"
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
  writeJson(STORAGE_KEYS.productMaster, defaultProducts);
  removeLegacyRows(STORAGE_KEYS.loadingRecords);
  removeLegacyRows(STORAGE_KEYS.salesRecords);
  removeLegacyRows(STORAGE_KEYS.cashRecords);
  removeLegacyRows(STORAGE_KEYS.returnRecords);
  removeLegacyRows(STORAGE_KEYS.expenseRecords);
  removeLegacyRows(STORAGE_KEYS.inventoryMovements);
  removeLegacyRows(STORAGE_KEYS.minimumStock);
}
