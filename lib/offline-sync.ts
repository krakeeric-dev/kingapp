import type { UserRole } from "@/lib/auth";
import type { SupabaseTable } from "@/lib/supabase";

export type SyncStatus = "pending" | "synced" | "failed" | "conflict";

export type SyncQueueItem = {
  id: string;
  table: SupabaseTable;
  actionType: string;
  user: string;
  role: UserRole | "unknown";
  timestamp: string;
  payload: unknown;
  syncStatus: SyncStatus;
  error?: string;
};

const DB_NAME = "kingapp-offline";
const STORE_NAME = "syncQueue";
const LAST_SYNC_KEY = "kingapp.lastSyncTime";

function getDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T> | void
) {
  const db = await getDb();

  return new Promise<T | undefined>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = callback(store);

    if (request) {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } else {
      transaction.oncomplete = () => resolve(undefined);
      transaction.onerror = () => reject(transaction.error);
    }
  });
}

function readSessionUser() {
  try {
    const rawSession = window.localStorage.getItem("kingapp.session");
    return rawSession
      ? (JSON.parse(rawSession) as { displayName: string; role: UserRole })
      : null;
  } catch {
    return null;
  }
}

export async function enqueueOfflineAction({
  actionType,
  payload,
  table
}: {
  actionType: string;
  payload: unknown;
  table: SupabaseTable;
}) {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return;
  }

  const session = readSessionUser();
  const item: SyncQueueItem = {
    id: `SYNC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase(),
    table,
    actionType,
    user: session?.displayName ?? "Unknown user",
    role: session?.role ?? "unknown",
    timestamp: new Date().toISOString(),
    payload,
    syncStatus: "pending"
  };

  await withStore("readwrite", (store) => store.put(item));
}

export async function getSyncQueue() {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return [];
  }

  return ((await withStore("readonly", (store) => store.getAll())) ??
    []) as SyncQueueItem[];
}

export async function updateSyncItem(item: SyncQueueItem) {
  await withStore("readwrite", (store) => store.put(item));
}

export async function getSyncSummary() {
  const items = await getSyncQueue();

  return {
    pending: items.filter((item) => item.syncStatus === "pending").length,
    failed: items.filter((item) => item.syncStatus === "failed").length,
    conflicts: items.filter((item) => item.syncStatus === "conflict").length,
    lastSyncTime: window.localStorage.getItem(LAST_SYNC_KEY) ?? "",
    items
  };
}

export function saveLastSyncTime(value = new Date().toISOString()) {
  window.localStorage.setItem(LAST_SYNC_KEY, value);
}
