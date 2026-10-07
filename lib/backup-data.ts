import { getSyncedRecordId, uploadLocalRecordsToSupabase } from "@/lib/live-data";

export type BackupFile = {
  app: "KingApp";
  version: 1;
  createdAt: string;
  createdBy: string;
  records: Record<string, unknown>;
};

export type BackupSummary = {
  createdAt: string;
  createdBy: string;
  lists: number;
  records: number;
};

const PREFIX = "kingapp.";

// Left out on purpose: who is signed in, user accounts and their passwords,
// and settings that belong to one device.
const EXCLUDED_KEYS = new Set([
  "kingapp.session",
  "kingapp.users",
  "kingapp.offlineAllowedUsers",
  "kingapp.activeCompanyId",
  "kingapp.lastSyncTime",
  "kingapp.productionStart.version",
  "kingapp.permissionMessage"
]);

function isBackupKey(key: string) {
  return key.startsWith(PREFIX) && !EXCLUDED_KEYS.has(key);
}

function countRecords(records: Record<string, unknown>) {
  return Object.values(records).reduce<number>(
    (total, value) => total + (Array.isArray(value) ? value.length : 1),
    0
  );
}

export function createBackup(createdBy: string): BackupFile {
  const records: Record<string, unknown> = {};

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !isBackupKey(key)) continue;

    try {
      records[key] = JSON.parse(window.localStorage.getItem(key) ?? "null");
    } catch {
      // A value that is not valid JSON is not one of KingApp's record lists.
    }
  }

  return { app: "KingApp", version: 1, createdAt: new Date().toISOString(), createdBy, records };
}

export function summarizeBackup(backup: BackupFile): BackupSummary {
  return {
    createdAt: backup.createdAt,
    createdBy: backup.createdBy,
    lists: Object.keys(backup.records).length,
    records: countRecords(backup.records)
  };
}

export function parseBackup(text: string): BackupFile {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("This file is not a KingApp backup. Choose a file that was downloaded from this page.");
  }

  const backup = parsed as Partial<BackupFile> | null;

  if (!backup || backup.app !== "KingApp" || typeof backup.records !== "object" || backup.records === null) {
    throw new Error("This file is not a KingApp backup. Choose a file that was downloaded from this page.");
  }

  return {
    app: "KingApp",
    version: 1,
    createdAt: typeof backup.createdAt === "string" ? backup.createdAt : "",
    createdBy: typeof backup.createdBy === "string" ? backup.createdBy : "",
    records: backup.records as Record<string, unknown>
  };
}

function timestampOf(record: unknown) {
  const item = record as { updatedAt?: string; createdAt?: string } | null;
  return item?.updatedAt ?? item?.createdAt ?? "";
}

// Puts back every record in the backup without throwing away newer work:
// records added since the backup stay, and where the same record is in both,
// the one changed most recently is kept.
function mergeList(key: string, current: unknown[], fromBackup: unknown[]) {
  const syncedId = getSyncedRecordId(key);
  const idOf = (record: unknown) => {
    if (syncedId) return syncedId(record);
    const id = (record as { id?: unknown } | null)?.id;
    return typeof id === "string" || typeof id === "number" ? String(id) : "";
  };

  if (fromBackup.some((record) => !idOf(record)) || current.some((record) => !idOf(record))) {
    // Without ids the records cannot be matched one to one, so the backup's list is used as it is.
    return fromBackup;
  }

  const merged = new Map<string, unknown>();
  current.forEach((record) => merged.set(idOf(record), record));
  fromBackup.forEach((record) => {
    const existing = merged.get(idOf(record));

    if (existing === undefined || timestampOf(record) >= timestampOf(existing)) {
      merged.set(idOf(record), record);
    }
  });

  return Array.from(merged.values());
}

export async function restoreBackup(backup: BackupFile) {
  const restoredKeys: string[] = [];
  let restoredRecords = 0;

  Object.entries(backup.records).forEach(([key, value]) => {
    if (!isBackupKey(key) || value === null || value === undefined) return;

    let current: unknown = null;
    try {
      current = JSON.parse(window.localStorage.getItem(key) ?? "null");
    } catch {
      current = null;
    }

    const next = Array.isArray(value) && Array.isArray(current) ? mergeList(key, current, value) : value;
    window.localStorage.setItem(key, JSON.stringify(next));
    restoredKeys.push(key);
    restoredRecords += Array.isArray(value) ? value.length : 1;
  });

  await uploadLocalRecordsToSupabase(restoredKeys);
  window.dispatchEvent(new Event("kingapp:data-synced"));

  return restoredRecords;
}

export function downloadBackup(backup: BackupFile) {
  const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `kingapp-backup-${backup.createdAt.slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
