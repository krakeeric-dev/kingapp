"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Clock, Siren } from "lucide-react";
import { CallCenterShell } from "@/components/CallCenterShell";
import type { SessionUser } from "@/lib/auth";
import {
  addCallback,
  updateCallbackStatus,
  type CallbackItem,
  type CallbackPriority,
  type CallCenterClient
} from "@/lib/call-center-data";
import { getCompanyCallbacks, getCompanyClients } from "@/lib/call-center-operations";

const priorities: CallbackPriority[] = ["Low", "Medium", "High", "Urgent"];
const statuses: CallbackItem["status"][] = ["Pending", "Done", "No Answer", "Converted to Order"];

export default function CallbacksPage() {
  return (
    <CallCenterShell title="Callback List" subtitle="Follow-up Scheduler">
      {(user) => <CallbacksContent user={user} />}
    </CallCenterShell>
  );
}

function CallbacksContent({ user }: { user: SessionUser }) {
  const [callbacks, setCallbacks] = useState<CallbackItem[]>([]);
  const [clients, setClients] = useState<CallCenterClient[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setCallbacks(getCompanyCallbacks(user));
    setClients(getCompanyClients(user));
  }, [user]);

  const summary = useMemo(
    () => ({
      pending: callbacks.filter((callback) => callback.status === "Pending").length,
      dueToday: callbacks.filter((callback) => callback.callbackDate === new Date().toISOString().slice(0, 10) && callback.status === "Pending").length,
      urgent: callbacks.filter((callback) => callback.priority === "Urgent" && callback.status === "Pending").length,
      done: callbacks.filter((callback) => callback.status === "Done").length
    }),
    [callbacks]
  );

  function setStatus(callbackId: string, status: CallbackItem["status"]) {
    updateCallbackStatus(callbackId, status);
    setCallbacks(getCompanyCallbacks(user));
  }

  function createCallback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const client = clients.find((item) => item.id === String(form.get("clientId")));
    if (!client) return;

    addCallback({
        clientId: client.id,
        clientName: client.clientName,
        phone: client.phone,
        callbackDate: String(form.get("callbackDate") ?? ""),
        callbackTime: String(form.get("callbackTime") ?? ""),
        reason: String(form.get("reason") ?? ""),
        assignedAgent: String(form.get("assignedAgent") ?? ""),
        priority: String(form.get("priority") ?? "Medium") as CallbackPriority,
        status: "Pending"
      });
    setCallbacks(getCompanyCallbacks(user));
    event.currentTarget.reset();
    setMessage("Callback scheduled.");
  }

  return (
    <div className="space-y-6">
      <section className="app-card-soft p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-950">Callback List</h2>
            <p className="mt-1 text-sm text-slate-600">
              Schedule, prioritize, and complete customer callbacks.
            </p>
          </div>
        </div>
      </section>

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Clock} label="Pending" value={summary.pending} />
        <Metric icon={CalendarClock} label="Due Today" value={summary.dueToday} />
        <Metric icon={Siren} label="Urgent" value={summary.urgent} />
        <Metric icon={CheckCircle2} label="Done" value={summary.done} />
      </div>

      <section className="app-card p-5">
        <h3 className="mb-4 text-lg font-black text-slate-950">Schedule Follow-Up</h3>
        <form className="grid gap-3 md:grid-cols-3" onSubmit={createCallback}>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-normal text-slate-500">Client</span>
            <select className="form-input" name="clientId">
              {clients.map((client) => <option key={client.id} value={client.id}>{client.clientName}</option>)}
            </select>
          </label>
          <Input defaultValue={new Date().toISOString().slice(0, 10)} label="Callback Date" name="callbackDate" type="date" />
          <Input defaultValue={new Date().toTimeString().slice(0, 5)} label="Callback Time" name="callbackTime" type="time" />
          <Input label="Reason" name="reason" />
          <Input defaultValue={user.displayName} label="Assigned Agent" name="assignedAgent" />
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-normal text-slate-500">Priority</span>
            <select className="form-input" name="priority">
              {priorities.map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </label>
          <button className="primary-button md:col-span-3">Schedule callback</button>
        </form>
      </section>

      <section className="app-card p-5">
        <h3 className="mb-4 text-lg font-black text-slate-950">Callback Register</h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Phone</th>
                <th>Date</th>
                <th>Time</th>
                <th>Reason</th>
                <th>Agent</th>
                <th>Priority</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {callbacks.map((callback) => (
                <tr key={callback.id}>
                  <td className="font-bold text-slate-950">{callback.clientName}</td>
                  <td>{callback.phone}</td>
                  <td>{callback.callbackDate}</td>
                  <td>{callback.callbackTime}</td>
                  <td>{callback.reason}</td>
                  <td>{callback.assignedAgent}</td>
                  <td><PriorityBadge priority={callback.priority} /></td>
                  <td>
                    <select className="form-input min-w-44" onChange={(event) => setStatus(callback.id, event.target.value as CallbackItem["status"])} value={callback.status}>
                      {statuses.map((status) => <option key={status}>{status}</option>)}
                    </select>
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

function Metric({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: number }) {
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

function Input({ defaultValue, label, name, type = "text" }: { defaultValue?: string; label: string; name: string; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-normal text-slate-500">{label}</span>
      <input className="form-input" defaultValue={defaultValue} name={name} type={type} />
    </label>
  );
}

function PriorityBadge({ priority }: { priority: CallbackPriority }) {
  const style = priority === "Urgent" || priority === "High"
    ? "border-red-200 bg-red-50 text-red-700"
    : priority === "Medium"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return <span className={`status-badge ${style}`}>{priority}</span>;
}
