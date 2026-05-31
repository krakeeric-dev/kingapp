"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  ClipboardCheck,
  FileText,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  WalletCards
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { SessionUser, UserRole } from "@/lib/auth";
import { roleLabels } from "@/lib/auth";
import {
  formatDate,
  getLoadingRecords,
  getTodayIsoDate
} from "@/lib/loading-data";
import type { LoadingRecord } from "@/lib/loading-data";
import { formatMoney, getSalesRecords } from "@/lib/sales-data";
import type { SalesRecord } from "@/lib/sales-data";
import { getCashRecords } from "@/lib/cash-data";
import type { CashRecord } from "@/lib/cash-data";
import { getReturnRecords } from "@/lib/returns-data";
import type { ReturnRecord } from "@/lib/returns-data";
import { getExpenseRecords } from "@/lib/expenses-data";
import type { ExpenseRecord } from "@/lib/expenses-data";
import {
  getInventoryDashboardTotals,
  getInventoryMovements,
  getInventoryRows,
  getMinimumStocks
} from "@/lib/inventory-data";
import type { InventoryMovement, MinimumStock } from "@/lib/inventory-data";
import { getSyncSummary } from "@/lib/offline-sync";

type DashboardStat = {
  label: string;
  value: string;
  icon: typeof BarChart3;
  tone?: "success" | "danger" | "warning" | "neutral";
};

type Activity = {
  date: string;
  type: string;
  reference: string;
  user: string;
  status: string;
};

const roleSummaries: Record<UserRole, string> = {
  admin: "Executive overview of stock movement, cash performance, variances, and operational activity.",
  supervisor: "Review performance, variances, and correction priorities from one clean control room.",
  storekeeper: "Monitor loaded stock, warehouse position, returns, and items needing attention.",
  accountant: "Track cash collection, expenses, variances, and the closing cash position.",
  manager: "View executive-level sales, stock, cash, and marketer performance summaries.",
  marketer: "Review your confirmed loads, sales progress, and today’s activity."
};

export default function DashboardPage() {
  return <AppShell>{(user) => <DashboardContent user={user} />}</AppShell>;
}

