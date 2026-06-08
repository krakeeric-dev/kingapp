export type RawMaterialMovementType =
  | "Opening Stock"
  | "Raw Material In"
  | "Raw Material Out"
  | "Adjustment";

export type RawMaterialMovement = {
  id: string;
  date: string;
  materialCode?: string;
  materialName: string;
  unit: string;
  movementType: RawMaterialMovementType;
  quantity: number;
  reference: string;
  user: string;
  notes: string;
  companyId?: string;
};

export type RawMaterialMasterStatus = "Active" | "Inactive";

export type RawMaterialMaster = {
  id?: string;
  companyId?: string;
  companyName?: string;
  materialName: string;
  materialCode: string;
  category: string;
  unit: string;
  openingStock: number;
  minimumLevel: number;
  reorderLevel: number;
  status: RawMaterialMasterStatus;
  deletedAt?: string;
};

export type RawMaterialMinimum = {
  companyId?: string;
  materialCode?: string;
  materialName: string;
  minimumLevel: number;
  reorderLevel: number;
  unit: string;
};

export type RawMaterialRow = {
  companyId?: string;
  materialCode?: string;
  category?: string;
  materialName: string;
  unit: string;
  openingStock: number;
  rawMaterialIn: number;
  rawMaterialOut: number;
  remainingStock: number;
  minimumLevel: number;
  reorderLevel: number;
  status: "Sufficient" | "Low Stock" | "Reorder Immediately";
  lastUpdated?: string;
};

const RAW_MATERIAL_MOVEMENTS_KEY = "kingapp.rawMaterialMovements";
const RAW_MATERIAL_MINIMUMS_KEY = "kingapp.rawMaterialMinimums";
const RAW_MATERIAL_MASTER_KEY = "kingapp.rawMaterialMaster";

const legacyRawMaterialNames: Record<string, string> = {
  "bottle preforms": "Preforms",
  "packaging cartons": "Cartons",
  "shrink wrap": "Shrink Film"
};

