import type { SessionUser } from "@/lib/auth";
import { upsertSupabaseRows } from "@/lib/supabase";

export type ProductMaster = {
  name: string;
  itemCode: string;
  unit: string;
  category: string;
  minimumStock: number;
  openingStock: number;
  pricePerCarton: number;
};

export type PriceHistoryEntry = {
  id: string;
  productName: string;
  itemCode: string;
  oldPrice: number;
  newPrice: number;
  effectiveDate: string;
  changedBy: string;
  reason: string;
  changedAt: string;
};

const PRODUCT_MASTER_KEY = "kingapp.productMaster";
const PRICE_HISTORY_KEY = "kingapp.priceHistory";
const AUDIT_LOG_KEY = "kingapp.auditLog";

export const defaultProducts: ProductMaster[] = [
  {
    name: "Water 500ml",
    itemCode: "WT-500",
    unit: "Cartons",
    category: "Bottled Water",
    minimumStock: 100,
    openingStock: 500,
    pricePerCarton: 1999
  },
  {
    name: "Water 1L",
    itemCode: "WT-1000",
    unit: "Cartons",
    category: "Bottled Water",
    minimumStock: 80,
    openingStock: 300,
    pricePerCarton: 2500
  },
  {
    name: "Water 1.5L",
    itemCode: "WT-1500",
    unit: "Cartons",
    category: "Bottled Water",
    minimumStock: 60,
    openingStock: 200,
    pricePerCarton: 3000
  }
];

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

function appendPriceAuditLog(entry: {
  id: string;
  recordId: string;
  action: "price_change";
  reason: string;
  performedBy: string;
  performedByRole: string;
  createdAt: string;
}) {
  const entries = readJson<typeof entry[]>(AUDIT_LOG_KEY, []);
  const updatedEntries = [entry, ...entries];

  writeJson(AUDIT_LOG_KEY, updatedEntries);
  void upsertSupabaseRows(
    "audit_logs",
    updatedEntries,
    (record) => record.id,
    (record) => record.createdAt
  );
}

export function productMasterKey(productName: string, itemCode: string) {
  return `${productName.trim().toLowerCase()}::${itemCode.trim().toLowerCase()}`;
}

export function ensureDefaultProducts() {
  writeJson(PRODUCT_MASTER_KEY, defaultProducts);
  void upsertSupabaseRows(
    "products",
    defaultProducts,
    (product) => product.itemCode
  );
  return defaultProducts;
}

export function getProducts() {
  return ensureDefaultProducts();
}

export function getPriceHistory() {
  return readJson<PriceHistoryEntry[]>(PRICE_HISTORY_KEY, []);
}

export function getActivePrice(
  productName: string,
  itemCode: string,
  asOfDate = new Date().toISOString().slice(0, 10)
) {
  const productKey = productMasterKey(productName, itemCode);
  const defaultPrice =
    defaultProducts.find(
      (product) => productMasterKey(product.name, product.itemCode) === productKey
    )?.pricePerCarton ?? 0;

  const activeHistory = getPriceHistory()
    .filter(
      (entry) =>
        productMasterKey(entry.productName, entry.itemCode) === productKey &&
        entry.effectiveDate <= asOfDate
    )
    .sort((first, second) => {
      if (first.effectiveDate !== second.effectiveDate) {
        return second.effectiveDate.localeCompare(first.effectiveDate);
      }

      return second.changedAt.localeCompare(first.changedAt);
    });

  return activeHistory[0]?.newPrice ?? defaultPrice;
}

export function updateProductPrice({
  effectiveDate,
  newPrice,
  product,
  reason,
  user
}: {
  effectiveDate: string;
  newPrice: number;
  product: ProductMaster;
  reason: string;
  user: SessionUser;
}) {
  const now = new Date().toISOString();
  const oldPrice = getActivePrice(product.name, product.itemCode, effectiveDate);
  const entry: PriceHistoryEntry = {
    id: `PRICE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase(),
    productName: product.name,
    itemCode: product.itemCode,
    oldPrice,
    newPrice,
    effectiveDate,
    changedBy: user.displayName,
    reason: reason.trim(),
    changedAt: now
  };

  const updatedHistory = [entry, ...getPriceHistory()];
  writeJson(PRICE_HISTORY_KEY, updatedHistory);
  void upsertSupabaseRows(
    "product_prices",
    updatedHistory,
    (record) => record.id,
    (record) => record.changedAt
  );
  appendPriceAuditLog({
    id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase(),
    recordId: product.itemCode,
    action: "price_change",
    reason: `${product.name} price changed from ${oldPrice} to ${newPrice}. ${
      reason.trim() || "No notes provided."
    }`,
    performedBy: user.displayName,
    performedByRole: user.role,
    createdAt: now
  });

  return entry;
}
