"use client";

import { useEffect, useMemo, useState } from "react";
import { PhoneCall, PhoneMissed, RefreshCw } from "lucide-react";
import { CallCenterShell } from "@/components/CallCenterShell";
import type { SessionUser } from "@/lib/auth";
import {
  addCallback,
  getMissedCalls,
  updateMissedCallStatus,
  type MissedCall,
  type MissedCallStatus
} from "@/lib/call-center-data";
import { getCompanyClients } from "@/lib/call-center-operations";

const statuses: MissedCallStatus[] = ["Not Called Back", "Called Back", "No Answer", "Converted to Order"];

export default function MissedCallsPage() {
  return (
    <CallCenterShell title="Missed Calls" subtitle="Callback Recovery Desk">
      {(user) => <MissedCallsContent user={user} />}
    </CallCenterShell>
  );
}

function MissedCallsContent({ user }: { user: SessionUser }) {
  const [calls, setCalls] = useState<MissedCall[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const clients = getCompanyClients(user);
    setCalls(getMissedCalls().filter((call) => !call.clientId || clients.some((client) => client.id === call.clientId)));
  }, [user]);

  const summary = useMemo(
    () => ({
      total: calls.length,
      open: calls.filter((call) => call.status === "Not Called Back").length,
      calledBack: calls.filter((call) => call.status === "Called Back").length
    }),
    [calls]
  );

  function setStatus(callId: string, status: MissedCallStatus) {
    updateMissedCallStatus(callId, status);
    const clients = getCompanyClients(user);
    setCalls(getMissedCalls().filter((call) => !call.clientId || clients.some((client) => client.id === call.clientId)));
  }

  function createCallback(call: MissedCall) {
    addCallback({
      clientId: call.clientId ?? call.id,
      clientName: call.caller,
      phone: call.phone,
      callbackDate: new Date().toISOString().slice(0, 10),
      callbackTime: new Date().toTimeString().slice(0, 5),
      reason: call.reason || "Missed call callback",
      assignedAgent: user.displayName,
      priority: "High",
      status: "Pending"
    });
    updateMissedCallStatus(call.id, "Called Back");
    const clients = getCompanyClients(user);
    setCalls(getMissedCalls().filter((item) => !item.clientId || clients.some((client) => client.id === item.clientId)));
    setMessage("Callback created and missed call marked Called Back.");
  }

  return (
    <div className="space-y-6">
      <section className="app-card-soft p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-50 text-red-700">
            <PhoneMissed className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-950">Missed Calls</h2>
            <p className="mt-1 text-sm text-slate-600">
              Track every missed caller and convert them into callbacks or orders.
            </p>
          </div>
        </div>
      </section>

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric icon={PhoneMissed} label="Missed Calls" value={summary.total} />
        <Metric icon={RefreshCw} label="Not Called Back" value={summary.open} />
        <Metric icon={PhoneCall} label="Called Back" value={summary.calledBack} />
      </div>

      <section className="app-card p-5">
        <h3 className="mb-4 text-lg font-black text-slate-950">Missed Call Register</h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Caller</th>
                <th>Phone</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Callback</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => (
                <tr key={call.id}>
                  <td>{call.date}</td>
                  <td>{call.time}</td>
                  <td className="font-bold text-slate-950">{call.caller}</td>
                  <td>{call.phone}</td>
                  <td>{call.reason}</td>
                  <td>
                    <select className="form-input min-w-44" onChange={(event) => setStatus(call.id, event.target.value as MissedCallStatus)} value={call.status}>
                      {statuses.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </td>
                  <td>
                    <button className="primary-button" onClick={() => createCallback(call)} type="button">Callback</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof PhoneMissed; label: string; value: number }) {
  return (
    <article className="app-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-black text-brand-800">{value}</p>
        </div>
        <div className="rounded-lg bg-brand-50 p-2 text-brand-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  );
}
