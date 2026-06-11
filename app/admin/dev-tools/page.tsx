"use client";

import { useState } from "react";
import { PhoneCall, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  getQueueCalls,
  saveQueueCalls,
  type QueueCall
} from "@/lib/call-center-data";
import { getCompanyName } from "@/lib/companies-data";

export default function AdminDevToolsPage() {
  return (
    <AppShell allowedRoles={["admin"]}>
      {(user) => <DevToolsContent user={user} />}
    </AppShell>
  );
}

function DevToolsContent({ user }: { user: { companyId: string; companyName: string } }) {
  const [message, setMessage] = useState("");

  function simulateIncomingCall() {
    const companyId = user.companyId === "all" ? "COMP-AGAHOZO" : user.companyId;
    const call: QueueCall = {
      id: `QCALL-INTERNAL-${Date.now()}`,
      companyId,
      companyName: getCompanyName(companyId, user.companyName),
      clientId: `UNKNOWN-${Date.now()}`,
      clientName: "Unknown Caller",
      phone: "0788999000",
      location: "Unknown location",
      currentBalance: 0,
      lastOrder: "No order history",
      assignedMarketer: "Unassigned",
      callReason: "Customer Care",
      status: "Incoming",
      startedAt: new Date().toISOString(),
      notes: ["Internal call check"]
    };
    saveQueueCalls([call, ...getQueueCalls()]);
    setMessage("Incoming call check added to the call queue.");
  }

  async function sendTestIncomingCall() {
    const response = await fetch("/api/call-center/incoming-call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callerNumber: "0788000001",
        calledNumber: "+250 788 100 500",
        provider: "Internal",
        callId: `INTERNAL-${Date.now()}`,
        timestamp: new Date().toISOString()
      })
    });
    setMessage(response.ok ? "Webhook check sent." : "Webhook check failed.");
  }

  return (
    <div className="space-y-6">
      <section className="app-card-soft p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-brand-50 p-3 text-brand-700">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-normal text-brand-700">Admin Tools</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">Internal System Tools</h1>
            <p className="mt-2 text-sm text-slate-600">Restricted utilities for administrators.</p>
          </div>
        </div>
      </section>
      {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div> : null}
      <section className="app-card p-5">
        <h2 className="text-lg font-black text-slate-950">Call Center Provider Checks</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="secondary-button" onClick={simulateIncomingCall} type="button">
            <PhoneCall className="h-4 w-4" />
            Add Incoming Call Check
          </button>
          <button className="secondary-button" onClick={sendTestIncomingCall} type="button">
            <PhoneCall className="h-4 w-4" />
            Send Webhook Check
          </button>
        </div>
      </section>
    </div>
  );
}
