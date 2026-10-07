"use client";

import { ChangeEvent, useState } from "react";
import { DatabaseBackup, Download, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { SessionUser } from "@/lib/auth";
import {
  createBackup,
  downloadBackup,
  parseBackup,
  restoreBackup,
  summarizeBackup,
  type BackupFile
} from "@/lib/backup-data";
import { formatDateTime, logAuditEvent } from "@/lib/loading-data";

export default function BackupPage() {
  return <AppShell>{(user) => <BackupContent user={user} />}</AppShell>;
}

function BackupContent({ user }: { user: SessionUser }) {
  const [chosen, setChosen] = useState<BackupFile | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function handleDownload() {
    setError("");
    const backup = createBackup(user.displayName);
    const summary = summarizeBackup(backup);

    downloadBackup(backup);
    logAuditEvent({
      action: "backup_downloaded",
      module: "Backup",
      recordId: backup.createdAt,
      reason: `Backup downloaded with ${summary.records} records`,
      status: "success",
      user
    });
    setMessage(
      `Saved. The backup file holds ${summary.records.toLocaleString()} records and is in your downloads. Keep it somewhere safe, such as your email or Google Drive.`
    );
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setMessage("");
    setError("");
    setChosen(null);
    setConfirming(false);

    if (!file) return;

    try {
      setChosen(parseBackup(await file.text()));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The file could not be read.");
    }
  }

  async function handleRestore() {
    if (!chosen) return;
    setBusy(true);
    setError("");

    try {
      const restored = await restoreBackup(chosen);
      logAuditEvent({
        action: "backup_restored",
        module: "Backup",
        recordId: chosen.createdAt,
        reason: `Backup of ${chosen.createdAt} restored with ${restored} records`,
        status: "success",
        user
      });
      setMessage(
        `Restored. ${restored.toLocaleString()} records were put back. Records added after the backup were kept.`
      );
      setChosen(null);
      setConfirming(false);
    } catch (problem) {
      console.warn(problem);
      setError("The backup could not be restored. Check the file and try again.");
    } finally {
      setBusy(false);
    }
  }

  const summary = chosen ? summarizeBackup(chosen) : null;

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <DatabaseBackup className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-950">Backup</h2>
            <p className="mt-1 text-sm text-slate-600">
              Save a copy of this device&apos;s KingApp records to a file, or put records back from a file saved earlier.
            </p>
          </div>
        </div>
      </section>

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700" role="status">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">
          {error}
        </div>
      ) : null}

      <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold text-slate-950">Download a backup</h3>
        <p className="mt-1 text-sm text-slate-600">
          The file holds stock, production, sales, cash, customers and the other records on this device. User accounts and
          passwords are left out.
        </p>
        <button className="primary-button mt-4 min-h-11 w-full sm:w-auto" onClick={handleDownload} type="button">
          <Download className="h-4 w-4" />
          Download backup
        </button>
      </section>

      <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold text-slate-950">Restore from a backup file</h3>
        <p className="mt-1 text-sm text-slate-600">
          Every record in the file is put back. Records added since the backup stay, and where a record was changed after
          the backup, the newer version is kept.
        </p>
        <label className="secondary-button mt-4 min-h-11 w-full cursor-pointer sm:w-auto">
          <Upload className="h-4 w-4" />
          Choose backup file
          <input accept="application/json,.json" className="sr-only" onChange={handleFile} type="file" />
        </label>

        {summary ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-950">
              Backup of {summary.createdAt ? formatDateTime(summary.createdAt) : "an unknown date"}
              {summary.createdBy ? `, saved by ${summary.createdBy}` : ""}
            </p>
            <p className="mt-1 text-sm text-slate-600">{summary.records.toLocaleString()} records</p>
            {confirming ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button className="primary-button min-h-11" disabled={busy} onClick={handleRestore} type="button">
                  {busy ? "Restoring..." : "Yes, put these records back"}
                </button>
                <button className="secondary-button min-h-11" disabled={busy} onClick={() => setConfirming(false)} type="button">
                  Not now
                </button>
              </div>
            ) : (
              <button className="primary-button mt-3 min-h-11 w-full sm:w-auto" onClick={() => setConfirming(true)} type="button">
                Restore this backup
              </button>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
