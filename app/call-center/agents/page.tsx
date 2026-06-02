"use client";

import { useEffect, useMemo, useState } from "react";
import { Headphones, PhoneCall, UserCheck, UserRound } from "lucide-react";
import { CallCenterShell } from "@/components/CallCenterShell";
import type { SessionUser } from "@/lib/auth";
import {
  updateAgentStatus,
  type AgentStatus,
  type CallCenterAgent
} from "@/lib/call-center-data";
import { getCompanyAgents } from "@/lib/call-center-operations";

const statuses: AgentStatus[] = ["Available", "Ringing", "On Call", "Away", "Offline"];

export default function CallCenterAgentsPage() {
  return (
    <CallCenterShell title="Agent Control" subtitle="Availability & Extension Monitor">
      {(user) => <AgentsContent user={user} />}
    </CallCenterShell>
  );
}

function AgentsContent({ user }: { user: SessionUser }) {
  const [agents, setAgents] = useState<CallCenterAgent[]>([]);

  useEffect(() => {
    setAgents(getCompanyAgents(user));
  }, [user]);

  const summary = useMemo(
    () => ({
      available: agents.filter((agent) => agent.status === "Available").length,
      ringing: agents.filter((agent) => agent.status === "Ringing").length,
      onCall: agents.filter((agent) => agent.status === "On Call").length,
      offline: agents.filter((agent) => agent.status === "Offline").length
    }),
    [agents]
  );

  function setStatus(agentId: string, status: AgentStatus) {
    updateAgentStatus(agentId, status);
    setAgents(getCompanyAgents(user));
  }

  return (
    <div className="space-y-6">
      <section className="app-card-soft p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Headphones className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-950">Call Center Agents</h2>
            <p className="mt-1 text-sm text-slate-600">
              Control mock agent status and decide who can receive new calls.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={UserCheck} label="Available" value={summary.available} />
        <Kpi icon={PhoneCall} label="Ringing" value={summary.ringing} />
        <Kpi icon={Headphones} label="On Call" value={summary.onCall} />
        <Kpi icon={UserRound} label="Offline" value={summary.offline} />
      </div>

      <section className="app-card p-5">
        <h3 className="mb-4 text-lg font-black text-slate-950">Agent Status System</h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <article className="rounded-lg border border-slate-200 bg-white p-4" key={agent.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-black text-slate-950">{agent.name}</h4>
                  <p className="mt-1 text-sm font-semibold text-slate-500">Extension {agent.extension}</p>
                </div>
                <StatusBadge status={agent.status} />
              </div>
              <label className="mt-4 block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-normal text-slate-500">Status</span>
                <select className="form-input" onChange={(event) => setStatus(agent.id, event.target.value as AgentStatus)} value={agent.status}>
                  {statuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <p className="mt-3 text-xs font-semibold text-slate-500">
                {agent.status === "Available" ? "Can receive new calls." : "Will not receive new calls."}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof UserCheck; label: string; value: number }) {
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

function StatusBadge({ status }: { status: AgentStatus }) {
  const style =
    status === "Available"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "On Call" || status === "Ringing"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-50 text-slate-600";
  return <span className={`status-badge ${style}`}>{status}</span>;
}
