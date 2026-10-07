import type { SessionUser } from "@/lib/auth";
import { addInventoryMovement } from "@/lib/inventory-data";
import { mirrorRecordsToSupabase } from "@/lib/live-data";
import { logAuditEvent } from "@/lib/loading-data";
import type { ProductMaster } from "@/lib/products-data";
import {
  addRawMaterialMovements,
  type RawMaterialMaster,
  type RawMaterialMovement
} from "@/lib/raw-materials-data";

export type ProductionUsageLine = {
  materialCode: string;
  materialName: string;
  unit: string;
  usedPer: "piece" | "carton";
  // Pieces that went into finished product.
  used: number;
  // Pieces spoiled on the line. Taken out of stock on top of `used`.
  damaged: number;
};

export type ProductionRecord = {
  id: string;
  date: string;
  companyId: string;
  companyName?: string;
  productName: string;
  itemCode: string;
  piecesPerCarton: number;
  cartonsProduced: number;
  piecesProduced: number;
  usage: ProductionUsageLine[];
  notes: string;
  user: string;
  createdAt: string;
  updatedAt: string;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
};

export type UtilityRecord = {
  // One record per company per day.
  id: string;
  date: string;
  companyId: string;
  waterM3: number;
  electricityKwh: number;
  notes: string;
  user: string;
  updatedAt: string;
};

const PRODUCTION_RECORDS_KEY = "kingapp.productionRecords";
const UTILITY_RECORDS_KEY = "kingapp.utilityRecords";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  const rawValue = window.localStorage.getItem(key);

  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function piecesPerCartonOf(product?: Pick<ProductMaster, "cartonSize"> | null) {
  const size = Number(product?.cartonSize ?? 1);
  return Number.isFinite(size) && size > 0 ? size : 1;
}

function materialAppliesTo(material: RawMaterialMaster, product: Pick<ProductMaster, "companyId" | "itemCode">) {
  if (material.deletedAt || material.status === "Inactive") return false;
  if (!material.usedPer || material.usedPer === "none") return false;
  if (material.companyId && product.companyId && material.companyId !== product.companyId) return false;

  const products = material.usedByProducts ?? [];
  return products.length === 0 || products.includes(product.itemCode);
}

// What a production run takes out of the raw materials store, before damages:
// one piece per bottle (preform, cap, sticker) or one per carton (the carton itself).
export function planProductionUsage(
  product: Pick<ProductMaster, "cartonSize" | "companyId" | "itemCode">,
  cartonsProduced: number,
  materials: RawMaterialMaster[]
): ProductionUsageLine[] {
  const cartons = Number.isFinite(cartonsProduced) && cartonsProduced > 0 ? cartonsProduced : 0;
  const pieces = cartons * piecesPerCartonOf(product);

  return materials
    .filter((material) => materialAppliesTo(material, product))
    .map((material) => ({
      materialCode: material.materialCode,
      materialName: material.materialName,
      unit: material.unit,
      usedPer: material.usedPer === "carton" ? ("carton" as const) : ("piece" as const),
      used: material.usedPer === "carton" ? cartons : pieces,
      damaged: 0
    }))
    .sort((first, second) => first.materialName.localeCompare(second.materialName));
}

export function getProductionRecords() {
  return readJson<ProductionRecord[]>(PRODUCTION_RECORDS_KEY, []);
}

function saveProductionRecords(records: ProductionRecord[]) {
  writeJson(PRODUCTION_RECORDS_KEY, records);
  mirrorRecordsToSupabase(
    "production_records",
    records,
    (record) => record.id,
    (record) => record.updatedAt
  );
}

