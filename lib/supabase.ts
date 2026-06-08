import {
  enqueueOfflineAction,
  getSyncQueue,
  saveLastSyncTime,
  updateSyncItem
} from "@/lib/offline-sync";

export type SupabaseTable =
  | "users"
  | "companies"
  | "products"
  | "product_prices"
  | "inventory_movements"
  | "loading_records"
  | "sales_records"
  | "cash_records"
  | "returns_records"
  | "expenses_records"
  | "delivery_records"
  | "delivery_drivers"
  | "delivery_vehicles"
  | "customer_accounts"
  | "customer_debts"
  | "customer_payments"
  | "audit_logs";

type SupabasePayloadRow<T> = {
  id: string;
  company_id?: string;
  payload: T;
  updated_at?: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

function getRestUrl(table: SupabaseTable, query = "") {
  return `${supabaseUrl}/rest/v1/${table}${query}`;
}

function getHeaders(extraHeaders?: HeadersInit) {
  return {
    apikey: supabaseAnonKey ?? "",
    Authorization: `Bearer ${supabaseAnonKey ?? ""}`,
    "Content-Type": "application/json",
    ...extraHeaders
  };
}

export async function fetchSupabaseTable<T>(table: SupabaseTable) {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const response = await fetch(
      getRestUrl(table, "?select=id,payload,updated_at&order=updated_at.desc"),
      {
        headers: getHeaders(),
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(`Unable to read ${table}`);
    }

    const rows = (await response.json()) as SupabasePayloadRow<T>[];
    return rows.map((row) => row.payload);
  } catch (error) {
    console.warn(error);
    return null;
  }
}

export async function upsertSupabaseRows<T>(
  table: SupabaseTable,
  records: T[],
  getId: (record: T) => string,
  getUpdatedAt: (record: T) => string | undefined = () => undefined
) {
  if (!isSupabaseConfigured()) {
    return;
  }

  const rows = records.map((record) => ({
    id: getId(record),
    company_id:
      typeof record === "object" && record && "companyId" in record
        ? String((record as { companyId?: string }).companyId ?? "")
        : undefined,
    payload: record,
    updated_at: getUpdatedAt(record) ?? new Date().toISOString()
  }));

  if (rows.length === 0) {
    return;
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await enqueueOfflineAction({
      actionType: `upsert:${table}`,
      payload: rows,
      table
    });
    return;
  }

  try {
    await writeRows(table, rows);
  } catch (error) {
    console.warn(error);
    await enqueueOfflineAction({
      actionType: `upsert:${table}`,
      payload: rows,
      table
    });
  }
}

async function writeRows<T>(table: SupabaseTable, rows: SupabasePayloadRow<T>[]) {
  const response = await fetch(getRestUrl(table, "?on_conflict=id"), {
    method: "POST",
    headers: getHeaders({
      Prefer: "resolution=merge-duplicates"
    }),
    body: JSON.stringify(rows)
  });

  if (!response.ok) {
    throw new Error(`Unable to write ${table}`);
  }
}

async function hasConflict<T>(table: SupabaseTable, rows: SupabasePayloadRow<T>[], queuedAt: string) {
  const ids = rows.map((row) => row.id);

  if (ids.length === 0) {
    return false;
  }

  const query = `?select=id,updated_at&id=in.(${ids.map(encodeURIComponent).join(",")})`;
  const response = await fetch(getRestUrl(table, query), {
    headers: getHeaders(),
    cache: "no-store"
  });

  if (!response.ok) {
    return false;
  }

  const remoteRows = (await response.json()) as { id: string; updated_at: string }[];

  return remoteRows.some((row) => row.updated_at > queuedAt);
}

export async function syncPendingQueue() {
  if (!isSupabaseConfigured()) {
    return;
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return;
  }

  const items = await getSyncQueue();
  const pendingItems = items.filter(
    (item) => item.syncStatus === "pending" || item.syncStatus === "failed"
  );

  for (const item of pendingItems) {
    try {
      const rows = item.payload as SupabasePayloadRow<unknown>[];
      const conflict = await hasConflict(item.table, rows, item.timestamp);

      if (conflict) {
        await updateSyncItem({
          ...item,
          syncStatus: "conflict",
          error: "Needs Admin Review"
        });
        continue;
      }

      await writeRows(item.table, rows);
      await updateSyncItem({
        ...item,
        syncStatus: "synced",
        error: ""
      });
    } catch (error) {
      await updateSyncItem({
        ...item,
        syncStatus: "failed",
        error: error instanceof Error ? error.message : "Sync failed"
      });
    }
  }

  saveLastSyncTime();
}
