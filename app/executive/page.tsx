"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Building2, Headphones, PackageCheck, PhoneCall, ShoppingCart, TrendingUp, WalletCards } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  getExecutiveCompanyMetrics,
  getExecutiveGroupSummary,
  switchExecutiveWorkspace,
  type ExecutiveCompanyMetric
} from "@/lib/executive-data";
import { formatMoney } from "@/lib/sales-data";

type SortKey = keyof Pick<
  ExecutiveCompanyMetric,
  "salesToday" | "cashCollected" | "orders" | "outstandingDebt" | "inventoryValue" | "callsToday" | "complaintsOpen" | "performance"
>;

export default function ExecutivePage() {
  return (
    <AppShell allowedRoles={["admin"]}>
      {() => <ExecutiveContent />}
    </AppShell>
  );
}

function ExecutiveContent() {
  const router = useRouter();
  const [version, setVersion] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("salesToday");

  useEffect(() => {
    function refresh() {
      setVersion((current) => current + 1);
    }
    window.addEventListener("kingapp:data-synced", refresh);
    window.addEventListener("kingapp:company-switched", refresh);
    return () => {
      window.removeEventListener("kingapp:data-synced", refresh);
      window.removeEventListener("kingapp:company-switched", refresh);
    };
  }, []);

  const rows = useMemo(() => getExecutiveCompanyMetrics(), [version]);
  const summary = useMemo(() => getExecutiveGroupSummary(), [version]);
  const sortedRows = useMemo(
    () => [...rows].sort((first, second) => Number(second[sortKey]) - Number(first[sortKey])),
    [rows, sortKey]
  );

  function switchWorkspace(companyId: string) {
    switchExecutiveWorkspace(companyId);
    router.push("/dashboard");
  }

  return (
    <div className="space-y-6">
      <section className="app-card-soft p-5 sm:p-6">
        <p className="text-sm font-black uppercase text-brand-700">KINGAPP GROUP CONTROL ROOM</p>
        <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-3xl font-black text-slate-950 sm:text-5xl">All Companies</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-600">
              One owner view for sales, cash, orders, debts, deliveries, calls, complaints, and performance across every company.
            </p>
          </div>
          <button className="secondary-button" onClick={() => switchWorkspace("all")} type="button">
            View Group Dashboard
          </button>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Building2} label="Total Companies" value={summary.totalCompanies.toLocaleString()} />
        <Kpi icon={TrendingUp} label="Group Sales Today" value={`${formatMoney(summary.groupSalesToday)} RWF`} />
        <Kpi icon={WalletCards} label="Group Cash Collected" value={`${formatMoney(summary.groupCashCollected)} RWF`} />
        <Kpi icon={ShoppingCart} label="Group Orders Today" value={summary.groupOrdersToday.toLocaleString()} />
        <Kpi icon={WalletCards} label="Group Outstanding Debt" value={`${formatMoney(summary.groupOutstandingDebt)} RWF`} />
        <Kpi icon={PhoneCall} label="Group Active Calls" value={summary.groupActiveCalls.toLocaleString()} />
        <Kpi icon={Headphones} label="Group Complaints" value={summary.groupComplaints.toLocaleString()} />
        <Kpi icon={PackageCheck} label="Group Deliveries" value={summary.groupDeliveries.toLocaleString()} />
      </div>

      <section className="grid gap-4 xl:grid-cols-4">
        {rows.map((row) => (
          <article className="app-card p-5" key={row.company.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-slate-950">{row.company.name}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">{row.company.type}</p>
              </div>
              <span className={`status-badge ${row.company.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                {row.company.status}
              </span>
            </div>
            <div className="mt-5 grid gap-2 text-sm">
              <Info label="Sales today" value={`${formatMoney(row.salesToday)} RWF`} />
              <Info label="Cash collected" value={`${formatMoney(row.cashCollected)} RWF`} />
              <Info label="Orders" value={row.orders.toLocaleString()} />
              <Info label="Deliveries" value={row.deliveries.toLocaleString()} />
              <Info label="Returns" value={row.returns.toLocaleString()} />
              <Info label="Outstanding debt" value={`${formatMoney(row.outstandingDebt)} RWF`} />
              <Info label="Calls today" value={row.callsToday.toLocaleString()} />
              <Info label="Complaints open" value={row.complaintsOpen.toLocaleString()} />
              <Info label="Staff online" value={row.staffOnline.toLocaleString()} />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button className="secondary-button !px-3 !py-2 !text-xs" onClick={() => switchWorkspace(row.company.id)} type="button">View Company</button>
              <button className="primary-button !px-3 !py-2 !text-xs" onClick={() => switchWorkspace(row.company.id)} type="button">Switch Workspace</button>
              <button className="secondary-button !px-3 !py-2 !text-xs" onClick={() => { switchExecutiveWorkspace(row.company.id); router.push("/reports"); }} type="button">Company Report</button>
            </div>
          </article>
        ))}
      </section>

      <section className="app-card p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-brand-700" />
            <h3 className="text-lg font-black text-slate-950">Company Comparison</h3>
          </div>
          <select className="form-input max-w-xs" onChange={(event) => setSortKey(event.target.value as SortKey)} value={sortKey}>
            <option value="salesToday">Sort by Sales</option>
            <option value="cashCollected">Sort by Cash</option>
            <option value="orders">Sort by Orders</option>
            <option value="outstandingDebt">Sort by Debts</option>
            <option value="inventoryValue">Sort by Inventory Value</option>
            <option value="callsToday">Sort by Calls</option>
            <option value="complaintsOpen">Sort by Complaints</option>
            <option value="performance">Sort by Performance</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Sales Today</th>
                <th>Cash Collected</th>
                <th>Orders</th>
                <th>Debts</th>
                <th>Inventory Value</th>
                <th>Calls</th>
                <th>Complaints</th>
                <th>Performance %</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.company.id}>
                  <td className="font-black text-slate-950">{row.company.name}</td>
                  <td>{formatMoney(row.salesToday)} RWF</td>
                  <td>{formatMoney(row.cashCollected)} RWF</td>
                  <td>{row.orders.toLocaleString()}</td>
                  <td>{formatMoney(row.outstandingDebt)} RWF</td>
                  <td>{formatMoney(row.inventoryValue)} RWF</td>
                  <td>{row.callsToday.toLocaleString()}</td>
                  <td>{row.complaintsOpen.toLocaleString()}</td>
                  <td><span className="status-badge border-brand-100 bg-brand-50 text-brand-800">{row.performance}%</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <article className="app-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-black text-brand-800">{value}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
      <span className="font-bold text-slate-500">{label}</span>
      <span className="text-right font-black text-slate-950">{value}</span>
    </div>
  );
}
