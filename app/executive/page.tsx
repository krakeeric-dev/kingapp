"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BarChart3, Boxes, Building2, PackageCheck, PhoneCall, ReceiptText, ShoppingCart, TrendingUp, UserRound, WalletCards } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getCompanies } from "@/lib/companies-data";
import {
  getExecutiveAlerts,
  getExecutiveCompanyMetrics,
  getExecutiveGroupSummary,
  switchExecutiveWorkspace,
  type ExecutiveCompanyMetric
} from "@/lib/executive-data";
import { formatMoney } from "@/lib/sales-data";

type SortKey = keyof Pick<
  ExecutiveCompanyMetric,
  "salesToday" | "cashCollected" | "orders" | "outstandingDebt" | "inventoryValue" | "expensesToday" | "profitToday" | "callsToday" | "complaintsOpen" | "performance"
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
  const [companyFilter, setCompanyFilter] = useState("all");

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

  const allRows = useMemo(() => getExecutiveCompanyMetrics(), [version]);
  const rows = useMemo(
    () => companyFilter === "all" ? allRows : allRows.filter((row) => row.company.id === companyFilter),
    [allRows, companyFilter]
  );
  const summary = useMemo(() => getExecutiveGroupSummary(), [version]);
  const scopedSummary = useMemo(() => ({
    totalCompanies: rows.length,
    groupSalesToday: rows.reduce((sum, row) => sum + row.salesToday, 0),
    groupCashCollected: rows.reduce((sum, row) => sum + row.cashCollected, 0),
    groupOutstandingDebt: rows.reduce((sum, row) => sum + row.outstandingDebt, 0),
    groupOrdersToday: rows.reduce((sum, row) => sum + row.orders, 0),
    groupDeliveries: rows.reduce((sum, row) => sum + row.deliveries, 0),
    groupInventoryValue: rows.reduce((sum, row) => sum + row.inventoryValue, 0),
    groupExpensesToday: rows.reduce((sum, row) => sum + row.expensesToday, 0),
    groupProfitToday: rows.reduce((sum, row) => sum + row.profitToday, 0),
    groupActiveStaff: rows.reduce((sum, row) => sum + row.staffOnline, 0),
    groupComplaints: rows.reduce((sum, row) => sum + row.complaintsOpen, 0),
    groupActiveCalls: rows.reduce((sum, row) => sum + row.callsToday, 0),
    groupPayables: rows.reduce((sum, row) => sum + row.payables, 0),
    bestPerformingCompany: [...rows].sort((first, second) => second.performance - first.performance)[0]?.company.name ?? summary.bestPerformingCompany,
    weakestPerformingCompany: [...rows].sort((first, second) => first.performance - second.performance)[0]?.company.name ?? summary.weakestPerformingCompany
  }), [rows, summary.bestPerformingCompany, summary.weakestPerformingCompany]);
  const alerts = useMemo(() => getExecutiveAlerts(rows), [rows]);
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
            <h2 className="text-3xl font-black text-slate-950 sm:text-5xl">
              {companyFilter === "all" ? "All Companies" : rows[0]?.company.name ?? "Company"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-600">
              Control all companies from one dashboard.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select className="form-input min-w-60" onChange={(event) => setCompanyFilter(event.target.value)} value={companyFilter}>
              <option value="all">All Companies</option>
              {getCompanies().map((company) => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
            <button className="secondary-button" onClick={() => switchWorkspace(companyFilter)} type="button">
              Open Dashboard
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
        <Kpi icon={Building2} label="Total Companies" value={scopedSummary.totalCompanies.toLocaleString()} />
        <Kpi icon={TrendingUp} label="Group Sales Today" value={`${formatMoney(scopedSummary.groupSalesToday)} RWF`} />
        <Kpi icon={WalletCards} label="Group Cash Collected" value={`${formatMoney(scopedSummary.groupCashCollected)} RWF`} />
        <Kpi icon={WalletCards} label="Group Outstanding Debt" value={`${formatMoney(scopedSummary.groupOutstandingDebt)} RWF`} />
        <Kpi icon={ShoppingCart} label="Group Orders Today" value={scopedSummary.groupOrdersToday.toLocaleString()} />
        <Kpi icon={PackageCheck} label="Group Deliveries Today" value={scopedSummary.groupDeliveries.toLocaleString()} />
        <Kpi icon={Boxes} label="Group Inventory Value" value={`${formatMoney(scopedSummary.groupInventoryValue)} RWF`} />
        <Kpi icon={ReceiptText} label="Group Expenses Today" value={`${formatMoney(scopedSummary.groupExpensesToday)} RWF`} />
        <Kpi icon={TrendingUp} label="Group Profit Today" value={`${formatMoney(scopedSummary.groupProfitToday)} RWF`} />
        <Kpi icon={UserRound} label="Active Staff" value={scopedSummary.groupActiveStaff.toLocaleString()} />
        <Kpi icon={AlertTriangle} label="Open Complaints" value={scopedSummary.groupComplaints.toLocaleString()} />
        <Kpi icon={PhoneCall} label="Calls Today" value={scopedSummary.groupActiveCalls.toLocaleString()} />
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
              <Info label="Stock value" value={`${formatMoney(row.inventoryValue)} RWF`} />
              <Info label="Expenses" value={`${formatMoney(row.expensesToday)} RWF`} />
              <Info label="Profit estimate" value={`${formatMoney(row.profitToday)} RWF`} />
              <Info label="Calls today" value={row.callsToday.toLocaleString()} />
              <Info label="Complaints open" value={row.complaintsOpen.toLocaleString()} />
              <Info label="Staff online" value={row.staffOnline.toLocaleString()} />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button className="secondary-button !px-3 !py-2 !text-xs" onClick={() => switchWorkspace(row.company.id)} type="button">View Company</button>
              <button className="primary-button !px-3 !py-2 !text-xs" onClick={() => switchWorkspace(row.company.id)} type="button">Switch Workspace</button>
              <button className="secondary-button !px-3 !py-2 !text-xs" onClick={() => { switchExecutiveWorkspace(row.company.id); router.push("/reports"); }} type="button">View Reports</button>
              <button className="secondary-button !px-3 !py-2 !text-xs" onClick={() => { switchExecutiveWorkspace(row.company.id); router.push("/admin/users"); }} type="button">Manage Users</button>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="app-card p-5">
          <h3 className="text-lg font-black text-slate-950">Group Financial Snapshot</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Info label="Total Revenue" value={`${formatMoney(scopedSummary.groupSalesToday)} RWF`} />
            <Info label="Total Cash" value={`${formatMoney(scopedSummary.groupCashCollected)} RWF`} />
            <Info label="Total Receivables" value={`${formatMoney(scopedSummary.groupOutstandingDebt)} RWF`} />
            <Info label="Total Payables" value={`${formatMoney(scopedSummary.groupPayables)} RWF`} />
            <Info label="Total Expenses" value={`${formatMoney(scopedSummary.groupExpensesToday)} RWF`} />
            <Info label="Estimated Profit" value={`${formatMoney(scopedSummary.groupProfitToday)} RWF`} />
            <Info label="Best Performing Company" value={scopedSummary.bestPerformingCompany} />
            <Info label="Weakest Performing Company" value={scopedSummary.weakestPerformingCompany} />
          </div>
        </div>

        <div className="app-card p-5">
          <h3 className="text-lg font-black text-slate-950">Owner Action Center</h3>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              ["Add Company", "/admin/companies"],
              ["Add User", "/admin/users"],
              ["View All Reports", "/reports"],
              ["Open Customer Care & Relationship Management (CCRM)", "/call-center"],
              ["View Cash", "/cash"],
              ["View Inventory", "/inventory"],
              ["View Client Orders", "/client-orders"]
            ].map(([label, href]) => (
              <button className="secondary-button justify-center" key={href} onClick={() => router.push(href)} type="button">
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="app-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <h3 className="text-lg font-black text-slate-950">Operation Alerts</h3>
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          {alerts.slice(0, 8).map((alert) => (
            <article className={`rounded-lg border px-4 py-3 ${alert.severity === "High" ? "border-red-200 bg-red-50" : alert.severity === "Medium" ? "border-amber-200 bg-amber-50" : "border-brand-100 bg-brand-50"}`} key={`${alert.company}-${alert.issue}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-950">{alert.company}</p>
                  <p className="mt-1 text-sm font-bold text-slate-700">{alert.issue}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-600">{alert.action}</p>
                </div>
                <span className="status-badge border-white/70 bg-white text-slate-800">{alert.severity}</span>
              </div>
            </article>
          ))}
        </div>
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
            <option value="expensesToday">Sort by Expenses</option>
            <option value="profitToday">Sort by Profit</option>
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
                <th>Expenses</th>
                <th>Profit</th>
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
                  <td>{formatMoney(row.expensesToday)} RWF</td>
                  <td>{formatMoney(row.profitToday)} RWF</td>
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
