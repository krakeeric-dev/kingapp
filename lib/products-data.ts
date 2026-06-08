import type { SessionUser } from "@/lib/auth";
import { upsertSupabaseRows } from "@/lib/supabase";

export type ProductMaster = {
  id?: string;
  companyId?: string;
  companyName?: string;
  name: string;
  itemCode: string;
  unit: string;
  category: string;
  costPrice?: number;
  cartonSize?: number;
  status?: "Active" | "Inactive";
  deletedAt?: string;
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
    companyId: "COMP-AGAHOZO",
    companyName: "Agahozo Water",
    itemCode: "WT-500",
    unit: "Cartons",
    category: "Bottled Water",
    minimumStock: 100,
    openingStock: 500,
    pricePerCarton: 1999,
    costPrice: 1200,
    cartonSize: 24,
    status: "Active"
  },
  {
    name: "Water 1L",
    companyId: "COMP-AGAHOZO",
    companyName: "Agahozo Water",
    itemCode: "WT-1000",
    unit: "Cartons",
    category: "Bottled Water",
    minimumStock: 80,
    openingStock: 300,
    pricePerCarton: 2500,
    costPrice: 1600,
    cartonSize: 12,
    status: "Active"
  },
  {
    name: "Water 1.5L",
    companyId: "COMP-AGAHOZO",
    companyName: "Agahozo Water",
    itemCode: "WT-1500",
    unit: "Cartons",
    category: "Bottled Water",
    minimumStock: 60,
    openingStock: 200,
    pricePerCarton: 3000,
    costPrice: 1900,
    cartonSize: 12,
    status: "Active"
  },
  {
    name: "Water 5L",
    companyId: "COMP-AGAHOZO",
    companyName: "Agahozo Water",
    itemCode: "WT-5000",
    unit: "Cartons",
    category: "Bottled Water",
    minimumStock: 40,
    openingStock: 0,
    pricePerCarton: 5000,
    costPrice: 3200,
    cartonSize: 4,
    status: "Active"
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

function productId(product: Pick<ProductMaster, "companyId" | "itemCode" | "name">) {
  return `${product.companyId ?? "COMP-AGAHOZO"}::${product.itemCode || product.name}`.toUpperCase();
}

function normalizeProduct(product: ProductMaster): ProductMaster {
  const defaultProduct = defaultProducts.find(
    (item) => item.itemCode === product.itemCode || item.name === product.name
  );

  return {
    ...product,
    id: product.id ?? productId(product),
    companyId: product.companyId ?? defaultProduct?.companyId ?? "COMP-AGAHOZO",
    companyName: product.companyName ?? defaultProduct?.companyName ?? "Agahozo Water",
    costPrice: product.costPrice ?? defaultProduct?.costPrice ?? 0,
    cartonSize: product.cartonSize ?? defaultProduct?.cartonSize ?? 1,
    status: product.status ?? "Active"
  };
}

export function ensureDefaultProducts() {
  const currentProducts = readJson<ProductMaster[]>(
    PRODUCT_MASTER_KEY,
    defaultProducts
  );
  const mergedProducts = currentProducts.map(normalizeProduct);
  let changed = false;

  defaultProducts.forEach((defaultProduct) => {
    const normalizedDefault = normalizeProduct(defaultProduct);
    const existingIndex = mergedProducts.findIndex(
      (product) => productId(product) === productId(normalizedDefault)
    );

    if (existingIndex >= 0) {
      return;
    }

    mergedProducts.push(normalizedDefault);
    changed = true;
  });

  if (changed) {
    writeJson(PRODUCT_MASTER_KEY, mergedProducts);
  }

  return mergedProducts;
}

export function getProducts() {
  return ensureDefaultProducts().filter(
    (product) => !product.deletedAt && product.status !== "Inactive"
  );
}

export function getAllProducts() {
  return ensureDefaultProducts();
}

export function getProductsForCompany(companyId?: string, includeInactive = false) {
  return ensureDefaultProducts().filter((product) => {
    if (product.deletedAt) return false;
    if (companyId && companyId !== "all" && product.companyId !== companyId) return false;
    if (!includeInactive && product.status === "Inactive") return false;
    return true;
  });
}

export function saveProducts(products: ProductMaster[]) {
  writeJson(PRODUCT_MASTER_KEY, products.map(normalizeProduct));
  void upsertSupabaseRows(
    "products",
    products.map(normalizeProduct),
    (record) => record.id ?? productId(record),
    (record) => `${record.name}-${record.itemCode}-${record.status ?? "Active"}`
  );
  return products.map(normalizeProduct);
}

export function upsertProduct(product: ProductMaster) {
  const normalizedProduct = normalizeProduct(product);
  const products = getAllProducts();
  const existingIndex = products.findIndex((item) => productId(item) === productId(normalizedProduct));

  if (existingIndex >= 0) {
    products[existingIndex] = {
      ...products[existingIndex],
      ...normalizedProduct
    };
  } else {
    products.unshift(normalizedProduct);
  }

  return saveProducts(products);
}

export function softDeleteProduct(product: ProductMaster) {
  return upsertProduct({
    ...product,
    status: "Inactive",
    deletedAt: new Date().toISOString()
  });
}

export function hardDeleteProduct(product: ProductMaster) {
  return saveProducts(
    getAllProducts().filter((item) => productId(item) !== productId(product))
  );
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
    getAllProducts().find(
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
