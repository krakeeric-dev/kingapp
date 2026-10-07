import type { InventoryMovement } from "@/lib/inventory-data";
import type { LoadingRecord } from "@/lib/loading-data";
import type { ProductionRecord, UtilityRecord } from "@/lib/production-data";
import type { ProductMaster } from "@/lib/products-data";
import type { RawMaterialMaster, RawMaterialMovement } from "@/lib/raw-materials-data";
import type { ReturnRecord } from "@/lib/returns-data";

export type ReportCell = string | number;

export type ReportSection = {
  title: string;
  note?: string;
  columns: string[];
  rows: ReportCell[][];
  totals?: ReportCell[];
  emptyText: string;
  // On a phone each row becomes a card. Wide day-by-day rows only list what happened.
  hideZerosOnPhone?: boolean;
};

export type FactoryReport = {
  title: string;
  companyName: string;
  periodLabel: string;
  from: string;
  to: string;
  summary: Array<{ label: string; value: string }>;
  sections: ReportSection[];
  // Extra detail that only goes into the Excel file.
  detailSheets: ReportSection[];
};

export type FactoryReportInput = {
  companyId: string;
  companyName: string;
  from: string;
  to: string;
  periodLabel: string;
  products: ProductMaster[];
  materials: RawMaterialMaster[];
  rawMovements: RawMaterialMovement[];
  inventoryMovements: InventoryMovement[];
  loadingRecords: LoadingRecord[];
  returnRecords: ReturnRecord[];
  productionRecords: ProductionRecord[];
  utilityRecords: UtilityRecord[];
};

const round = (value: number) => Math.round(value * 100) / 100;
const isProductionReference = (reference: string) => reference.startsWith("PROD-");

export function monthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

function matchesMaterial(movement: RawMaterialMovement, material: RawMaterialMaster) {
  if ((movement.companyId ?? "") !== (material.companyId ?? "")) return false;
  if (movement.materialCode && material.materialCode) return movement.materialCode === material.materialCode;
  return movement.materialName.trim().toLowerCase() === material.materialName.trim().toLowerCase();
}

type MaterialTotals = {
  opening: number;
  received: number;
  usedInProduct: number;
  damaged: number;
  otherOut: number;
  adjusted: number;
};

// Stock is carried forward: everything dated before the period is the opening stock.
function materialTotals(material: RawMaterialMaster, movements: RawMaterialMovement[], from: string, to: string) {
  const totals: MaterialTotals = { opening: 0, received: 0, usedInProduct: 0, damaged: 0, otherOut: 0, adjusted: 0 };

  movements.forEach((movement) => {
    if (!matchesMaterial(movement, material) || movement.date > to) return;

    const signed = movement.movementType === "Raw Material Out" ? -movement.quantity : movement.quantity;

    if (movement.date < from || movement.movementType === "Opening Stock") {
      totals.opening += signed;
      return;
    }

    if (movement.movementType === "Raw Material In") {
      totals.received += movement.quantity;
    } else if (movement.movementType === "Adjustment") {
      totals.adjusted += movement.quantity;
    } else if (movement.source === "production") {
      totals.usedInProduct += movement.quantity;
    } else if (movement.source === "damage") {
      totals.damaged += movement.quantity;
    } else {
      totals.otherOut += movement.quantity;
    }
  });

  return totals;
}

type ProductTotals = {
  opening: number;
  produced: number;
  received: number;
  loadedOut: number;
  returns: number;
  adjusted: number;
};

