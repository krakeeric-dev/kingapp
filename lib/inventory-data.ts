import type { SessionUser } from "@/lib/auth";
import { mirrorRecordsToSupabase } from "@/lib/live-data";
import { appendAuditLog, type LoadingRecord } from "@/lib/loading-data";
import { defaultProducts, productMasterKey } from "@/lib/products-data";
import type { ReturnRecord } from "@/lib/returns-data";

export type InventoryMovementType =
  | "Opening Stock"
  | "Stock Received"
  | "Loaded Out"
  | "Return Received"
  | "Adjustment";

export type InventoryMovement = {
  id: string;
  date: string;
  productName: string;
  itemCode: string;
  movementType: InventoryMovementType;
  quantity: number;
  reference: string;
  user: string;
  notes: string;
};

export type MinimumStock = {
  productKey: string;
  productName: string;
  itemCode: string;
  minimumStock: number;
};

export type InventoryRow = {
  productKey: string;
  productName: string;
  itemCode: string;
  openingStock: number;
  receivedStock: number;
  loadedOut: number;
  actualReturns: number;
  adjustment: number;
  closingStock: number;
  minimumStock: number;
  stockStatus: "Out of Stock" | "Low Stock" | "Available";
};

const INVENTORY_MOVEMENTS_KEY = "kingapp.inventoryMovements";
const MINIMUM_STOCK_KEY = "kingapp.minimumStock";

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

export function productKey(productName: string, itemCode: string) {
  return productMasterKey(productName, itemCode);
}

