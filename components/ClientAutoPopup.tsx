"use client";

import { PhoneIncoming, X } from "lucide-react";
import type { CallCenterClient, QueueCall } from "@/lib/call-center-data";
import { formatMoney } from "@/lib/sales-data";

type ClientAutoPopupProps = {
  call?: QueueCall | null;
  client?: CallCenterClient | null;
  onAccept?: () => void;
  onClose?: () => void;
  onQueue?: () => void;
};

export function ClientAutoPopup({
  call,
  client,
  onAccept,
  onClose,
  onQueue
}: ClientAutoPopupProps) {
  if (!call && !client) return null;

  const displayClient = client;
  const name = displayClient?.clientName ?? call?.clientName ?? "Unknown Caller";
  const phone = displayClient?.phone ?? call?.phone ?? "";
  const area = displayClient?.area ?? call?.location ?? "Unknown area";
  const balance = displayClient?.currentBalance ?? call?.currentBalance ?? 0;
  const lastOrder = displayClient
    ? `${displayClient.lastOrderQuantity} cartons on ${displayClient.lastOrderDate}`
    : call?.lastOrder ?? "No order history";
  const notes = displayClient?.notes ?? call?.notes ?? [];

  return (
    <section className="rounded-xl border border-blue-200 bg-white p-5 shadow-2xl shadow-blue-950/10">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <PhoneIncoming className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-black uppercase text-blue-700">Client Auto Popup</p>
            <h3 className="mt-1 text-2xl font-black text-slate-950">{name}</h3>
            <p className="mt-1 text-sm font-bold text-slate-600">{phone} - {area}</p>
          </div>
        </div>
        {onClose ? (
          <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose} type="button">
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PopupInfo label="Owner" value={displayClient?.ownerName ?? "Unknown"} />
        <PopupInfo label="Balance Due" danger={balance > 0} value={`${formatMoney(balance)} RWF`} />
        <PopupInfo label="Credit Limit" value="500,000 RWF" />
        <PopupInfo label="Assigned Marketer" value={displayClient?.assignedMarketer ?? call?.assignedMarketer ?? "Unassigned"} />
        <PopupInfo label="Last Order" value={lastOrder} />
        <PopupInfo label="Last Payment" value={displayClient?.lastPaymentDate ?? "No payment recorded"} />
        <PopupInfo label="Company" value={displayClient?.companyName ?? call?.companyName ?? "All Companies"} />
        <PopupInfo label="Call Reason" value={call?.callReason ?? "Customer Care"} />
      </div>

      {notes.length > 0 ? (
        <div className="mt-4 rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-black uppercase text-slate-500">Notes</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {notes.slice(0, 4).map((note) => (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-sm" key={note}>
                {note}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {(onAccept || onQueue) ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {onAccept ? <button className="primary-button" onClick={onAccept} type="button">Accept Call</button> : null}
          {onQueue ? <button className="secondary-button" onClick={onQueue} type="button">Send to Queue</button> : null}
        </div>
      ) : null}
    </section>
  );
}

function PopupInfo({ danger = false, label, value }: { danger?: boolean; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className={`mt-1 font-black ${danger ? "text-red-600" : "text-slate-950"}`}>{value}</p>
    </div>
  );
}