function productTotals(
  product: ProductMaster,
  input: Pick<FactoryReportInput, "inventoryMovements" | "loadingRecords" | "returnRecords">,
  from: string,
  to: string
) {
  const totals: ProductTotals = { opening: 0, produced: 0, received: 0, loadedOut: 0, returns: 0, adjusted: 0 };

  input.inventoryMovements.forEach((movement) => {
    if (movement.itemCode !== product.itemCode || movement.date > to) return;

    if (movement.date < from || movement.movementType === "Opening Stock") {
      totals.opening += movement.quantity;
    } else if (movement.movementType === "Stock Received") {
      if (isProductionReference(movement.reference)) {
        totals.produced += movement.quantity;
      } else {
        totals.received += movement.quantity;
      }
    } else if (movement.movementType === "Adjustment") {
      totals.adjusted += movement.quantity;
    }
  });

  input.loadingRecords.forEach((record) => {
    if (record.itemCode !== product.itemCode || record.status === "draft" || record.date > to) return;

    if (record.date < from) {
      totals.opening -= record.loadedCartons;
    } else {
      totals.loadedOut += record.loadedCartons;
    }
  });

  input.returnRecords.forEach((record) => {
    if (record.itemCode !== product.itemCode || record.date > to) return;

    if (record.date < from) {
      totals.opening += record.actualReturnCartons;
    } else {
      totals.returns += record.actualReturnCartons;
    }
  });

  return totals;
}

function sumColumns(rows: ReportCell[][], label: string, skip: number[] = []) {
  if (rows.length === 0) return undefined;

  return rows[0].map((_, index) => {
    if (index === 0) return label;
    if (skip.includes(index)) return "";
    return round(rows.reduce((total, row) => total + (typeof row[index] === "number" ? (row[index] as number) : 0), 0));
  });
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short" }).format(new Date(`${value}T00:00:00`));
}