export function addProductionRecord({
  cartonsProduced,
  date,
  notes,
  product,
  usage,
  user
}: {
  cartonsProduced: number;
  date: string;
  notes: string;
  product: ProductMaster;
  usage: ProductionUsageLine[];
  user: SessionUser;
}) {
  const now = new Date().toISOString();
  const piecesPerCarton = piecesPerCartonOf(product);
  const record: ProductionRecord = {
    id: `PROD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase(),
    date,
    companyId: product.companyId ?? "",
    companyName: product.companyName,
    productName: product.name,
    itemCode: product.itemCode,
    piecesPerCarton,
    cartonsProduced,
    piecesProduced: cartonsProduced * piecesPerCarton,
    usage,
    notes,
    user: user.displayName,
    createdAt: now,
    updatedAt: now
  };

  // Finished cartons go into the warehouse.
  addInventoryMovement({
    date,
    productName: product.name,
    itemCode: product.itemCode,
    movementType: "Stock Received",
    quantity: cartonsProduced,
    reference: record.id,
    user: user.displayName,
    notes: `Produced ${cartonsProduced.toLocaleString()} cartons`
  });

  // Raw materials come out of the store: what went into product, then what was spoiled.
  const movements: Array<Omit<RawMaterialMovement, "id">> = [];
  usage.forEach((line) => {
    const base = {
      date,
      companyId: record.companyId,
      materialCode: line.materialCode,
      materialName: line.materialName,
      unit: line.unit,
      movementType: "Raw Material Out" as const,
      reference: record.id,
      user: user.displayName
    };

    if (line.used > 0) {
      movements.push({
        ...base,
        quantity: line.used,
        source: "production",
        notes: `Used to produce ${cartonsProduced.toLocaleString()} cartons of ${product.name}`
      });
    }

    if (line.damaged > 0) {
      movements.push({
        ...base,
        quantity: line.damaged,
        source: "damage",
        notes: `Damaged while producing ${product.name}`
      });
    }
  });

  if (movements.length > 0) {
    addRawMaterialMovements(movements);
  }

  saveProductionRecords([record, ...getProductionRecords()]);
  logAuditEvent({
    action: "production_recorded",
    companyId: record.companyId,
    companyName: record.companyName,
    module: "Production",
    newValue: record,
    recordId: record.id,
    reason: "Production recorded",
    status: "success",
    user
  });

  return record;
}

// A wrong entry is cancelled, not erased: the record stays on file marked cancelled,
// and opposite stock movements put the cartons and raw materials back.
export function voidProductionRecord(recordId: string, reason: string, user: SessionUser) {
  const records = getProductionRecords();
  const record = records.find((item) => item.id === recordId);

  if (!record || record.voidedAt) {
    return null;
  }

  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const voided: ProductionRecord = {
    ...record,
    updatedAt: now,
    voidedAt: now,
    voidedBy: user.displayName,
    voidReason: reason
  };

  addInventoryMovement({
    date: today,
    productName: record.productName,
    itemCode: record.itemCode,
    movementType: "Adjustment",
    quantity: -record.cartonsProduced,
    reference: record.id,
    user: user.displayName,
    notes: `Production of ${formatProductionDate(record.date)} cancelled: ${reason}`
  });

  const movements = record.usage
    .filter((line) => line.used + line.damaged > 0)
    .map<Omit<RawMaterialMovement, "id">>((line) => ({
      date: today,
      companyId: record.companyId,
      materialCode: line.materialCode,
      materialName: line.materialName,
      unit: line.unit,
      movementType: "Adjustment",
      quantity: line.used + line.damaged,
      reference: record.id,
      user: user.displayName,
      source: "production-void",
      notes: `Returned to stock: production of ${formatProductionDate(record.date)} cancelled`
    }));

  if (movements.length > 0) {
    addRawMaterialMovements(movements);
  }

  saveProductionRecords(records.map((item) => (item.id === recordId ? voided : item)));
  logAuditEvent({
    action: "production_cancelled",
    companyId: record.companyId,
    companyName: record.companyName,
    module: "Production",
    newValue: voided,
    oldValue: record,
    recordId: record.id,
    reason,
    status: "success",
    user
  });

  return voided;
}

function formatProductionDate(value: string) {
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(`${value}T00:00:00`)
  );
}

export function getUtilityRecords() {
  return readJson<UtilityRecord[]>(UTILITY_RECORDS_KEY, []);
}

export function saveUtilityRecord({
  companyId,
  date,
  electricityKwh,
  notes,
  user,
  waterM3
}: {
  companyId: string;
  date: string;
  electricityKwh: number;
  notes: string;
  user: SessionUser;
  waterM3: number;
}) {
  const record: UtilityRecord = {
    id: `${companyId}::${date}`,
    date,
    companyId,
    waterM3,
    electricityKwh,
    notes,
    user: user.displayName,
    updatedAt: new Date().toISOString()
  };
  const records = [record, ...getUtilityRecords().filter((item) => item.id !== record.id)];

  writeJson(UTILITY_RECORDS_KEY, records);
  mirrorRecordsToSupabase(
    "utility_records",
    records,
    (item) => item.id,
    (item) => item.updatedAt
  );

  return records;
}