function DashboardContent({ user }: { user: SessionUser }) {
  const [records, setRecords] = useState<LoadingRecord[]>([]);
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [cashRecords, setCashRecords] = useState<CashRecord[]>([]);
  const [returnRecords, setReturnRecords] = useState<ReturnRecord[]>([]);
  const [expenseRecords, setExpenseRecords] = useState<ExpenseRecord[]>([]);
  const [inventoryMovements, setInventoryMovements] = useState<
    InventoryMovement[]
  >([]);
  const [minimumStocks, setMinimumStocks] = useState<MinimumStock[]>([]);
  const [syncSummary, setSyncSummary] = useState({
    conflicts: 0,
    failed: 0,
    pending: 0
  });
  const [permissionMessage, setPermissionMessage] = useState("");

  useEffect(() => {
    setRecords(getLoadingRecords());
    setSalesRecords(getSalesRecords());
    setCashRecords(getCashRecords());
    setReturnRecords(getReturnRecords());
    setExpenseRecords(getExpenseRecords());
    setInventoryMovements(getInventoryMovements());
    setMinimumStocks(getMinimumStocks());
    void getSyncSummary().then((summary) =>
      setSyncSummary({
        conflicts: summary.conflicts,
        failed: summary.failed,
        pending: summary.pending
      })
    );
    const blockedMessage = window.sessionStorage.getItem(
      "kingapp.permissionMessage"
    );

    if (blockedMessage) {
      setPermissionMessage(blockedMessage);
      window.sessionStorage.removeItem("kingapp.permissionMessage");
    }
  }, []);

  const dashboard = useMemo(() => {
    const today = getTodayIsoDate();
    const roleRecords =
      user.role === "marketer"
        ? records.filter((record) => record.marketerUsername === user.username)
        : user.role === "storekeeper"
          ? records.filter((record) => record.storekeeperUsername === user.username)
          : records;
    const roleSalesRecords =
      user.role === "marketer"
        ? salesRecords.filter(
            (record) => record.marketerUsername === user.username
          )
        : salesRecords;

    const todayLoads = roleRecords.filter(
      (record) => record.date === today && record.status !== "draft"
    );
    const todaySales = roleSalesRecords.filter(
      (record) => record.date === today && record.status === "sales_submitted"
    );
    const todayCash = cashRecords.filter((record) => record.date === today);
    const todayReturns = returnRecords.filter((record) => record.date === today);
    const todayExpenses = expenseRecords.filter((record) => record.date === today);
    const inventoryRows = getInventoryRows({
      loadingRecords: records,
      manualMovements: inventoryMovements,
      minimumStocks,
      returnRecords
    });
    const inventoryTotals = getInventoryDashboardTotals(inventoryRows);

    const totalLoaded = todayLoads.reduce(
      (total, record) => total + record.loadedCartons,
      0
    );
    const totalSold = todaySales.reduce(
      (total, record) => total + record.soldCartons,
      0
    );
    const expectedReturns = todaySales.reduce(
      (total, record) => total + record.expectedReturnCartons,
      0
    );
    const actualReturns = todayReturns.reduce(
      (total, record) => total + record.actualReturnCartons,
      0
    );
    const salesValue = todaySales.reduce(
      (total, record) => total + record.salesValue,
      0
    );
    const expectedCash = todayCash.length
      ? todayCash.reduce((total, record) => total + record.expectedCash, 0)
      : salesValue;
    const cashReceived = todayCash.reduce(
      (total, record) => total + record.cashReceived,
      0
    );
    const totalExpenses = todayExpenses.reduce(
      (total, record) => total + record.totalExpenses,
      0
    );
    const closingBalance = todayExpenses.reduce(
      (total, record) => total + record.closingBalance,
      0
    );
    const stockVariance = expectedReturns - actualReturns;
    const cashVariance = cashReceived - expectedCash;
    const pending = roleRecords.filter((record) => record.status === "pending")
      .length;
    const rejected = roleRecords.filter((record) => record.status === "rejected")
      .length;
    const confirmed = roleRecords.filter((record) => record.status === "confirmed")
      .length;
    const syncStats: DashboardStat[] =
      user.role === "admin"
        ? [
            {
              label: "Pending Offline Sync",
              icon: RefreshCw,
              tone: syncSummary.pending > 0 ? "warning" : "success",
              value: syncSummary.pending.toLocaleString()
            },
            {
              label: "Failed Syncs",
              icon: AlertTriangle,
              tone: syncSummary.failed > 0 ? "danger" : "success",
              value: syncSummary.failed.toLocaleString()
            },
            {
              label: "Conflicts Needing Review",
              icon: ShieldCheck,
              tone: syncSummary.conflicts > 0 ? "danger" : "success",
              value: syncSummary.conflicts.toLocaleString()
            }
          ]
        : [];

    const stats: DashboardStat[] = [
      {
        label: "Loaded Today",
        icon: Boxes,
        value: totalLoaded.toLocaleString()
      },
      {
        label: "Sold Today",
        icon: FileText,
        value: totalSold.toLocaleString()
      },
      {
        label: "Sales Value",
        icon: TrendingUp,
        tone: "success",
        value: formatMoney(salesValue)
      },
      {
        label: "Cash Received",
        icon: WalletCards,
        tone: "success",
        value: formatMoney(cashReceived)
      },
      {
        label: "Cash Variance",
        icon: cashVariance < 0 ? TrendingDown : TrendingUp,
        tone: cashVariance < 0 ? "danger" : cashVariance > 0 ? "warning" : "success",
        value: formatMoney(cashVariance)
      },
      {
        label: "Warehouse Stock",
        icon: Boxes,
        value: inventoryTotals.totalWarehouseStock.toLocaleString()
      },
      ...syncStats
    ];

    const overviewDays = getLastSevenDays(today).map((date) => {
      const loaded = roleRecords
        .filter((record) => record.date === date && record.status !== "draft")
        .reduce((total, record) => total + record.loadedCartons, 0);
      const sold = roleSalesRecords
        .filter((record) => record.date === date)
        .reduce((total, record) => total + record.soldCartons, 0);
      const cash = cashRecords
        .filter((record) => record.date === date)
        .reduce((total, record) => total + record.cashReceived, 0);

      return { cash, date, loaded, sold };
    });

    const activities: Activity[] = [
      ...roleRecords.map((record) => ({
        date: record.updatedAt,
        type: "Loading",
        reference: record.id,
        user: record.marketerName,
        status: record.status
      })),
      ...roleSalesRecords.map((record) => ({
        date: record.updatedAt,
        type: "Sales",
        reference: record.id,
        user: record.marketerName,
        status: record.status
      })),
      ...cashRecords.map((record) => ({
        date: record.updatedAt,
        type: "Cash",
        reference: record.id,
        user: record.accountantName,
        status: record.status
      })),
      ...returnRecords.map((record) => ({
        date: record.updatedAt,
        type: "Returns",
        reference: record.id,
        user: record.storekeeperName,
        status: record.status
      })),
      ...expenseRecords.map((record) => ({
        date: record.updatedAt,
        type: "Expenses",
        reference: record.id,
        user: record.accountantName,
        status: record.status
      }))
    ]
      .sort((first, second) => second.date.localeCompare(first.date))
      .slice(0, 7);

    const marketerPerformance = Array.from(
      roleSalesRecords.reduce((map, record) => {
        const current = map.get(record.marketerName) ?? {
          marketer: record.marketerName,
          sold: 0,
          value: 0
        };

        current.sold += record.soldCartons;
        current.value += record.salesValue;
        map.set(record.marketerName, current);
        return map;
      }, new Map<string, { marketer: string; sold: number; value: number }>())
    )
      .map(([, value]) => value)
      .sort((first, second) => second.value - first.value)
      .slice(0, 5);

    const alerts = [
      {
        label: "Cash variance",
        value:
          cashVariance === 0
            ? "Balanced"
            : `${formatMoney(cashVariance)} RWF ${
                cashVariance < 0 ? "shortage" : "excess"
              }`,
        tone: cashVariance < 0 ? "danger" : cashVariance > 0 ? "warning" : "success"
      },
      {
        label: "Stock variance",
        value:
          stockVariance === 0
            ? "Balanced"
            : `${Math.abs(stockVariance).toLocaleString()} carton${
                Math.abs(stockVariance) === 1 ? "" : "s"
              } ${stockVariance > 0 ? "shortage" : "excess"}`,
        tone:
          stockVariance > 0 ? "danger" : stockVariance < 0 ? "warning" : "success"
      },
      {
        label: "Low stock items",
        value: inventoryTotals.lowStockItems.toLocaleString(),
        tone: inventoryTotals.lowStockItems > 0 ? "warning" : "success"
      },
      {
        label: "Out of stock items",
        value: inventoryTotals.outOfStockItems.toLocaleString(),
        tone: inventoryTotals.outOfStockItems > 0 ? "danger" : "success"
      },
      {
        label: "Rejected loads",
        value: rejected.toLocaleString(),
        tone: rejected > 0 ? "danger" : "success"
      }
    ] as const;

    return {
      activities,
      alerts,
      closingBalance,
      confirmed,
      expectedCash,
      expectedReturns,
      overviewDays,
      marketerPerformance,
      pending,
      rejected,
      stats,
      stockVariance,
      cashVariance,
      totalExpenses,
      totalLoaded,
      totalSold,
      actualReturns,
      cashReceived,
      salesValue
    };
  }, [
    cashRecords,
    expenseRecords,
    inventoryMovements,
    minimumStocks,
    records,
    returnRecords,
    salesRecords,
    syncSummary.conflicts,
    syncSummary.failed,
    syncSummary.pending,
    user.role,
    user.username
  ]);

  return (
    <div className="space-y-6">
      <div className="app-card-soft overflow-hidden p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-brand-700">
              {roleLabels[user.role]} Dashboard
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-4xl">
              Executive Overview
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {roleSummaries[user.role]}
            </p>
          </div>
          <div className="rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-bold text-brand-900">
            {user.displayName} - {user.username}
          </div>
        </div>
      </div>

      {permissionMessage ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          {permissionMessage}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {dashboard.stats.map((stat) => {
          const Icon = stat.icon;
          const toneClass = getStatToneClass(stat.tone);

          return (
            <article
              className="app-card p-5 transition hover:-translate-y-0.5 hover:shadow-soft"
              key={stat.label}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-500">{stat.label}</p>
                  <p className={`mt-3 text-3xl font-black ${toneClass.text}`}>
                    {stat.value}
                  </p>
                </div>
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${toneClass.icon}`}
                >
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
        <ExecutiveSection
          icon={BarChart3}
          subtitle="Last seven days"
          title="Stock & Cash Overview"
        >
          <StockCashOverview days={dashboard.overviewDays} />
        </ExecutiveSection>

        <ExecutiveSection
          icon={AlertTriangle}
          subtitle="Exception control"
          title="Variance Alerts"
        >
          <div className="grid gap-3">
            {dashboard.alerts.map((alert) => (
              <div
                className={`rounded-lg border px-4 py-3 ${getAlertClass(
                  alert.tone
                )}`}
                key={alert.label}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-bold">{alert.label}</span>
                  <span className="text-right text-sm font-black">
                    {alert.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ExecutiveSection>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <ExecutiveSection
          icon={ClipboardCheck}
          subtitle="Latest submitted and updated records"
          title="Recent Activities"
        >
          <RecentActivities activities={dashboard.activities} />
        </ExecutiveSection>

        <ExecutiveSection
          icon={TrendingUp}
          subtitle="Ranked by sales value"
          title="Marketer Performance"
        >
          <MarketerPerformance rows={dashboard.marketerPerformance} />
        </ExecutiveSection>
      </div>

      <ExecutiveSection
        icon={WalletCards}
        subtitle={formatDate(getTodayIsoDate())}
        title="Today's Closing Summary"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile label="Loaded" value={dashboard.totalLoaded} />
          <SummaryTile label="Sold" value={dashboard.totalSold} />
          <SummaryTile label="Expected Returns" value={dashboard.expectedReturns} />
          <SummaryTile label="Actual Returns" value={dashboard.actualReturns} />
          <SummaryTile
            label="Expected Cash"
            value={`${formatMoney(dashboard.expectedCash)} RWF`}
          />
          <SummaryTile
            label="Cash Received"
            value={`${formatMoney(dashboard.cashReceived)} RWF`}
          />
          <SummaryTile
            label="Total Expenses"
            value={`${formatMoney(dashboard.totalExpenses)} RWF`}
          />
          <SummaryTile
            label="Closing Balance"
            value={`${formatMoney(dashboard.closingBalance)} RWF`}
          />
          <SummaryTile label="Pending Confirmations" value={dashboard.pending} />
          <SummaryTile label="Confirmed Loads" value={dashboard.confirmed} />
          <SummaryTile label="Rejected Loads" value={dashboard.rejected} />
          <SummaryTile
            label="Stock Variance"
            value={dashboard.stockVariance.toLocaleString()}
          />
        </div>
      </ExecutiveSection>
    </div>
  );
}

function ExecutiveSection({
  children,
  icon: Icon,
  subtitle,
  title
}: {
  children: React.ReactNode;
  icon: typeof BarChart3;
  subtitle: string;
  title: string;
}) {
  return (
    <section className="app-card p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-slate-950">{title}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {children}
    </section>
  );
}

function StockCashOverview({
  days
}: {
  days: { cash: number; date: string; loaded: number; sold: number }[];
}) {
  const maxCartons = Math.max(
    1,
    ...days.map((day) => Math.max(day.loaded, day.sold))
  );
  const maxCash = Math.max(1, ...days.map((day) => day.cash));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-xs font-bold text-slate-500">
        <Legend color="bg-brand-700" label="Loaded" />
        <Legend color="bg-blue-600" label="Sold" />
        <Legend color="bg-emerald-400" label="Cash Received" />
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => (
          <div className="space-y-2" key={day.date}>
            <div className="flex h-40 items-end justify-center gap-1 rounded-lg border border-slate-100 bg-slate-50 px-2 py-3">
              <span
                className="w-3 rounded-t bg-brand-700"
                style={{ height: `${Math.max(4, (day.loaded / maxCartons) * 100)}%` }}
              />
              <span
                className="w-3 rounded-t bg-blue-600"
                style={{ height: `${Math.max(4, (day.sold / maxCartons) * 100)}%` }}
              />
              <span
                className="w-3 rounded-t bg-emerald-400"
                style={{ height: `${Math.max(4, (day.cash / maxCash) * 100)}%` }}
              />
            </div>
            <p className="text-center text-xs font-bold text-slate-500">
              {formatShortDate(day.date)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentActivities({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm font-semibold text-slate-500">
        No recent activity yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Reference</th>
            <th>User</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((activity) => (
            <tr key={`${activity.type}-${activity.reference}`}>
              <td>{formatDateTimeShort(activity.date)}</td>
              <td className="font-bold text-slate-950">{activity.type}</td>
              <td className="text-slate-600">{activity.reference}</td>
              <td className="text-slate-600">{activity.user}</td>
              <td>
                <span className="status-badge border-brand-100 bg-brand-50 text-brand-800">
                  {activity.status.replace(/_/g, " ")}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarketerPerformance({
  rows
}: {
  rows: { marketer: string; sold: number; value: number }[];
}) {
  const maxValue = Math.max(1, ...rows.map((row) => row.value));

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm font-semibold text-slate-500">
        No marketer sales submitted yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((row, index) => (
        <div key={row.marketer}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-slate-950">
                {index + 1}. {row.marketer}
              </p>
              <p className="text-xs font-semibold text-slate-500">
                {row.sold.toLocaleString()} cartons sold
              </p>
            </div>
            <p className="text-sm font-black text-brand-800">
              {formatMoney(row.value)}
            </p>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-brand-700"
              style={{ width: `${Math.max(6, (row.value / maxValue) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function SummaryTile({
  label,
  value
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-normal text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function getStatToneClass(tone: DashboardStat["tone"] = "neutral") {
  if (tone === "danger") {
    return {
      icon: "bg-red-50 text-red-700",
      text: "text-red-700"
    };
  }

  if (tone === "warning") {
    return {
      icon: "bg-amber-50 text-amber-700",
      text: "text-amber-700"
    };
  }

  if (tone === "success") {
    return {
      icon: "bg-emerald-50 text-emerald-700",
      text: "text-emerald-700"
    };
  }

  return {
    icon: "bg-brand-50 text-brand-700",
    text: "text-brand-800"
  };
}

function getAlertClass(tone: "success" | "danger" | "warning") {
  if (tone === "danger") {
    return "border-red-200 bg-red-50 text-red-800";
  }

  if (tone === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function getLastSevenDays(today: string) {
  const current = new Date(`${today}T00:00:00`);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(current);
    date.setDate(current.getDate() - (6 - index));
    return date.toISOString().slice(0, 10);
  });
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short"
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateTimeShort(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
