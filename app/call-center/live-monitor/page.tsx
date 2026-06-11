"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Clock, Headphones, Pause, PhoneCall, PhoneMissed, Server, Siren, UserCheck } from "lucide-react";
import { CallCenterShell } from "@/components/CallCenterShell";
import type { SessionUser } from "@/lib/auth";
import { getAgents, getAverageWaitSeconds, getCallDuration, getMissedCalls, transferCall, type QueueCall } from "@/lib/call-center-data";
import { getCompanyAgents, getCompanyClients, getCompanyQueueCalls } from "@/lib/call-center-operations";
import { getTelephonyAudit } from "@/lib/telephonyAudit";
import { getTelephonySettings } from "@/lib/telephonyService";

const secondsLabel = (seconds: number) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

export default function LiveMonitorPage() {
  return (
    <CallCenterShell title="Live Call Monitor" subtitle="Manager Monitoring View">
      {(user) => <LiveMonitorContent user={user} />}
    </CallCenterShell>
  );
}

function LiveMonitorContent({ user }: { user: SessionUser }) {
  const [calls, setCalls] = useState<QueueCall[]>([]);
  const [agents, setAgents] = useState<ReturnType<typeof getAgents>>([]);
  const [priority, setPriority] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const [providerStatus, setProviderStatus] = useState("Not Connected");
  const [lastSync, setLastSync] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<ReturnType<typeof getTelephonyAudit>>([]);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 5000);
    return () => window.clearInterval(interval);
  }, [user]);

  function refresh() {
    setCalls(getCompanyQueueCalls(user));
    setAgents(getCompanyAgents(user));
    const settings = getTelephonySettings();
    setProviderStatus(`${settings.provider} - ${settings.webhookUrl || "/api/telephony/webhook"}`);
    setWebhookEvents(getTelephonyAudit().filter((entry) => entry.action === "webhook_received" || entry.action === "provider_action"));
    setLastSync(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  }

  const active = calls.filter((call) => call.status === "Active" || call.status === "Transferred");
  const waiting = calls.filter((call) => call.status === "Waiting" || call.status === "Incoming");
  const summary = useMemo(() => ({
    active: active.length,
    available: agents.filter((agent) => agent.status === "Available").length,
    waiting: waiting.length,
    hold: calls.filter((call) => call.notes.some((note) => note.toLowerCase().includes("hold"))).length,
    missed: getMissedCalls().filter((call) => !call.clientId || getCompanyClients(user).some((client) => client.id === call.clientId)).length,
    averageWait: secondsLabel(getAverageWaitSeconds(calls))
  }), [active.length, agents, calls, waiting.length]);

  function transfer(call: QueueCall) {
    transferCall(call.id, "Supervisor", "Manager Monitor");
    setCalls(getCompanyQueueCalls(user));
    setMessage(`${call.clientName} transferred to Supervisor.`);
  }

  return (
    <div className="space-y-6">
      {message ? <Notice message={message} /> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
        <Metric icon={Server} label="Provider" value={providerStatus} />
        <Metric icon={PhoneCall} label="On Call" value={summary.active} />
        <Metric icon={UserCheck} label="Available" value={summary.available} />
        <Metric icon={Clock} label="Waiting" value={summary.waiting} />
        <Metric icon={Pause} label="On Hold" value={summary.hold} />
        <Metric icon={PhoneMissed} label="Missed" value={summary.missed} />
        <Metric icon={Headphones} label="Avg Wait" value={summary.averageWait} />
      </div>
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700">
        Last sync time: {lastSync || "Waiting for monitor refresh"}
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-black">Live Calls</h3>
        <div className="grid gap-3">
          {active.map((call) => (
            <article className="rounded-lg border border-slate-200 p-4" key={call.id}>
              <div className="grid gap-4 xl:grid-cols-[1fr_180px_180px_220px] xl:items-center">
                <div>
                  <p className="font-black">{call.clientName}</p>
                  <p className="text-sm font-semibold text-slate-500">{call.phone} · {call.location}</p>
                </div>
                <p className="text-sm font-bold">Agent: {call.assignedAgent ?? "Unassigned"}</p>
                <p className="text-sm font-bold">Duration: {getCallDuration(call.acceptedAt ?? call.startedAt)}</p>
                <div className="flex flex-wrap gap-2">
                  <button className="secondary-button" type="button">Open Client</button>
                  <button className="secondary-button" onClick={() => transfer(call)} type="button"><ArrowRightLeft className="h-4 w-4" /> Transfer</button>
                  <button className={priority[call.id] ? "danger-button" : "secondary-button"} onClick={() => setPriority((current) => ({ ...current, [call.id]: !current[call.id] }))} type="button"><Siren className="h-4 w-4" /> Priority</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel title="Waiting Callers">
          {waiting.map((call) => (
            <Row key={call.id} left={call.clientName} middle={call.phone} right={secondsLabel(Math.floor((Date.now() - new Date(call.startedAt).getTime()) / 1000))} />
          ))}
        </Panel>
        <Panel title="Agent Status">
          {agents.map((agent) => (
            <Row key={agent.id} left={agent.name} middle={`Ext ${agent.extension} · ${agent.phoneType ?? "Browser Softphone"}`} right={agent.status} />
          ))}
        </Panel>
        <Panel title="Webhook Events">
          {webhookEvents.slice(0, 6).map((event) => (
            <Row key={event.id} left={event.action} middle={event.actor} right={event.createdAt.slice(11, 19)} />
          ))}
          {webhookEvents.length === 0 ? <p className="text-sm font-semibold text-slate-500">No webhook events yet.</p> : null}
        </Panel>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof PhoneCall; label: string; value: number | string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div><p className="text-sm font-bold text-slate-500">{label}</p><p className="mt-3 text-3xl font-black text-blue-700">{value}</p></div>
        <div className="rounded-lg bg-blue-50 p-2 text-blue-700"><Icon className="h-5 w-5" /></div>
      </div>
    </article>
  );
}

function Panel({ children, title }: { children: React.ReactNode; title: string }) {
  return <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h3 className="mb-4 font-black">{title}</h3><div className="space-y-3">{children}</div></section>;
}

function Row({ left, middle, right }: { left: string; middle: string; right: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="font-black">{left}</span><span className="font-semibold text-slate-600">{middle}</span><span className="status-badge border-blue-100 bg-blue-50 text-blue-700">{right}</span></div>;
}

function Notice({ message }: { message: string }) {
  return <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div>;
}
