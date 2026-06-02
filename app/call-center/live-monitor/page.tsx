"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Clock, Headphones, PhoneCall, PhoneMissed, Siren, UserCheck } from "lucide-react";
import { CallCenterShell } from "@/components/CallCenterShell";
import { getAgents, getAverageWaitSeconds, getCallDuration, getCallCenterClients, getMissedCalls, getQueueCalls, transferCall, type QueueCall } from "@/lib/call-center-data";

const secondsLabel = (seconds: number) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

export default function LiveMonitorPage() {
  return (
    <CallCenterShell title="Live Call Monitor" subtitle="Manager Monitoring View">
      <LiveMonitorContent />
    </CallCenterShell>
  );
}

function LiveMonitorContent() {
  const [calls, setCalls] = useState<QueueCall[]>([]);
  const [agents, setAgents] = useState<ReturnType<typeof getAgents>>([]);
  const [priority, setPriority] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 5000);
    return () => window.clearInterval(interval);
  }, []);

  function refresh() {
    setCalls(getQueueCalls());
    setAgents(getAgents());
  }

  const active = calls.filter((call) => call.status === "Active" || call.status === "Transferred");
  const waiting = calls.filter((call) => call.status === "Waiting" || call.status === "Incoming");
  const summary = useMemo(() => ({
    active: active.length,
    available: agents.filter((agent) => agent.status === "Available").length,
    waiting: waiting.length,
    missed: getMissedCalls().length,
    averageWait: secondsLabel(getAverageWaitSeconds(calls))
  }), [active.length, agents, calls, waiting.length]);

  function transfer(call: QueueCall) {
    setCalls(transferCall(call.id, "Supervisor", "Manager Monitor"));
    setMessage(`${call.clientName} transferred to Supervisor.`);
  }

  return (
    <div className="space-y-6">
      {message ? <Notice message={message} /> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric icon={PhoneCall} label="On Call" value={summary.active} />
        <Metric icon={UserCheck} label="Available" value={summary.available} />
        <Metric icon={Clock} label="Waiting" value={summary.waiting} />
        <Metric icon={PhoneMissed} label="Missed" value={summary.missed} />
        <Metric icon={Headphones} label="Avg Wait" value={summary.averageWait} />
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
