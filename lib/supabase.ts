export type SupabaseTable =
  | "users"
  | "products"
  | "product_prices"
  | "inventory_movements"
  | "loading_records"
  | "sales_records"
  | "cash_records"
  | "returns_records"
  | "expenses_records"
  | "audit_logs";

type SupabasePayloadRow<T> = {
  id: string;
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
    payload: record,
    updated_at: getUpdatedAt(record) ?? new Date().toISOString()
  }));

  if (rows.length === 0) {
    return;
  }

  try {
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
  } catch (error) {
    console.warn(error);
  }
}