export function buildFactoryReport(input: FactoryReportInput): FactoryReport {
  const { from, to } = input;
  const inPeriod = (date: string) => date >= from && date <= to;
  const productCodes = new Set(input.products.map((product) => product.itemCode));

  // Finished products, in cartons.
  const productRows = input.products.map((product) => {
    const totals = productTotals(product, input, from, to);
    const closing = totals.opening + totals.produced + totals.received + totals.returns + totals.adjusted - totals.loadedOut;

    return [
      product.name,
      round(totals.opening),
      round(totals.produced),
      round(totals.received),
      round(totals.loadedOut),
      round(totals.returns),
      round(totals.adjusted),
      round(closing)
    ] as ReportCell[];
  });

  // Raw materials, in pieces, with the closing stock also shown in bags or bundles.
  const materialRows = input.materials.map((material) => {
    const totals = materialTotals(material, input.rawMovements, from, to);
    const usedInProduction = totals.usedInProduct + totals.damaged;
    const closing = totals.opening + totals.received - usedInProduction - totals.otherOut + totals.adjusted;
    const perPack = material.piecesPerPack && material.piecesPerPack > 1 ? material.piecesPerPack : 0;
    const packName = perPack ? (material.packName || "pack").toLowerCase() : "";

    return [
      material.materialName,
      material.unit,
      round(totals.opening),
      perPack ? round(totals.received / perPack) : "",
      round(totals.received),
      round(usedInProduction),
      round(totals.damaged),
      round(totals.otherOut),
      round(totals.adjusted),
      round(closing),
      perPack ? round(closing / perPack) : "",
      packName
    ] as ReportCell[];
  });

  // One row for each day that something happened.
  const days = new Map<string, { produced: Map<string, number>; used: Map<string, number>; water: number; electricity: number }>();
  const day = (date: string) => {
    if (!days.has(date)) {
      days.set(date, { produced: new Map(), used: new Map(), water: 0, electricity: 0 });
    }
    return days.get(date)!;
  };

  input.inventoryMovements.forEach((movement) => {
    if (
      inPeriod(movement.date) &&
      productCodes.has(movement.itemCode) &&
      movement.movementType === "Stock Received" &&
      isProductionReference(movement.reference)
    ) {
      const produced = day(movement.date).produced;
      produced.set(movement.itemCode, (produced.get(movement.itemCode) ?? 0) + movement.quantity);
    }
  });

  input.rawMovements.forEach((movement) => {
    if (!inPeriod(movement.date) || (movement.source !== "production" && movement.source !== "damage")) return;
    const material = input.materials.find((item) => matchesMaterial(movement, item));
    if (!material) return;
    const used = day(movement.date).used;
    used.set(material.materialCode, (used.get(material.materialCode) ?? 0) + movement.quantity);
  });

  const periodUtilities = input.utilityRecords
    .filter((record) => record.companyId === input.companyId && inPeriod(record.date))
    .sort((first, second) => first.date.localeCompare(second.date));

  periodUtilities.forEach((record) => {
    const entry = day(record.date);
    entry.water += record.waterM3;
    entry.electricity += record.electricityKwh;
  });

  const dayRows = Array.from(days.entries())
    .sort(([first], [second]) => first.localeCompare(second))
    .map(
      ([date, entry]) =>
        [
          formatDay(date),
          ...input.products.map((product) => round(entry.produced.get(product.itemCode) ?? 0)),
          ...input.materials.map((material) => round(entry.used.get(material.materialCode) ?? 0)),
          round(entry.water),
          round(entry.electricity)
        ] as ReportCell[]
    );

  const cartonsProduced = productRows.reduce((total, row) => total + (row[2] as number), 0);
  const piecesProduced = input.products.reduce((total, product, index) => {
    const size = Number(product.cartonSize ?? 1);
    return total + (productRows[index][2] as number) * (Number.isFinite(size) && size > 0 ? size : 1);
  }, 0);
  const water = periodUtilities.reduce((total, record) => total + record.waterM3, 0);
  const electricity = periodUtilities.reduce((total, record) => total + record.electricityKwh, 0);

  const periodProduction = input.productionRecords
    .filter((record) => record.companyId === input.companyId && inPeriod(record.date))
    .sort((first, second) => first.date.localeCompare(second.date) || first.createdAt.localeCompare(second.createdAt));

  return {
    title: "Factory Report",
    companyName: input.companyName,
    periodLabel: input.periodLabel,
    from,
    to,
    summary: [
      { label: "Cartons produced", value: round(cartonsProduced).toLocaleString() },
      { label: "Pieces produced", value: round(piecesProduced).toLocaleString() },
      { label: "Water used", value: `${round(water).toLocaleString()} m³` },
      { label: "Electricity used", value: `${round(electricity).toLocaleString()} kWh` }
    ],
    sections: [
      {
        title: "Finished products (cartons)",
        note: "Closing = Opening + Produced + Other received + Returns + Adjusted − Loaded out",
        columns: ["Product", "Opening", "Produced", "Other received", "Loaded out", "Returns", "Adjusted", "Closing"],
        rows: productRows,
        totals: sumColumns(productRows, "Total"),
        emptyText: "This company has no products yet."
      },
      {
        title: "Raw materials",
        note: "Used in production includes damaged pieces. Closing = Opening + Received − Used in production − Other out + Adjusted",
        columns: [
          "Raw material",
          "Unit",
          "Opening",
          "Received (packs)",
          "Received",
          "Used in production",
          "of which damaged",
          "Other out",
          "Adjusted",
          "Closing",
          "Closing (packs)",
          "Pack"
        ],
        rows: materialRows,
        emptyText: "This company has no raw materials yet."
      },
      {
        title: "Day by day",
        columns: [
          "Date",
          ...input.products.map((product) => `${product.name} (cartons)`),
          ...input.materials.map((material) => `${material.materialName} used`),
          "Water (m³)",
          "Electricity (kWh)"
        ],
        rows: dayRows,
        totals: sumColumns(dayRows, "Total"),
        emptyText: "Nothing was recorded in this period.",
        hideZerosOnPhone: true
      }
    ],
    detailSheets: [
      {
        title: "Production records",
        columns: ["Date", "Product", "Cartons", "Pieces", "Damaged", "Notes", "Recorded by", "Status"],
        rows: periodProduction.map((record) => [
          record.date,
          record.productName,
          record.cartonsProduced,
          record.piecesProduced,
          record.usage
            .filter((line) => line.damaged > 0)
            .map((line) => `${line.damaged} ${line.materialName}`)
            .join(", "),
          record.notes,
          record.user,
          record.voidedAt ? `Cancelled: ${record.voidReason ?? ""}` : "Recorded"
        ]),
        emptyText: ""
      },
      {
        title: "Water and electricity",
        columns: ["Date", "Water (m³)", "Electricity (kWh)", "Notes", "Recorded by"],
        rows: periodUtilities.map((record) => [record.date, record.waterM3, record.electricityKwh, record.notes, record.user]),
        emptyText: ""
      }
    ]
  };
}
