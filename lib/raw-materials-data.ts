export type RawMaterialMovementType =
  | "Opening Stock"
  | "Raw Material In"
  | "Raw Material Out"
  | "Adjustment";

export type RawMaterialMovement = {
  id: string;
  date: string;
  materialName: string;
  unit: string;
  movementType: RawMaterialMovementType;
  quantity: number;
  reference: string;
  user: string;
  notes: string;
  companyId?: string;
};

export type RawMaterialMinimum = {
  materialName: string;
  minimumLevel: number;
  unit: string;
};

export type RawMaterialRow = {
  materialName: string;
  unit: string;
  openingStock: number;
  rawMaterialIn: number;
  rawMaterialOut: number;
  remainingStock: number;
  minimumLevel: number;
  status: "Available" | "Low Stock" | "Reorder Required";
};

const RAW_MATERIAL_MOVEMENTS_KEY = "kingapp.rawMaterialMovements";
const RAW_MATERIAL_MINIMUMS_KEY = "kingapp.rawMaterialMinimums";

const defaultRawMaterials: Array<RawMaterialMinimum & { openingStock: number }> = [
  { materialName: "Bottle Preforms", minimumLevel: 1000, openingStock: 5000, unit: "Pieces" },
  { materialName: "Bottle Caps", minimumLevel: 1000, openingStock: 6000, unit: "Pieces" },
  { materialName: "Labels", minimumLevel: 1200, openingStock: 7000, unit: "Pieces" },
  { materialName: "Shrink Wrap", minimumLevel: 100, openingStock: 450, unit: "Rolls" },
  { materialName: "Packaging Cartons", minimumLevel: 150, openingStock: 600, unit: "Cartons" }
];

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
    window.localStorage.removeItem(key);
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function materialKey(materialName: string) {
  return materialName.trim().toLowerCase();
}

