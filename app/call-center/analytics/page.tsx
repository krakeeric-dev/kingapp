"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Clock, Headphones, MessageSquareWarning, PhoneCall, PhoneMissed, ShoppingCart, WalletCards } from "lucide-react";
import { CallCenterShell } from "@/components/CallCenterShell";
import type { SessionUser } from "@/lib/auth";
import { getAgents, getAverageWaitSeconds, getCallLogs, getComplaints, getPaymentFollowUps, getPendingOrders, getQueueCalls } from "@/lib/call-center-data";
import { getCompanyAgents, getCompanyClients, getCompanyComplaints, getCompanyOrders, getCompanyPayments, getCompanyQueueCalls } from "@/lib/call-center-operations";
import { getCallRecordings, type CallRecording } from "@/lib/telephonyService";
import { getCcrmIntelligence, getCcrmTickets, groupComplaintsByProduct, groupComplaintsByRegion } from "@/lib/ccrm-data";

const today = () => new Date().toISOString().slice(0, 10);
const secondsLabel = (seconds: number) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

export default function CallAnalyticsPage() {
  return (
    <CallCenterShell title="Customer Intelligence Dashboard" subtitle="Voice of Customer, Quality Risk & Relationship Health">
      {(user) => <AnalyticsContent user={user} />}
    </CallCenterShell>
  );
}