export function createInventoryMovement(
  movement: Omit<InventoryMovement, "id">
) {
  return {
    ...movement,
    id: `INV-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase()
  };
}

export function getInventoryMovements() {
  ensureDefaultInventorySetup();
  return readJson<InventoryMovement[]>(INVENTORY_MOVEMENTS_KEY, []);
}

export function saveInventoryMovements(records: InventoryMovement[]) {
  writeJson(INVENTORY_MOVEMENTS_KEY, records);
  mirrorRecordsToSupabase(
    "inventory_movements",
    records,
    (record) => record.id
  );
}

export function addInventoryMovement(movement: Omit<InventoryMovement, "id">) {
  const records = getInventoryMovements();
  const record = createInventoryMovement(movement);
  const updatedRecords = [record, ...records];
  saveInventoryMovements(updatedRecords);
  return updatedRecords;
}

export function getMinimumStocks() {
  ensureDefaultInventorySetup();
  return readJson<MinimumStock[]>(MINIMUM_STOCK_KEY, []);
}

export function ensureDefaultInventorySetup() {
  const existingMovements = readJson<InventoryMovement[]>(
    INVENTORY_MOVEMENTS_KEY,
    []
  );
  const existingMinimums = readJson<MinimumStock[]>(MINIMUM_STOCK_KEY, []);
  let movementsChanged = false;
  let minimumsChanged = false;
  const seededMovements = [...existingMovements];
  const seededMinimums = [...existingMinimums];

  defaultProducts.forEach((product) => {
    const key = productKey(product.name, product.itemCode);
    const openingId = `DEFAULT-OPENING-${product.itemCode}`;
    const hasOpeningStock = seededMovements.some(
      (movement) =>
        movement.id === openingId ||
        (movement.movementType === "Opening Stock" &&
          productKey(movement.productName, movement.itemCode) === key)
    );

    if (!hasOpeningStock) {
      seededMovements.push({
        id: openingId,
        date: new Date().toISOString().slice(0, 10),
        productName: product.name,
        itemCode: product.itemCode,
        movementType: "Opening Stock",
        quantity: product.openingStock,
        reference: "Default Product Master",
        user: "System",
        notes: `${product.unit} - ${product.category}`
      });
      movementsChanged = true;
    }

    const minimumIndex = seededMinimums.findIndex(
      (item) => item.productKey === key
    );

    if (minimumIndex >= 0) {
      seededMinimums[minimumIndex] = {
        ...seededMinimums[minimumIndex],
        productName: product.name,
        itemCode: product.itemCode,
        minimumStock:
          seededMinimums[minimumIndex].minimumStock || product.minimumStock
      };
    } else {
      seededMinimums.push({
        productKey: key,
        productName: product.name,
        itemCode: product.itemCode,
        minimumStock: product.minimumStock
      });
      minimumsChanged = true;
    }
  });

  if (movementsChanged) {
    writeJson(INVENTORY_MOVEMENTS_KEY, seededMovements);
  }

  if (minimumsChanged) {
    writeJson(MINIMUM_STOCK_KEY, seededMinimums);
  }
}

export function saveMinimumStock(record: MinimumStock) {
  const records = getMinimumStocks();
  const existingIndex = records.findIndex(
    (item) => item.productKey === record.productKey
  );

  if (existingIndex >= 0) {
    records[existingIndex] = record;
  } else {
    records.unshift(record);
  }

  writeJson(MINIMUM_STOCK_KEY, records);
  return records;
}

export function addInventoryAdjustment({
  adjustmentType,
  itemCode,
  productName,
  quantity,
  reason,
  user
}: {
  adjustmentType: "Add" | "Remove";
  itemCode: string;
  productName: string;
  quantity: number;
  reason: string;
  user: SessionUser;
}) {
  const signedQuantity = adjustmentType === "Add" ? quantity : -quantity;
  const movement = createInventoryMovement({
    date: new Date().toISOString().slice(0, 10),
    productName,
    itemCode,
    movementType: "Adjustment",
    quantity: signedQuantity,
    reference: adjustmentType,
    user: user.displayName,
    notes: reason
  });
  const updatedRecords = [movement, ...getInventoryMovements()];
  saveInventoryMovements(updatedRecords);
  appendAuditLog({
    id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase(),
    recordId: movement.id,
    action: "inventory_adjustment",
    reason,
    performedBy: user.displayName,
    performedByRole: user.role,
    createdAt: new Date().toISOString()
  });
  return updatedRecords;
}

export function getGeneratedInventoryMovements(
  loadingRecords: LoadingRecord[],
  returnRecords: ReturnRecord[]
) {
  const loadedMovements = loadingRecords
    .filter((record) => record.status !== "draft")
    .map<InventoryMovement>((record) => ({
      id: `GEN-LOAD-${record.id}`,
      date: record.date,
      productName: record.productName,
      itemCode: record.itemCode,
      movementType: "Loaded Out",
      quantity: record.loadedCartons,
      reference: record.id,
      user: record.storekeeperName,
      notes: `Loaded to ${record.marketerName}`
    }));
  const returnMovements = returnRecords.map<InventoryMovement>((record) => ({
    id: `GEN-RET-${record.id}`,
    date: record.date,
    productName: record.productName,
    itemCode: record.itemCode,
    movementType: "Return Received",
    quantity: record.actualReturnCartons,
    reference: record.id,
    user: record.storekeeperName,
    notes: `Returned by ${record.marketerName}`
  }));

  return [...loadedMovements, ...returnMovements];
}

export function getInventoryRows({
  loadingRecords,
  manualMovements,
  minimumStocks,
  returnRecords
}: {
  loadingRecords: LoadingRecord[];
  manualMovements: InventoryMovement[];
  minimumStocks: MinimumStock[];
  returnRecords: ReturnRecord[];
}): InventoryRow[] {
  const rows = new Map<string, InventoryRow>();
  const ensureRow = (productName: string, itemCode: string) => {
    const key = productKey(productName, itemCode);
    const minimumStock =
      minimumStocks.find((record) => record.productKey === key)?.minimumStock ?? 0;

    if (!rows.has(key)) {
      rows.set(key, {
        productKey: key,
        productName,
        itemCode,
        openingStock: 0,
        receivedStock: 0,
        loadedOut: 0,
        actualReturns: 0,
        adjustment: 0,
        closingStock: 0,
        minimumStock,
        stockStatus: "Available"
      });
    }

    return rows.get(key)!;
  };

  manualMovements.forEach((movement) => {
    const row = ensureRow(movement.productName, movement.itemCode);

    if (movement.movementType === "Opening Stock") {
      row.openingStock += movement.quantity;
    }

    if (movement.movementType === "Stock Received") {
      row.receivedStock += movement.quantity;
    }

    if (movement.movementType === "Adjustment") {
      row.adjustment += movement.quantity;
    }
  });

  loadingRecords
    .filter((record) => record.status !== "draft")
    .forEach((record) => {
      const row = ensureRow(record.productName, record.itemCode);
      row.loadedOut += record.loadedCartons;
    });

  returnRecords.forEach((record) => {
    const row = ensureRow(record.productName, record.itemCode);
    row.actualReturns += record.actualReturnCartons;
  });

  return Array.from(rows.values())
    .map((row) => {
      const closingStock =
        row.openingStock +
        row.receivedStock +
        row.actualReturns +
        row.adjustment -
        row.loadedOut;
      const status: InventoryRow["stockStatus"] =
        closingStock <= 0
          ? "Out of Stock"
          : row.minimumStock > 0 && closingStock < row.minimumStock
            ? "Low Stock"
            : "Available";

      return {
        ...row,
        closingStock,
        stockStatus: status
      };
    })
    .sort((a, b) => a.productName.localeCompare(b.productName));
}

export function getInventoryDashboardTotals(rows: InventoryRow[]) {
  return {
    totalWarehouseStock: rows.reduce(
      (total, row) => total + row.closingStock,
      0
    ),
    lowStockItems: rows.filter((row) => row.stockStatus === "Low Stock").length,
    outOfStockItems: rows.filter((row) => row.stockStatus === "Out of Stock")
      .length
  };
}

export function getInventorySummary(rows: InventoryRow[]) {
  return rows.reduce(
    (total, row) => ({
      openingStock: total.openingStock + row.openingStock,
      receivedStock: total.receivedStock + row.receivedStock,
      loadedOut: total.loadedOut + row.loadedOut,
      actualReturns: total.actualReturns + row.actualReturns,
      closingStock: total.closingStock + row.closingStock
    }),
    {
      openingStock: 0,
      receivedStock: 0,
      loadedOut: 0,
      actualReturns: 0,
      closingStock: 0
    }
  );
}
