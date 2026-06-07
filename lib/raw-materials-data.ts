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
  reorderLevel: number;
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
  reorderLevel: number;
  status: "Sufficient" | "Low Stock" | "Reorder Immediately";
};

const RAW_MATERIAL_MOVEMENTS_KEY = "kingapp.rawMaterialMovements";
const RAW_MATERIAL_MINIMUMS_KEY = "kingapp.rawMaterialMinimums";

const legacyRawMaterialNames: Record<string, string> = {
  "bottle preforms": "Preforms",
  "packaging cartons": "Cartons",
  "shrink wrap": "Shrink Film"
};

const defaultRawMaterials: Array<RawMaterialMinimum & { openingStock: number }> = [
  { materialName: "Bottle Caps", minimumLevel: 1000, openingStock: 6000, reorderLevel: 500, unit: "Pieces" },
  { materialName: "Preforms", minimumLevel: 1000, openingStock: 5000, reorderLevel: 500, unit: "Pieces" },
  { materialName: "Labels", minimumLevel: 1200, openingStock: 7000, reorderLevel: 600, unit: "Pieces" },
  { materialName: "Cartons", minimumLevel: 150, openingStock: 600, reorderLevel: 75, unit: "Cartons" },
  { materialName: "Shrink Film", minimumLevel: 100, openingStock: 450, reorderLevel: 50, unit: "Rolls" },
  { materialName: "Bottle Handles", minimumLevel: 500, openingStock: 2500, reorderLevel: 250, unit: "Pieces" },
  { materialName: "Water Treatment Chemicals", minimumLevel: 50, openingStock: 220, reorderLevel: 25, unit: "Kg" },
  { materialName: "Ink / Printing Materials", minimumLevel: 30, openingStock: 120, reorderLevel: 15, unit: "Liters" },
  { materialName: "Glue", minimumLevel: 40, openingStock: 160, reorderLevel: 20, unit: "Kg" },
  { materialName: "Packaging Tape", minimumLevel: 60, openingStock: 240, reorderLevel: 30, unit: "Rolls" },
  { materialName: "Pallets", minimumLevel: 25, openingStock: 90, reorderLevel: 12, unit: "Pieces" },
  { materialName: "Bottle Sleeves", minimumLevel: 500, openingStock: 2200, reorderLevel: 250, unit: "Pieces" },
  { materialName: "Disinfectant / Sanitizer", minimumLevel: 40, openingStock: 180, reorderLevel: 20, unit: "Liters" },
  { materialName: "Machine Lubricants", minimumLevel: 20, openingStock: 80, reorderLevel: 10, unit: "Liters" }
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

function officialRawMaterialName(materialName: string) {
  return legacyRawMaterialNames[materialKey(materialName)] ?? materialName;
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
  let movementsChanged = false;
  let minimumsChanged = false;
  const seededMovements = existingMovements.map((movement) => {
    const officialName = officialRawMaterialName(movement.materialName);

    if (officialName !== movement.materialName) {
      movementsChanged = true;
      return { ...movement, materialName: officialName };
    }

    return movement;
  });
  const seededMinimums = existingMinimums.map((minimum) => {
    const officialName = officialRawMaterialName(minimum.materialName);

    if (officialName !== minimum.materialName) {
      minimumsChanged = true;
      return { ...minimum, materialName: officialName };
    }

    return minimum;
  });

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
        reorderLevel:
          seededMinimums[minimumIndex].reorderLevel ??
          Math.min(material.reorderLevel, seededMinimums[minimumIndex].minimumLevel || material.minimumLevel),
        unit: seededMinimums[minimumIndex].unit || material.unit
      };
      minimumsChanged = true;
    } else {
      seededMinimums.push({
        materialName: material.materialName,
        minimumLevel: material.minimumLevel,
        reorderLevel: material.reorderLevel,
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
        reorderLevel: minimum?.reorderLevel ?? Math.floor((minimum?.minimumLevel ?? 0) / 2),
        status: "Sufficient"
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
        row.reorderLevel > 0 && remainingStock <= row.reorderLevel
          ? "Reorder Immediately"
          : row.minimumLevel > 0 && remainingStock < row.minimumLevel
            ? "Low Stock"
            : "Sufficient";

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
    reorderRequired: rows.filter((row) => row.status === "Reorder Immediately").length
  };
}