export function createRawMaterialMovement(
  movement: Omit<RawMaterialMovement, "id">
): RawMaterialMovement {
  return {
    ...movement,
    id: `RAW-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase()
  };
}

export function ensureDefaultRawMaterials() {
  const existingMovements = readJson<RawMaterialMovement[]>(RAW_MATERIAL_MOVEMENTS_KEY, []);
  const existingMinimums = readJson<RawMaterialMinimum[]>(RAW_MATERIAL_MINIMUMS_KEY, []);
  const seededMovements = [...existingMovements];
  const seededMinimums = [...existingMinimums];
  let movementsChanged = false;
  let minimumsChanged = false;

  defaultRawMaterials.forEach((material) => {
    const key = materialKey(material.materialName);
    const openingId = `DEFAULT-RAW-${key.replace(/\s+/g, "-").toUpperCase()}`;
    const hasOpening = seededMovements.some(
      (movement) =>
        movement.id === openingId ||
        (movement.movementType === "Opening Stock" &&
          materialKey(movement.materialName) === key)
    );

    if (!hasOpening) {
      seededMovements.push({
        id: openingId,
        date: new Date().toISOString().slice(0, 10),
        materialName: material.materialName,
        unit: material.unit,
        movementType: "Opening Stock",
        quantity: material.openingStock,
        reference: "Default Raw Material Master",
        user: "System",
        notes: "Seeded for production planning"
      });
      movementsChanged = true;
    }

    const minimumIndex = seededMinimums.findIndex(
      (record) => materialKey(record.materialName) === key
    );

    if (minimumIndex >= 0) {
      seededMinimums[minimumIndex] = {
        ...seededMinimums[minimumIndex],
        minimumLevel: seededMinimums[minimumIndex].minimumLevel || material.minimumLevel,
        unit: seededMinimums[minimumIndex].unit || material.unit
      };
    } else {
      seededMinimums.push({
        materialName: material.materialName,
        minimumLevel: material.minimumLevel,
        unit: material.unit
      });
      minimumsChanged = true;
    }
  });

  if (movementsChanged) {
    writeJson(RAW_MATERIAL_MOVEMENTS_KEY, seededMovements);
  }

  if (minimumsChanged) {
    writeJson(RAW_MATERIAL_MINIMUMS_KEY, seededMinimums);
  }
}

export function getRawMaterialMovements() {
  ensureDefaultRawMaterials();
  return readJson<RawMaterialMovement[]>(RAW_MATERIAL_MOVEMENTS_KEY, []);
}

export function saveRawMaterialMovements(records: RawMaterialMovement[]) {
  writeJson(RAW_MATERIAL_MOVEMENTS_KEY, records);
}

export function addRawMaterialMovement(movement: Omit<RawMaterialMovement, "id">) {
  const record = createRawMaterialMovement(movement);
  const updatedRecords = [record, ...getRawMaterialMovements()];
  saveRawMaterialMovements(updatedRecords);
  return updatedRecords;
}

export function getRawMaterialMinimums() {
  ensureDefaultRawMaterials();
  return readJson<RawMaterialMinimum[]>(RAW_MATERIAL_MINIMUMS_KEY, []);
}

export function saveRawMaterialMinimum(record: RawMaterialMinimum) {
  const records = getRawMaterialMinimums();
  const existingIndex = records.findIndex(
    (item) => materialKey(item.materialName) === materialKey(record.materialName)
  );

  if (existingIndex >= 0) {
    records[existingIndex] = record;
  } else {
    records.unshift(record);
  }

  writeJson(RAW_MATERIAL_MINIMUMS_KEY, records);
  return records;
}

export function getRawMaterialRows({
  minimums,
  movements
}: {
  minimums: RawMaterialMinimum[];
  movements: RawMaterialMovement[];
}) {
  const rows = new Map<string, RawMaterialRow>();
  const ensureRow = (materialName: string, unit: string) => {
    const key = materialKey(materialName);
    const minimum = minimums.find((record) => materialKey(record.materialName) === key);

    if (!rows.has(key)) {
      rows.set(key, {
        materialName,
        unit: minimum?.unit ?? unit,
        openingStock: 0,
        rawMaterialIn: 0,
        rawMaterialOut: 0,
        remainingStock: 0,
        minimumLevel: minimum?.minimumLevel ?? 0,
        status: "Available"
      });
    }

    return rows.get(key)!;
  };

  movements.forEach((movement) => {
    const row = ensureRow(movement.materialName, movement.unit);

    if (movement.movementType === "Opening Stock") {
      row.openingStock += movement.quantity;
    }

    if (movement.movementType === "Raw Material In") {
      row.rawMaterialIn += movement.quantity;
    }

    if (movement.movementType === "Raw Material Out") {
      row.rawMaterialOut += movement.quantity;
    }

    if (movement.movementType === "Adjustment") {
      if (movement.quantity >= 0) {
        row.rawMaterialIn += movement.quantity;
      } else {
        row.rawMaterialOut += Math.abs(movement.quantity);
      }
    }
  });

  minimums.forEach((minimum) => {
    ensureRow(minimum.materialName, minimum.unit);
  });

  return Array.from(rows.values())
    .map((row) => {
      const remainingStock = row.openingStock + row.rawMaterialIn - row.rawMaterialOut;
      const status: RawMaterialRow["status"] =
        remainingStock <= 0
          ? "Reorder Required"
          : row.minimumLevel > 0 && remainingStock < row.minimumLevel
            ? "Low Stock"
            : "Available";

      return {
        ...row,
        remainingStock,
        status
      };
    })
    .sort((first, second) => first.materialName.localeCompare(second.materialName));
}

export function getRawMaterialTotals(rows: RawMaterialRow[]) {
  return {
    dailyUsage: rows.reduce((total, row) => total + row.rawMaterialOut, 0),
    lowStockAlerts: rows.filter((row) => row.status === "Low Stock").length,
    rawMaterialIn: rows.reduce((total, row) => total + row.rawMaterialIn, 0),
    rawMaterialOut: rows.reduce((total, row) => total + row.rawMaterialOut, 0),
    remainingStock: rows.reduce((total, row) => total + row.remainingStock, 0),
    reorderRequired: rows.filter((row) => row.status === "Reorder Required").length
  };
}
