"use client";

import { CheckCircle2, Circle, ClipboardCheck, ShieldCheck } from "lucide-react";
import { CallCenterShell } from "@/components/CallCenterShell";

const checklist = [
  { label: "Provider selected", done: false },
  { label: "Webhook URL copied", done: Boolean(process.env.NEXT_PUBLIC_TELEPHONY_WEBHOOK_CONFIGURED) },
  { label: "Env variables configured", done: false },
  { label: "Agents assigned extensions", done: true },
  { label: "Test inbound call", done: false },
  { label: "Test outbound call", done: false },
  { label: "Test hold/resume", done: false },
  { label: "Test transfer", done: false },
  { label: "Test missed call", done: false },
  { label: "Test recording link", done: false },
  { label: "Test client auto-popup", done: true },
  { label: "Test audit log", done: false },
  { label: "Test Vercel env variables", done: false }
];

export default function ProductionChecklistPage() {
  return (
    <CallCenterShell title="Production Checklist" subtitle="Go-Live Readiness">
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-3 text-blue-700">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black">Customer Care & Relationship Management (CCRM) Production Checklist</h3>
              <p className="text-sm font-semibold text-slate-500">
                Use this before connecting real 3CX, Twilio, Asterisk, SIP, IP phone, or fixed-line gateways.
              </p>
            </div>
          </div>
          <div className="grid gap-3">
            {checklist.map((item) => (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3" key={item.label}>
                <div className="flex items-center gap-3">
                  {item.done ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className="h-5 w-5 text-slate-400" />}
                  <span className="font-black text-slate-950">{item.label}</span>
                </div>
                <span className={`status-badge ${item.done ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                  {item.done ? "Ready" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        </section>

        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-700" />
            <h3 className="font-black">Production Notes</h3>
          </div>
          <div className="space-y-3 text-sm font-semibold text-slate-600">
            <p>Secrets must be configured as environment variables, not stored in browser state.</p>
            <p>Webhook signatures must be verified before events are saved.</p>
            <p>Run inbound, outbound, transfer, missed-call, and recording tests before go-live.</p>
            <p>Manual Mode remains available for staff training and provider downtime drills.</p>
          </div>
        </aside>
      </div>
    </CallCenterShell>
  );
}
