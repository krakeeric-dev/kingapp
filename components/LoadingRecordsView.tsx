"use client";

import { FormEvent, useMemo, useState } from "react";
import { Download, LockOpen, Printer, Search } from "lucide-react";
import { KingAppLogo } from "@/components/KingAppLogo";
import type { SessionUser } from "@/lib/auth";
import type { LoadingRecord } from "@/lib/loading-data";
import {
  formatDate,
  logAuditEvent,
  statusChipClass,
  statusLabels,
  unlockLoadingRecord
} from "@/lib/loading-data";
import { getCompanyById } from "@/lib/companies-data";

type LoadingRecordsViewProps = {
  records: LoadingRecord[];
  user: SessionUser;
  onRecordsChange: (records: LoadingRecord[]) => void;
  showAdminFilters?: boolean;
  emptyMessage?: string;
};

export function LoadingRecordsView({
  records,
  user,
  onRecordsChange,
  showAdminFilters = false,
  emptyMessage = "No loading records yet."
}: LoadingRecordsViewProps) {
  const [filters, setFilters] = useState({
    date: "",
    marketer: "",
    product: ""
  });
  const [unlockRecordId, setUnlockRecordId] = useState("");
  const [unlockReason, setUnlockReason] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [printRecord, setPrintRecord] = useState<LoadingRecord | null>(null);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchesDate = !filters.date || record.date === filters.date;
      const matchesMarketer =
        !filters.marketer ||
        record.marketerUsername
          .toLowerCase()
          .includes(filters.marketer.toLowerCase()) ||
        record.marketerName.toLowerCase().includes(filters.marketer.toLowerCase());
      const matchesProduct =
        !filters.product ||
        record.productName.toLowerCase().includes(filters.product.toLowerCase());

      return matchesDate && matchesMarketer && matchesProduct;
    });
  }, [filters, records]);

  function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUnlockError("");

    if (!unlockReason.trim()) {
      setUnlockError("Enter an unlock reason before continuing.");
      return;
    }

    const updatedRecords = unlockLoadingRecord(
      unlockRecordId,
      unlockReason.trim(),
      user
    );
    onRecordsChange(updatedRecords);
    setUnlockRecordId("");
    setUnlockReason("");
  }

  function printLoadingNote(record: LoadingRecord, action: "print" | "pdf") {
    setPrintRecord(record);
    logAuditEvent({
      action: action === "print" ? "loading_note_printed" : "loading_note_pdf_requested",
      companyId: user.companyId,
      companyName: user.companyName,
      module: "Loading",
      recordId: record.id,
      reason: action === "print" ? "Loading note printed" : "Loading note PDF requested",
      status: "success",
      user
    });
    window.setTimeout(() => window.print(), 120);
  }

  return (
    <>
    <div className="space-y-4 print:hidden">
      {showAdminFilters ? (
        <div className="app-card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
            <Search className="h-4 w-4 text-brand-700" />
            Filter loading records
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-normal text-slate-500">
                Date
              </span>
              <input
                className="form-input"
                onChange={(event) =>
                  setFilters((current) => ({ ...current, date: event.target.value }))
                }
                type="date"
                value={filters.date}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-normal text-slate-500">
                Marketer
              </span>
              <input
                className="form-input"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    marketer: event.target.value
                  }))
                }
                placeholder="Search marketer"
                value={filters.marketer}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-normal text-slate-500">
                Product
              </span>
              <input
                className="form-input"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    product: event.target.value
                  }))
                }
                placeholder="Search product"
                value={filters.product}
              />
            </label>
          </div>
        </div>
      ) : null}

      <div className="hidden max-h-[620px] overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm lg:block">
        <table className="data-table">
          <thead>
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Item Code</th>
              <th className="px-4 py-3">Marketer</th>
              <th className="px-4 py-3">Truck</th>
              <th className="px-4 py-3 text-right">Cartons</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Loading Note</th>
              {user.role === "admin" ? <th className="px-4 py-3">Admin</th> : null}
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((record) => (
              <tr key={record.id}>
                <td className="px-4 py-3 text-slate-700">{formatDate(record.date)}</td>
                <td className="px-4 py-3 font-semibold text-slate-950">
                  {record.productName}
                </td>
                <td className="px-4 py-3 text-slate-700">{record.itemCode}</td>
                <td className="px-4 py-3 text-slate-700">{record.marketerName}</td>
                <td className="px-4 py-3 text-slate-700">{record.truck}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-950">
                  {record.loadedCartons.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`status-badge ${statusChipClass(
                      record.status
                    )}`}
                  >
                    {statusLabels[record.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="secondary-button !px-3 !py-2 !text-xs"
                      onClick={() => printLoadingNote(record, "print")}
                      type="button"
                    >
                      <Printer className="h-4 w-4" />
                      Print
                    </button>
                    <button
                      className="secondary-button !px-3 !py-2 !text-xs"
                      onClick={() => printLoadingNote(record, "pdf")}
                      type="button"
                    >
                      <Download className="h-4 w-4" />
                      PDF
                    </button>
                  </div>
                </td>
                {user.role === "admin" ? (
                  <td className="px-4 py-3">
                    {record.locked ? (
                      <button
                        className="secondary-button !px-3 !py-2 !text-xs"
                        onClick={() => setUnlockRecordId(record.id)}
                        type="button"
                      >
                        <LockOpen className="h-4 w-4" />
                        Unlock
                      </button>
                    ) : (
                      <span className="text-xs font-semibold text-slate-500">
                        Unlocked
                      </span>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:hidden">
        {filteredRecords.map((record) => (
          <article
            className="app-card p-4"
            key={record.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-950">{record.productName}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {record.itemCode} - {formatDate(record.date)}
                </p>
              </div>
              <span
                className={`status-badge ${statusChipClass(
                  record.status
                )}`}
              >
                {statusLabels[record.status]}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="block text-xs font-semibold uppercase tracking-normal text-slate-500">
                  Marketer
                </span>
                <span className="font-semibold text-slate-900">
                  {record.marketerName}
                </span>
              </div>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-normal text-slate-500">
                  Truck
                </span>
                <span className="font-semibold text-slate-900">{record.truck}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-normal text-slate-500">
                  Cartons
                </span>
                <span className="font-semibold text-slate-900">
                  {record.loadedCartons.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-normal text-slate-500">
                  Storekeeper
                </span>
                <span className="font-semibold text-slate-900">
                  {record.storekeeperName}
                </span>
              </div>
            </div>
            {record.rejectionReason ? (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {record.rejectionReason}
              </p>
            ) : null}
            {user.role === "admin" && record.locked ? (
              <button
                className="secondary-button mt-4 w-full"
                onClick={() => setUnlockRecordId(record.id)}
                type="button"
              >
                <LockOpen className="h-4 w-4" />
                Unlock
              </button>
            ) : null}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                className="secondary-button w-full"
                onClick={() => printLoadingNote(record, "print")}
                type="button"
              >
                <Printer className="h-4 w-4" />
                Print Loading Note
              </button>
              <button
                className="secondary-button w-full"
                onClick={() => printLoadingNote(record, "pdf")}
                type="button"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </button>
            </div>
          </article>
        ))}
      </div>

      {filteredRecords.length === 0 ? (
        <div className="rounded-lg border border-dashed border-brand-200 bg-white px-5 py-8 text-center text-sm font-semibold text-slate-500">
          {emptyMessage}
        </div>
      ) : null}

      {unlockRecordId ? (
        <div className="app-card p-4">
          <form className="space-y-3" onSubmit={handleUnlock}>
            <div>
              <h3 className="font-bold text-slate-950">Unlock confirmed record</h3>
              <p className="mt-1 text-sm text-slate-600">
                A reason is required and will be saved in the audit log.
              </p>
            </div>
            <textarea
              className="form-input min-h-24"
              onChange={(event) => setUnlockReason(event.target.value)}
              placeholder="Reason for unlock"
              value={unlockReason}
            />
            {unlockError ? (
              <p className="text-sm font-semibold text-red-700">{unlockError}</p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                className="primary-button"
                type="submit"
              >
                Save unlock
              </button>
              <button
                className="secondary-button"
                onClick={() => {
                  setUnlockRecordId("");
                  setUnlockReason("");
                  setUnlockError("");
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
    {printRecord ? (
      <LoadingNotePreview
        company={getCompanyById(user.companyId)}
        onClose={() => setPrintRecord(null)}
        onPrint={() => window.print()}
        record={printRecord}
        user={user}
      />
    ) : null}
    {printRecord ? (
      <div className="hidden print:block">
        <PrintableLoadingNote
          company={getCompanyById(user.companyId)}
          record={printRecord}
          user={user}
        />
      </div>
    ) : null}
    </>
  );
}

function LoadingNotePreview({
  company,
  onClose,
  onPrint,
  record,
  user
}: {
  company: ReturnType<typeof getCompanyById>;
  onClose: () => void;
  onPrint: () => void;
  record: LoadingRecord;
  user: SessionUser;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4 print:hidden">
      <div className="mx-auto max-w-5xl rounded-xl bg-white p-4 shadow-2xl">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-black text-slate-950">Loading Note Preview</h3>
            <p className="text-sm font-semibold text-slate-500">Use Print and choose “Save as PDF” to download a PDF copy.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="primary-button" onClick={onPrint} type="button">
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button className="secondary-button" onClick={onPrint} type="button">
              <Download className="h-4 w-4" />
              Download PDF
            </button>
            <button className="secondary-button" onClick={onClose} type="button">Close</button>
          </div>
        </div>
        <PrintableLoadingNote company={company} record={record} user={user} />
      </div>
    </div>
  );
}

function PrintableLoadingNote({
  company,
  record,
  user
}: {
  company: ReturnType<typeof getCompanyById>;
  record: LoadingRecord;
  user: SessionUser;
}) {
  const loadingTime = new Date(record.submittedAt ?? record.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
  const companyName = company?.name || user.companyName || "Company";
  const tinNumber = company?.tinNumber || "TIN not recorded";
  const logo = company?.logo;

  return (
    <section className="print-page mx-auto min-h-[297mm] max-w-[210mm] border border-slate-300 bg-white p-8 text-slate-950 shadow-lg">
      <div className="flex items-start justify-between gap-6 border-b-2 border-slate-950 pb-5">
        <div className="flex items-center gap-4">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={`${companyName} logo`} className="h-20 w-20 rounded-lg object-contain" src={logo} />
          ) : (
            <KingAppLogo className="rounded-lg" size={80} />
          )}
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wide">{companyName}</h1>
            <p className="mt-1 text-sm font-bold">TIN: {tinNumber}</p>
            <p className="mt-2 text-lg font-black uppercase">Professional Loading Note</p>
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="font-black uppercase text-slate-500">Loading Number</p>
          <p className="text-lg font-black">{record.id}</p>
          <p className="mt-3 font-bold">Date: {formatDate(record.date)}</p>
          <p className="font-bold">Time: {loadingTime}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <NoteField label="Driver Name" value="" />
        <NoteField label="Driver Phone" value="" />
        <NoteField label="Vehicle Plate Number" value={record.truck} />
        <NoteField label="Marketer Name" value={record.marketerName} />
        <NoteField label="Route" value="" />
        <NoteField label="Client Name" value="Not linked" />
        <NoteField label="Client Phone" value="Not linked" />
        <NoteField label="Client Location" value="Not linked" />
      </div>

      <table className="mt-7 w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-400 px-3 py-3 text-left">Product</th>
            <th className="border border-slate-400 px-3 py-3 text-right">Quantity Loaded</th>
            <th className="border border-slate-400 px-3 py-3 text-left">Unit</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-slate-400 px-3 py-3 font-bold">{record.productName}</td>
            <td className="border border-slate-400 px-3 py-3 text-right font-bold">{record.loadedCartons.toLocaleString()}</td>
            <td className="border border-slate-400 px-3 py-3">Cartons</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-5 grid grid-cols-[1fr_220px] gap-5">
        <div className="rounded-lg border border-slate-300 p-4">
          <p className="text-xs font-black uppercase text-slate-500">Comments</p>
          <p className="mt-2 min-h-20 text-sm font-semibold">{record.notes || "No comments recorded."}</p>
        </div>
        <div className="rounded-lg border-2 border-slate-950 p-4 text-center">
          <p className="text-xs font-black uppercase text-slate-500">Total Cartons</p>
          <p className="mt-4 text-4xl font-black">{record.loadedCartons.toLocaleString()}</p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-[1fr_150px] gap-6">
        <div>
          <h3 className="text-sm font-black uppercase">Signature Area</h3>
          <div className="mt-6 grid grid-cols-2 gap-x-10 gap-y-8 text-sm">
            <SignatureLine label="Storekeeper" value={record.storekeeperName} />
            <SignatureLine label="Driver" />
            <SignatureLine label="Marketer" value={record.marketerName} />
            <SignatureLine label="Supervisor" />
          </div>
        </div>
        <div className="flex h-36 flex-col items-center justify-center border-2 border-dashed border-slate-500 text-center">
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 9 }).map((_, index) => (
              <span className="h-5 w-5 bg-slate-900" key={index} />
            ))}
          </div>
          <p className="mt-3 text-xs font-black uppercase">Scan to verify loading</p>
          <p className="mt-1 text-[10px] font-semibold text-slate-500">QR Code Placeholder</p>
        </div>
      </div>
    </section>
  );
}

function NoteField({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-400 pb-2">
      <p className="text-[11px] font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 min-h-5 font-bold">{value || "____________________________"}</p>
    </div>
  );
}

function SignatureLine({ label, value = "" }: { label: string; value?: string }) {
  return (
    <div>
      <div className="border-b border-slate-950 pb-2 font-semibold">{value}</div>
      <p className="mt-2 text-xs font-black uppercase text-slate-500">{label}</p>
    </div>
  );
}
