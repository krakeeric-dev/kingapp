import { defaultProducts } from "@/lib/products-data";
import { defaultUsers } from "@/lib/users-data";
import {
  fetchSupabaseTable,
  isSupabaseConfigured,
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

export function mirrorRecordsToSupabase<T>(
  table: SupabaseTable,
  records: T[],
  getId: (record: T) => string,
  getUpdatedAt?: (record: T) => string | undefined
) {
  void upsertSupabaseRows(table, records, getId, getUpdatedAt);
}
