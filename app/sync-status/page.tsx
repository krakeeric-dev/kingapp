"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  getSyncSummary,
  type SyncQueueItem
} from "@/lib/offline-sync";
import { formatDateTime } from "@/lib/loading-data";
import { syncPendingQueue } from "@/lib/supabase";

export default function SyncStatusPage() {
  return (
    <AppShell>
      {() => <SyncStatusContent />}
    </AppShell>
  );
}

function SyncStatusContent() {
  const [online, setOnline] = useState(true);
  const [items, setItems] = useState<SyncQueueItem[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState("");
  const pending = items.filter((item) => item.syncStatus === "pending").length;
  const failed = items.filter((item) => item.syncStatus === "failed");
  const conflicts = items.filter((item) => item.syncStatus === "conflict");

  async function refresh() {
    setOnline(navigator.onLine);
    const summary = await getSyncSummary();
    setItems(summary.items);
    setLastSyncTime(summary.lastSyncTime);
  }

  async function retrySync() {
    await syncPendingQueue();
    await refresh();
  }

  useEffect(() => {
    void refresh();
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);

    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="app-card-soft p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              {online ? <Wifi className="h-6 w-6" /> : <WifiOff className="h-6 w-6" />}
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-950">Sync Status</h2>
              <p className="mt-1 text-sm text-slate-600">
                {online
                  ? "Online - pending records can sync to Supabase."
                  : "Offline Mode — data will sync when internet returns"}
              </p>
            </div>
          </div>
          <button className="primary-button" onClick={retrySync} type="button">
            <RefreshCw className="h-4 w-4" />
            Retry Sync
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <SummaryCard label="Connection" value={online ? "Online" : "Offline"} />
        <SummaryCard label="Pending Sync" value={pending.toLocaleString()} />
        <SummaryCard label="Failed Syncs" value={failed.length.toLocaleString()} danger />
        <SummaryCard
          label="Last Sync"
          value={lastSyncTime ? formatDateTime(lastSyncTime) : "Not synced yet"}
        />
      </div>

      <section className="app-card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-black text-slate-950">Failed Sync Items</h3>
        </div>
        <SyncTable items={failed} empty="No failed sync items." />
      </section>

      <section className="app-card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-black text-slate-950">
            Conflicts Needing Review
          </h3>
        </div>
        <SyncTable items={conflicts} empty="No conflicts needing admin review." />
      </section>
    </div>
  );
}

function SummaryCard({
  danger = false,
  label,
  value
}: {
  danger?: boolean;
  label: string;
  value: string;
}) {
  return (
    <article className="app-card p-5">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className={`mt-3 text-xl font-black ${danger ? "text-red-700" : "text-brand-800"}`}>
        {value}
      </p>
    </article>
  );
}

function SyncTable({ empty, items }: { empty: string; items: SyncQueueItem[] }) {
  if (items.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-sm font-semibold text-slate-500">
        {empty}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Action</th>
            <th>User</th>
            <th>Role</th>
            <th>Status</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{formatDateTime(item.timestamp)}</td>
              <td className="font-bold text-slate-950">{item.actionType}</td>
              <td>{item.user}</td>
              <td>{item.role}</td>
              <td>
                <span className="status-badge border-amber-200 bg-amber-50 text-amber-800">
                  {item.syncStatus === "conflict"
                    ? "Needs Admin Review"
                    : item.syncStatus}
                </span>
              </td>
              <td className="text-slate-600">{item.error || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
