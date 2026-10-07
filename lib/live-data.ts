import { defaultProducts } from "@/lib/products-data";
import { defaultUsers } from "@/lib/users-data";
import { defaultCompanies } from "@/lib/companies-data";
import {
  fetchSupabaseTable,
  isSupabaseConfigured,
  isSupabaseTableMissing,
  upsertSupabaseRows,
  type SupabaseTable
} from "@/lib/supabase";

type LocalTableConfig<T> = {
  localKey: string;
  table: SupabaseTable;
  getId: (record: T) => string;
  getUpdatedAt?: (record: T) => string | undefined;
  seed?: T[];
  seedCloudWhenEmpty?: boolean;
};

const configs: LocalTableConfig<unknown>[] = [
  {
    localKey: "kingapp.users",
    table: "users",
    getId: (record) => (record as { username: string }).username,
    seed: defaultUsers,
    seedCloudWhenEmpty: true
  },
  {
    localKey: "kingapp.companies",
    table: "companies",
    getId: (record) => (record as { id: string }).id,
    getUpdatedAt: (record) => (record as { updatedAt?: string }).updatedAt,
    seed: defaultCompanies
  },
  {
    localKey: "kingapp.productMaster",
    table: "products",
    getId: (record) => (record as { itemCode: string }).itemCode,
    seed: defaultProducts,
    seedCloudWhenEmpty: true
  },
  {
    localKey: "kingapp.priceHistory",
    table: "product_prices",
    getId: (record) => (record as { id: string }).id,
    getUpdatedAt: (record) =>
      (record as { changedAt?: string }).changedAt ?? undefined
  },
  {
    localKey: "kingapp.inventoryMovements",
    table: "inventory_movements",
    getId: (record) => (record as { id: string }).id
  },
  {
    localKey: "kingapp.loadingRecords",
    table: "loading_records",
    getId: (record) => (record as { id: string }).id,
    getUpdatedAt: (record) =>
      (record as { updatedAt?: string; createdAt?: string }).updatedAt ??
      (record as { createdAt?: string }).createdAt
  },
  {
    localKey: "kingapp.salesRecords",
    table: "sales_records",
    getId: (record) => (record as { id: string }).id,
    getUpdatedAt: (record) =>
      (record as { updatedAt?: string; createdAt?: string }).updatedAt ??
      (record as { createdAt?: string }).createdAt
  },
  {
    localKey: "kingapp.cashRecords",
    table: "cash_records",
    getId: (record) => (record as { id: string }).id,
    getUpdatedAt: (record) =>
      (record as { updatedAt?: string; createdAt?: string }).updatedAt ??
      (record as { createdAt?: string }).createdAt
  },
  {
    localKey: "kingapp.returnRecords",
    table: "returns_records",
    getId: (record) => (record as { id: string }).id,
    getUpdatedAt: (record) =>
      (record as { updatedAt?: string; createdAt?: string }).updatedAt ??
      (record as { createdAt?: string }).createdAt
  },
  {
    localKey: "kingapp.expenseRecords",
    table: "expenses_records",
    getId: (record) => (record as { id: string }).id,
    getUpdatedAt: (record) =>
      (record as { updatedAt?: string; createdAt?: string }).updatedAt ??
      (record as { createdAt?: string }).createdAt
  },
  {
    localKey: "kingapp.auditLog",
    table: "audit_logs",
    getId: (record) => (record as { id: string }).id,
    getUpdatedAt: (record) => (record as { createdAt?: string }).createdAt
  },
  // Factory records. seedCloudWhenEmpty keeps records that were entered on a device
  // before the database tables existed: the first sync uploads them instead of clearing them.
  {
    localKey: "kingapp.rawMaterialMaster",
    table: "raw_material_master",
    getId: rawMaterialMasterId,
    seedCloudWhenEmpty: true
  },
  {
    localKey: "kingapp.rawMaterialMovements",
    table: "raw_material_movements",
    getId: (record) => (record as { id: string }).id,
    seedCloudWhenEmpty: true
  },
  {
    localKey: "kingapp.rawMaterialMinimums",
    table: "raw_material_minimums",
    getId: rawMaterialMinimumId,
    seedCloudWhenEmpty: true
  },
  {
    localKey: "kingapp.productionRecords",
    table: "production_records",
    getId: (record) => (record as { id: string }).id,
    getUpdatedAt: (record) => (record as { updatedAt?: string }).updatedAt,
    seedCloudWhenEmpty: true
  },
  {
    localKey: "kingapp.utilityRecords",
    table: "utility_records",
    getId: (record) => (record as { id: string }).id,
    getUpdatedAt: (record) => (record as { updatedAt?: string }).updatedAt,
    seedCloudWhenEmpty: true
  }
];