function AnalyticsContent({ user }: { user: SessionUser }) {
  const [logs, setLogs] = useState<ReturnType<typeof getCallLogs>>([]);
  const [calls, setCalls] = useState<ReturnType<typeof getQueueCalls>>([]);
  const [orders, setOrders] = useState<ReturnType<typeof getPendingOrders>>([]);
  const [payments, setPayments] = useState<ReturnType<typeof getPaymentFollowUps>>([]);
  const [complaints, setComplaints] = useState<ReturnType<typeof getComplaints>>([]);
  const [agents, setAgents] = useState<ReturnType<typeof getAgents>>([]);
  const [recordings, setRecordings] = useState<CallRecording[]>([]);

  useEffect(() => {
    const clients = getCompanyClients(user);
    setLogs(getCallLogs().filter((log) => clients.some((client) => client.id === log.clientId)));
    setCalls(getCompanyQueueCalls(user));
    setOrders(getCompanyOrders(user));
    setPayments(getCompanyPayments(user));
    setComplaints(getCompanyComplaints(user));
    setAgents(getCompanyAgents(user));
    setRecordings(getCallRecordings());
  }, [user]);

  const todaysLogs = logs.filter((log) => log.date === today());
  const intelligence = getCcrmIntelligence(user);
  const productGroups = groupComplaintsByProduct(user);
  const regionGroups = groupComplaintsByRegion(user);
  const tickets = getCcrmTickets(user);
  const metrics = useMemo(() => ({
    totalCalls: todaysLogs.length + calls.filter((call) => call.startedAt.slice(0, 10) === today()).length,
    answered: todaysLogs.filter((log) => log.outcome === "Closed").length + calls.filter((call) => call.status === "Active").length,
    missed: calls.filter((call) => call.status === "Missed").length,
    avgTalk: secondsLabel(0),
    avgWait: secondsLabel(getAverageWaitSeconds(calls)),
    orders: orders.filter((order) => order.createdAt.slice(0, 10) === today()).length,
    promises: payments.filter((payment) => payment.createdAt.slice(0, 10) === today()).length,
    complaints: complaints.filter((complaint) => complaint.createdAt.slice(0, 10) === today()).length
  }), [calls, complaints, orders, payments, todaysLogs]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={PhoneCall} label="Total Calls Today" value={metrics.totalCalls} />
        <Metric icon={Headphones} label="Answered Calls" value={metrics.answered} />
        <Metric icon={PhoneMissed} label="Missed Calls" value={metrics.missed} />
        <Metric icon={Clock} label="Average Talk Time" value={metrics.avgTalk} />
        <Metric icon={Clock} label="Average Waiting Time" value={metrics.avgWait} />
        <Metric icon={ShoppingCart} label="Orders Converted" value={metrics.orders} />
        <Metric icon={WalletCards} label="Payment Promises" value={metrics.promises} />
        <Metric icon={MessageSquareWarning} label="Complaints Logged" value={metrics.complaints} />
        <Metric icon={BarChart3} label="Customer Health Score" value={`${intelligence.customerHealthScore}%`} />
        <Metric icon={Headphones} label="Satisfaction Score" value={`${intelligence.satisfactionScore}%`} />
        <Metric icon={BarChart3} label="Product Health Score" value={`${intelligence.productHealthScore}%`} />
        <Metric icon={MessageSquareWarning} label="Open Issues" value={intelligence.openIssues} />
        <Metric icon={MessageSquareWarning} label="Escalated Issues" value={intelligence.escalatedIssues} />
        <Metric icon={MessageSquareWarning} label="High Risk Tickets" value={tickets.filter((ticket) => ["Critical", "Urgent", "High"].includes(ticket.priority)).length} />
        <Metric icon={BarChart3} label="Market Opportunities" value={intelligence.marketOpportunities} />
      </div>

      <section className="grid gap-4 xl:grid-cols-3">
        <InsightPanel title="Complaints by Product" rows={productGroups} empty="No product complaints yet." />
        <InsightPanel title="Complaints by Region" rows={regionGroups} empty="No regional complaints yet." />
        <div className="rounded-lg border border-red-100 bg-white p-5 shadow-sm">
          <h3 className="font-black text-slate-950">Executive Alert Center</h3>
          <div className="mt-4 space-y-3">
            {intelligence.executiveAlerts.map((alert) => (
              <div className="rounded-lg border border-red-100 bg-red-50 p-3" key={alert.issue}>
                <p className="font-black text-red-800">{alert.issue}</p>
                <p className="mt-1 text-sm font-semibold text-red-700">{alert.action}</p>
              </div>
            ))}
            {!intelligence.executiveAlerts.length ? <p className="rounded-lg bg-emerald-50 p-3 text-sm font-black text-emerald-700">No critical alerts.</p> : null}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 font-black">Structured CCRM Tickets</h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Ticket</th><th>Date</th><th>Customer</th><th>Channel</th><th>Issue Type</th><th>Product</th><th>Batch</th><th>Department</th><th>Status</th></tr></thead>
            <tbody>
              {tickets.slice(0, 12).map((ticket) => (
                <tr key={ticket.id}>
                  <td className="font-bold text-slate-950">{ticket.id}</td>
                  <td>{ticket.date}</td>
                  <td>{ticket.customer}</td>
                  <td>{ticket.channel}</td>
                  <td>{ticket.issueType}</td>
                  <td>{ticket.product}</td>
                  <td>{ticket.batchNumber}</td>
                  <td>{ticket.assignedDepartment}</td>
                  <td>{ticket.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!tickets.length ? <p className="px-4 py-6 text-sm font-semibold text-slate-500">No CCRM tickets yet.</p> : null}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><BarChart3 className="h-5 w-5 text-blue-700" /><h3 className="font-black">Agent Performance</h3></div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Agent</th><th>Extension</th><th>Status</th><th>Calls</th><th>Orders</th><th>Payment Promises</th></tr></thead>
              <tbody>
                {agents.map((agent) => (
                  <tr key={agent.id}>
                    <td className="font-bold text-slate-950">{agent.name}</td>
                    <td>{agent.extension}</td>
                    <td>{agent.status}</td>
                    <td>{todaysLogs.filter((log) => log.agent === agent.name).length}</td>
                    <td>{orders.filter((order) => order.createdBy === agent.name && order.createdAt.slice(0, 10) === today()).length}</td>
                    <td>{payments.filter((payment) => payment.agent === agent.name && payment.createdAt.slice(0, 10) === today()).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-black">Conversion Snapshot</h3>
          <div className="space-y-4">
            <Progress label="Answered Rate" value={metrics.totalCalls ? (metrics.answered / metrics.totalCalls) * 100 : 0} />
            <Progress label="Order Conversion" value={metrics.totalCalls ? (metrics.orders / metrics.totalCalls) * 100 : 0} />
            <Progress label="Payment Promise Rate" value={metrics.totalCalls ? (metrics.promises / metrics.totalCalls) * 100 : 0} />
            <Progress label="Complaint Rate" value={metrics.totalCalls ? (metrics.complaints / metrics.totalCalls) * 100 : 0} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 font-black">Call Recording Status</h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Status</th><th>Recording URL</th><th>Duration</th><th>Agent</th><th>Client</th><th>Notes</th></tr></thead>
            <tbody>
              {recordings.map((recording) => (
                <tr key={recording.id}>
                  <td>{recording.recordingStatus}</td>
                  <td>{recording.recordingUrl || "Recording not connected yet"}</td>
                  <td>{recording.duration}</td>
                  <td>{recording.agent}</td>
                  <td className="font-bold text-slate-950">{recording.client}</td>
                  <td>{recording.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof PhoneCall; label: string; value: number | string }) {
  return <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-sm font-bold text-slate-500">{label}</p><p className="mt-3 text-2xl font-black text-blue-700">{value}</p></div><div className="rounded-lg bg-blue-50 p-2 text-blue-700"><Icon className="h-5 w-5" /></div></div></article>;
}

function Progress({ label, value }: { label: string; value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  return <div><div className="mb-1 flex justify-between text-sm font-bold"><span>{label}</span><span>{clamped.toFixed(0)}%</span></div><div className="h-3 rounded-full bg-slate-100"><div className="h-3 rounded-full bg-blue-600" style={{ width: `${clamped}%` }} /></div></div>;
}

function InsightPanel({ empty, rows, title }: { empty: string; rows: Array<{ label: string; value: number }>; title: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-black text-slate-950">{title}</h3>
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex justify-between text-sm font-bold">
              <span>{row.label}</span>
              <span>{row.value}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.min(100, row.value * 12)}%` }} />
            </div>
          </div>
        ))}
        {!rows.length ? <p className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-500">{empty}</p> : null}
      </div>
    </div>
  );
}
