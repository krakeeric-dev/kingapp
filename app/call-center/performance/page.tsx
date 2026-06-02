"use client";

import { useEffect, useMemo, useState } from "react";
import { Headphones, MessageSquareWarning, ShoppingCart, Trophy, WalletCards } from "lucide-react";
import { CallCenterShell } from "@/components/CallCenterShell";
import {
  callCenterCompanies,
  getActiveCallCenterCompany,
  getCallCenterSummary,
  getPerformanceRows,
  setActiveCallCenterCompany
} from "@/lib/call-center-operations";
import { formatMoney } from "@/lib/sales-data";

export default function CallCenterPerformancePage() {
  return (
    <CallCenterShell title="Agent Performance" subtitle="Outsourcing Operations Scoreboard">
      <PerformanceContent />
    </CallCenterShell>
  );
}

function PerformanceContent() {
  const [companyId, setCompanyId] = useState("all");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    setCompanyId(getActiveCallCenterCompany());
  }, []);

  function changeCompany(value: string) {
    setCompanyId(setActiveCallCenterCompany(value));
    setVersion((current) => current + 1);
  }

  const rows = useMemo(() => getPerformanceRows(), [version]);
  const summary = useMemo(() => getCallCenterSummary(), [version]);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950">Agent Performance Dashboard</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Track outsourcing productivity by calls, orders, complaints, payment follow-ups, and revenue.</p>
          </div>
          <select className="form-input max-w-xs" onChange={(event) => changeCompany(event.target.value)} value={companyId}>
            <option value="all">All Companies</option>
            {callCenterCompanies.map((company) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi icon={Headphones} label="Total Calls" value={summary.totalCalls.toLocaleString()} />
        <Kpi icon={ShoppingCart} label="Total Orders" value={summary.totalOrders.toLocaleString()} />
        <Kpi icon={MessageSquareWarning} label="Total Complaints" value={summary.totalComplaints.toLocaleString()} />
        <Kpi icon={Trophy} label="Best Agent" value={summary.bestAgent} />
        <Kpi icon={WalletCards} label="Revenue Generated" value={`${formatMoney(summary.revenueGenerated)} RWF`} />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-black text-slate-950">Performance Table</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500">
              <tr>
                {["Agent", "Calls Today", "Calls This Week", "Orders Taken", "Complaints Resolved", "Payment Follow Ups", "Average Call Time", "Performance %"].map((heading) => (
                  <th className="px-4 py-3" key={heading}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="border-t border-slate-100" key={row.agent}>
                  <td className="px-4 py-3 font-black text-slate-950">{row.agent}</td>
                  <td className="px-4 py-3">{row.callsToday}</td>
                  <td className="px-4 py-3">{row.callsThisWeek}</td>
                  <td className="px-4 py-3">{row.ordersTaken}</td>
                  <td className="px-4 py-3">{row.complaintsResolved}</td>
                  <td className="px-4 py-3">{row.paymentFollowUps}</td>
                  <td className="px-4 py-3">{row.averageCallTime}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{row.performance}%</span>
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

function Kpi({ icon: Icon, label, value }: { icon: typeof Headphones; label: string; value: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-slate-500">{label}</p>
          <p className="mt-3 text-xl font-black text-slate-950">{value}</p>
        </div>
        <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  );
}