type RawMaterialKeyParts = { id?: string; companyId?: string; materialCode?: string; materialName?: string };

export function rawMaterialMasterId(record: unknown) {
  const material = record as RawMaterialKeyParts;
  return material.id ?? `${material.companyId ?? ""}::${material.materialCode || material.materialName || ""}`;
}

export function rawMaterialMinimumId(record: unknown) {
  const minimum = record as RawMaterialKeyParts;
  return `${minimum.companyId ?? ""}::${minimum.materialCode || minimum.materialName || ""}`.toLowerCase();
}

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

function dedupeCloudRecords<T>(records: T[], getId: (record: T) => string) {
  const map = new Map<string, T>();

  records.forEach((record) => {
    map.set(getId(record), record);
  });

  return Array.from(map.values());
}

export async function syncSupabaseToLocalStorage() {
  if (!isSupabaseConfigured()) {
    return;
  }

  await Promise.all(
    configs.map(async (config) => {
      const cloudRecords = await fetchSupabaseTable<unknown>(config.table);

      if (isSupabaseTableMissing(config.table)) {
        // The table has not been created in the database yet: keep this device's records as they are.
        return;
      }

      if (cloudRecords) {
        const normalizedCloudRecords = dedupeCloudRecords(
          cloudRecords,
          config.getId
        );

        if (normalizedCloudRecords.length > 0) {
          writeJson(config.localKey, normalizedCloudRecords);
          return;
        }

        const localRecords = readJson<unknown[]>(
          config.localKey,
          config.seed ?? []
        );

        if (config.seedCloudWhenEmpty && localRecords.length > 0) {
          writeJson(config.localKey, localRecords);
          await upsertSupabaseRows(
            config.table,
            localRecords,
            config.getId,
            config.getUpdatedAt
          );
          return;
        }

        writeJson(config.localKey, config.seed ?? []);
        return;
      }

      const localRecords = readJson<unknown[]>(
        config.localKey,
        config.seed ?? []
      );

      if (localRecords.length > 0) {
        writeJson(config.localKey, localRecords);
        await upsertSupabaseRows(
          config.table,
          localRecords,
          config.getId,
          config.getUpdatedAt
        );
      }
    })
  );
}

// How records of a saved list are told apart, for the lists that are shared through the database.
export function getSyncedRecordId(localKey: string) {
  return configs.find((config) => config.localKey === localKey)?.getId;
}

// Sends what this device holds to the database. Used after a backup is restored,
// so the restored records reach the other devices instead of being replaced at the next sync.
export async function uploadLocalRecordsToSupabase(localKeys: string[]) {
  if (!isSupabaseConfigured()) {
    return;
  }

  await Promise.all(
    configs
      .filter((config) => localKeys.includes(config.localKey))
      .map((config) =>
        upsertSupabaseRows(
          config.table,
          readJson<unknown[]>(config.localKey, []),
          config.getId,
          config.getUpdatedAt
        )
      )
  );
}

export function mirrorRecordsToSupabase<T>(
  table: SupabaseTable,
  records: T[],
  getId: (record: T) => string,
  getUpdatedAt?: (record: T) => string | undefined
) {
  void upsertSupabaseRows(table, records, getId, getUpdatedAt);
}