export const defaultRawMaterials: RawMaterialMaster[] = [
  { materialName: "Bottle Caps", materialCode: "RAW-CAPS", category: "Packaging", minimumLevel: 1000, openingStock: 6000, reorderLevel: 500, unit: "Pieces", companyId: "COMP-AGAHOZO", companyName: "Agahozo Water", status: "Active" },
  { materialName: "Preforms", materialCode: "RAW-PREFORMS", category: "Packaging", minimumLevel: 1000, openingStock: 5000, reorderLevel: 500, unit: "Pieces", companyId: "COMP-AGAHOZO", companyName: "Agahozo Water", status: "Active" },
  { materialName: "Labels", materialCode: "RAW-LABELS", category: "Packaging", minimumLevel: 1200, openingStock: 7000, reorderLevel: 600, unit: "Pieces", companyId: "COMP-AGAHOZO", companyName: "Agahozo Water", status: "Active" },
  { materialName: "Cartons", materialCode: "RAW-CARTONS", category: "Packaging", minimumLevel: 150, openingStock: 600, reorderLevel: 75, unit: "Cartons", companyId: "COMP-AGAHOZO", companyName: "Agahozo Water", status: "Active" },
  { materialName: "Shrink Film", materialCode: "RAW-SHRINK", category: "Packaging", minimumLevel: 100, openingStock: 450, reorderLevel: 50, unit: "Rolls", companyId: "COMP-AGAHOZO", companyName: "Agahozo Water", status: "Active" },
  { materialName: "Bottle Handles", materialCode: "RAW-HANDLES", category: "Packaging", minimumLevel: 500, openingStock: 2500, reorderLevel: 250, unit: "Pieces", companyId: "COMP-AGAHOZO", companyName: "Agahozo Water", status: "Active" },
  { materialName: "Water Treatment Chemicals", materialCode: "RAW-CHEM", category: "Production", minimumLevel: 50, openingStock: 220, reorderLevel: 25, unit: "Kg", companyId: "COMP-AGAHOZO", companyName: "Agahozo Water", status: "Active" },
  { materialName: "Ink / Printing Materials", materialCode: "RAW-INK", category: "Production", minimumLevel: 30, openingStock: 120, reorderLevel: 15, unit: "Liters", companyId: "COMP-AGAHOZO", companyName: "Agahozo Water", status: "Active" },
  { materialName: "Glue", materialCode: "RAW-GLUE", category: "Packaging", minimumLevel: 40, openingStock: 160, reorderLevel: 20, unit: "Kg", companyId: "COMP-AGAHOZO", companyName: "Agahozo Water", status: "Active" },
  { materialName: "Packaging Tape", materialCode: "RAW-TAPE", category: "Packaging", minimumLevel: 60, openingStock: 240, reorderLevel: 30, unit: "Rolls", companyId: "COMP-AGAHOZO", companyName: "Agahozo Water", status: "Active" },
  { materialName: "Pallets", materialCode: "RAW-PALLETS", category: "Logistics", minimumLevel: 25, openingStock: 90, reorderLevel: 12, unit: "Pieces", companyId: "COMP-AGAHOZO", companyName: "Agahozo Water", status: "Active" },
  { materialName: "Bottle Sleeves", materialCode: "RAW-SLEEVES", category: "Packaging", minimumLevel: 500, openingStock: 2200, reorderLevel: 250, unit: "Pieces", companyId: "COMP-AGAHOZO", companyName: "Agahozo Water", status: "Active" },
  { materialName: "Disinfectant / Sanitizer", materialCode: "RAW-SANITIZER", category: "Production", minimumLevel: 40, openingStock: 180, reorderLevel: 20, unit: "Liters", companyId: "COMP-AGAHOZO", companyName: "Agahozo Water", status: "Active" },
  { materialName: "Machine Lubricants", materialCode: "RAW-LUBE", category: "Maintenance", minimumLevel: 20, openingStock: 80, reorderLevel: 10, unit: "Liters", companyId: "COMP-AGAHOZO", companyName: "Agahozo Water", status: "Active" }
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

function masterKey(material: Pick<RawMaterialMaster, "companyId" | "materialCode" | "materialName">) {
  return `${material.companyId ?? "COMP-AGAHOZO"}::${material.materialCode || material.materialName}`.toUpperCase();
}

function normalizeMaster(material: RawMaterialMaster): RawMaterialMaster {
  const defaultMaterial = defaultRawMaterials.find(
    (item) => item.materialCode === material.materialCode || item.materialName === material.materialName
  );

  return {
    ...material,
    id: material.id ?? masterKey(material),
    companyId: material.companyId ?? defaultMaterial?.companyId ?? "COMP-AGAHOZO",
    companyName: material.companyName ?? defaultMaterial?.companyName ?? "Agahozo Water",
    category: material.category || defaultMaterial?.category || "Production",
    materialCode: material.materialCode || defaultMaterial?.materialCode || material.materialName.toUpperCase().replace(/[^A-Z0-9]+/g, "-"),
    status: material.status ?? "Active"
  };
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
  const existingMaster = readJson<RawMaterialMaster[]>(RAW_MATERIAL_MASTER_KEY, defaultRawMaterials);
  const existingMovements = readJson<RawMaterialMovement[]>(RAW_MATERIAL_MOVEMENTS_KEY, []);
  const existingMinimums = readJson<RawMaterialMinimum[]>(RAW_MATERIAL_MINIMUMS_KEY, []);
  const seededMaster = existingMaster.map(normalizeMaster);
  let masterChanged = false;
  let movementsChanged = false;
  let minimumsChanged = false;
  const seededMovements = existingMovements.map((movement) => {
    const officialName = officialRawMaterialName(movement.materialName);
    const matchingMaster = seededMaster.find(
      (material) =>
        material.materialCode === movement.materialCode ||
        materialKey(material.materialName) === materialKey(officialName)
    );

    if (officialName !== movement.materialName || !movement.companyId || !movement.materialCode) {
      movementsChanged = true;
      return {
        ...movement,
        companyId: movement.companyId ?? matchingMaster?.companyId ?? "COMP-AGAHOZO",
        materialCode: movement.materialCode ?? matchingMaster?.materialCode,
        materialName: officialName
      };
    }

    return movement;
  });
  const seededMinimums = existingMinimums.map((minimum) => {
    const officialName = officialRawMaterialName(minimum.materialName);
    const matchingMaster = seededMaster.find(
      (material) =>
        material.materialCode === minimum.materialCode ||
        materialKey(material.materialName) === materialKey(officialName)
    );

    if (officialName !== minimum.materialName || !minimum.companyId || !minimum.materialCode) {
      minimumsChanged = true;
      return {
        ...minimum,
        companyId: minimum.companyId ?? matchingMaster?.companyId ?? "COMP-AGAHOZO",
        materialCode: minimum.materialCode ?? matchingMaster?.materialCode,
        materialName: officialName
      };
    }

    return minimum;
  });

  defaultRawMaterials.forEach((material) => {
    const normalizedMaterial = normalizeMaster(material);
    const key = masterKey(normalizedMaterial);
    const masterExists = seededMaster.some((record) => masterKey(record) === key);

    if (!masterExists) {
      seededMaster.push(normalizedMaterial);
      masterChanged = true;
    }

    const minimumIndex = seededMinimums.findIndex(
      (record) =>
        record.companyId === normalizedMaterial.companyId &&
        (record.materialCode === normalizedMaterial.materialCode ||
          materialKey(record.materialName) === materialKey(normalizedMaterial.materialName))
    );

    if (minimumIndex >= 0) {
      seededMinimums[minimumIndex] = {
        ...seededMinimums[minimumIndex],
        companyId: normalizedMaterial.companyId,
        materialCode: normalizedMaterial.materialCode,
        materialName: normalizedMaterial.materialName,
        minimumLevel: seededMinimums[minimumIndex].minimumLevel || normalizedMaterial.minimumLevel,
        reorderLevel:
          seededMinimums[minimumIndex].reorderLevel ??
          Math.min(normalizedMaterial.reorderLevel, seededMinimums[minimumIndex].minimumLevel || normalizedMaterial.minimumLevel),
        unit: seededMinimums[minimumIndex].unit || normalizedMaterial.unit
      };
      minimumsChanged = true;
    } else {
      seededMinimums.push({
        companyId: normalizedMaterial.companyId,
        materialCode: normalizedMaterial.materialCode,
        materialName: normalizedMaterial.materialName,
        minimumLevel: normalizedMaterial.minimumLevel,
        reorderLevel: normalizedMaterial.reorderLevel,
        unit: normalizedMaterial.unit
      });
      minimumsChanged = true;
    }
  });

  if (masterChanged) {
    writeJson(RAW_MATERIAL_MASTER_KEY, seededMaster);
  }

  if (movementsChanged) {
    writeJson(RAW_MATERIAL_MOVEMENTS_KEY, seededMovements);
  }

  if (minimumsChanged) {
    writeJson(RAW_MATERIAL_MINIMUMS_KEY, seededMinimums);
  }
}

export function getRawMaterialMaster() {
  ensureDefaultRawMaterials();
  return readJson<RawMaterialMaster[]>(RAW_MATERIAL_MASTER_KEY, defaultRawMaterials).map(normalizeMaster);
}

export function getRawMaterialsForCompany(companyId?: string, includeInactive = false) {
  return getRawMaterialMaster().filter((material) => {
    if (material.deletedAt) return false;
    if (companyId && companyId !== "all" && material.companyId !== companyId) return false;
    if (!includeInactive && material.status === "Inactive") return false;
    return true;
  });
}

export function saveRawMaterialMaster(materials: RawMaterialMaster[]) {
  writeJson(RAW_MATERIAL_MASTER_KEY, materials.map(normalizeMaster));
  return materials.map(normalizeMaster);
}

export function upsertRawMaterialMaster(material: RawMaterialMaster) {
  const normalizedMaterial = normalizeMaster(material);
  const materials = getRawMaterialMaster();
  const existingIndex = materials.findIndex((item) => masterKey(item) === masterKey(normalizedMaterial));

  if (existingIndex >= 0) {
    materials[existingIndex] = {
      ...materials[existingIndex],
      ...normalizedMaterial
    };
  } else {
    materials.unshift(normalizedMaterial);
  }

  saveRawMaterialMinimum({
    companyId: normalizedMaterial.companyId,
    materialCode: normalizedMaterial.materialCode,
    materialName: normalizedMaterial.materialName,
    minimumLevel: normalizedMaterial.minimumLevel,
    reorderLevel: normalizedMaterial.reorderLevel,
    unit: normalizedMaterial.unit
  });

  const hasOpening = getRawMaterialMovements().some(
    (movement) =>
      movement.companyId === normalizedMaterial.companyId &&
      movement.materialCode === normalizedMaterial.materialCode &&
      movement.movementType === "Opening Stock"
  );

  if (!hasOpening && normalizedMaterial.openingStock > 0 && !material.id) {
    addRawMaterialMovement({
      date: new Date().toISOString().slice(0, 10),
      companyId: normalizedMaterial.companyId,
      materialCode: normalizedMaterial.materialCode,
      materialName: normalizedMaterial.materialName,
      unit: normalizedMaterial.unit,
      movementType: "Opening Stock",
      quantity: normalizedMaterial.openingStock,
      reference: "Raw Material Master",
      user: "Admin",
      notes: "Opening stock from raw material setup"
    });
  }

  return saveRawMaterialMaster(materials);
}

export function softDeleteRawMaterialMaster(material: RawMaterialMaster) {
  return upsertRawMaterialMaster({
    ...material,
    status: "Inactive",
    deletedAt: new Date().toISOString()
  });
}

export function hardDeleteRawMaterialMaster(material: RawMaterialMaster) {
  return saveRawMaterialMaster(
    getRawMaterialMaster().filter((item) => masterKey(item) !== masterKey(material))
  );
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
    (item) =>
      item.companyId === record.companyId &&
      ((record.materialCode && item.materialCode === record.materialCode) ||
        materialKey(item.materialName) === materialKey(record.materialName))
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
  companyId,
  materials,
  minimums,
  movements
}: {
  companyId?: string;
  materials?: RawMaterialMaster[];
  minimums: RawMaterialMinimum[];
  movements: RawMaterialMovement[];
}) {
  const rows = new Map<string, RawMaterialRow>();
  const activeMaterials = materials ?? getRawMaterialsForCompany(companyId);
  const ensureRow = (materialName: string, unit: string, materialCode?: string, rowCompanyId?: string, category?: string) => {
    const key = `${rowCompanyId ?? "COMP-AGAHOZO"}::${materialCode || materialName}`.toLowerCase();
    const minimum = minimums.find((record) =>
      record.companyId === rowCompanyId &&
      ((materialCode && record.materialCode === materialCode) || materialKey(record.materialName) === materialKey(materialName))
    );

    if (!rows.has(key)) {
      rows.set(key, {
        category,
        companyId: rowCompanyId,
        materialCode,
        materialName,
        unit: minimum?.unit ?? unit,
        openingStock: 0,
        rawMaterialIn: 0,
        rawMaterialOut: 0,
        remainingStock: 0,
        minimumLevel: minimum?.minimumLevel ?? 0,
        reorderLevel: minimum?.reorderLevel ?? Math.floor((minimum?.minimumLevel ?? 0) / 2),
        status: "Sufficient",
        lastUpdated: undefined
      });
    }

    return rows.get(key)!;
  };

  activeMaterials.forEach((material) => {
    ensureRow(
      material.materialName,
      material.unit,
      material.materialCode,
      material.companyId,
      material.category
    );
  });

  movements.forEach((movement) => {
    if (companyId && companyId !== "all" && movement.companyId !== companyId) return;
    const hasActiveMaster = activeMaterials.some(
      (material) =>
        material.companyId === movement.companyId &&
        (material.materialCode === movement.materialCode ||
          materialKey(material.materialName) === materialKey(movement.materialName))
    );
    if (!hasActiveMaster && materials) return;
    const master = activeMaterials.find(
      (material) =>
        material.companyId === movement.companyId &&
        (material.materialCode === movement.materialCode ||
          materialKey(material.materialName) === materialKey(movement.materialName))
    );
    const row = ensureRow(
      movement.materialName,
      movement.unit,
      movement.materialCode,
      movement.companyId,
      master?.category
    );

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

    if (!row.lastUpdated || movement.date > row.lastUpdated) {
      row.lastUpdated = movement.date;
    }
  });

  minimums.forEach((minimum) => {
    if (companyId && companyId !== "all" && minimum.companyId !== companyId) return;
    const hasActiveMaster = activeMaterials.some(
      (material) =>
        material.companyId === minimum.companyId &&
        (material.materialCode === minimum.materialCode ||
          materialKey(material.materialName) === materialKey(minimum.materialName))
    );
    if (!hasActiveMaster && materials) return;
    ensureRow(minimum.materialName, minimum.unit, minimum.materialCode, minimum.companyId);
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
