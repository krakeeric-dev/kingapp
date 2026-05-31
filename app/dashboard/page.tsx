"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  BadgeDollarSign,
  Boxes,
  ClipboardCheck,
  FileText,
  PackageCheck,
  ReceiptText,
  ScrollText,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  WalletCards
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { SessionUser, UserRole } from "@/lib/auth";
import { roleLabels } from "@/lib/auth";
import { getLoadingRecords, getTodayIsoDate } from "@/lib/loading-data";
import type { LoadingRecord } from "@/lib/loading-data";
import {
  formatMoney,
  getSalesDashboardTotals,
  getSalesRecords
} from "@/lib/sales-data";
import type { SalesRecord } from "@/lib/sales-data";
import { getCashDashboardTotals, getCashRecords } from "@/lib/cash-data";
import type { CashRecord } from "@/lib/cash-data";
import {
  getReturnRecords,
  getReturnsDashboardTotals
} from "@/lib/returns-data";
import type { ReturnRecord } from "@/lib/returns-data";
import {
  getExpenseRecords,
  getExpensesDashboardTotals
} from "@/lib/expenses-data";
import type { ExpenseRecord } from "@/lib/expenses-data";
import {
  getInventoryDashboardTotals,
  getInventoryMovements,
  getInventoryRows,
  getMinimumStocks
} from "@/lib/inventory-data";
import type { InventoryMovement, MinimumStock } from "@/lib/inventory-data";

type DashboardModule = {
  title: string;
  description: string;
  href: string;
  icon: typeof BarChart3;
  roles: UserRole[];
};

type DashboardStat = {
  label: string;
  value: string;
  icon: typeof BarChart3;
  tone?: "success" | "danger" | "warning" | "neutral";
};

const modules: DashboardModule[] = [
  {
    title: "Loading",
    description: "Create and review beverage loading records.",
    href: "/loading",
    icon: Boxes,
    roles: ["admin", "storekeeper"]
  },
  {
    title: "Inventory",
    description: "Track warehouse stock, receipts, returns, and alerts.",
    href: "/inventory",
    icon: Boxes,
    roles: ["admin", "storekeeper", "supervisor", "manager"]
  },
  {
    title: "Price Management",
    description: "Update product prices and review price history.",
    href: "/price-management",
    icon: BadgeDollarSign,
    roles: ["admin"]
  },
  {
    title: "Confirm Loading",
    description: "Confirm marketer stock before sales begin.",
    href: "/confirm-loading",
    icon: ClipboardCheck,
    roles: ["admin", "marketer"]
  },
  {
    title: "Sales & Returns",
    description: "Record sold cartons and monitor expected returns.",
    href: "/sales",
    icon: FileText,
    roles: ["admin", "marketer"]
  },
  {
    title: "Cash Collection",
    description: "Track expected cash, received cash, and variances.",
    href: "/cash",
    icon: WalletCards,
    roles: ["admin", "accountant"]
  },
  {
    title: "Expenses & Closing",
    description: "Track daily expenses and closing cash balance.",
    href: "/expenses",
    icon: ReceiptText,
    roles: ["admin", "accountant"]
  },
  {
    title: "Returns Receiving",
    description: "Receive physical returns and control stock variance.",
    href: "/returns",
    icon: PackageCheck,
    roles: ["admin", "storekeeper"]
  },
  {
    title: "Reports",
    description: "View daily, weekly, and monthly business reports.",
    href: "/reports",
    icon: BarChart3,
    roles: ["admin", "supervisor", "manager"]
  },
  {
    title: "Daily Report",
    description: "Print or export the end-of-day closing report.",
    href: "/daily-report",
    icon: ScrollText,
    roles: ["admin", "supervisor", "manager"]
  },
  {
    title: "Audit Log",
    description: "Review admin unlock actions and reasons.",
    href: "/admin/audit-log",
    icon: ShieldCheck,
    roles: ["admin"]
  }
];

const roleSummaries: Record<UserRole, string> = {
  admin: "Full access to loading records, marketer confirmations, unlocks, and audit activity.",
  supervisor: "Review reports and approve correction workflows.",
  storekeeper: "Create stock loading records and receive rejected corrections.",
  accountant: "Record cash received and monitor cash collection status.",
  manager: "View business dashboards and performance reports.",
  marketer: "Confirm assigned loading records or reject incorrect quantities."
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

  useEffect(() => {
    setRecords(getLoadingRecords());
    setSalesRecords(getSalesRecords());
    setCashRecords(getCashRecords());
    setReturnRecords(getReturnRecords());
    setExpenseRecords(getExpenseRecords());
    setInventoryMovements(getInventoryMovements());
    setMinimumStocks(getMinimumStocks());
  }, []);

  const visibleModules = useMemo(() => {
    return modules.filter((module) => module.roles.includes(user.role));
  }, [user.role]);

  const stats = useMemo(() => {
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
    const salesTotals = getSalesDashboardTotals(roleSalesRecords);
    const cashTotals = getCashDashboardTotals(cashRecords);
    const returnTotals = getReturnsDashboardTotals(returnRecords);
    const expenseTotals = getExpensesDashboardTotals(expenseRecords);
    const inventoryTotals = getInventoryDashboardTotals(
      getInventoryRows({
        loadingRecords: records,
        manualMovements: inventoryMovements,
        minimumStocks,
        returnRecords
      })
    );

    const cashVarianceTone =
      cashTotals.cashVarianceToday < 0
        ? "danger"
        : cashTotals.cashVarianceToday > 0
          ? "warning"
          : "success";
    const stockVarianceTone =
      returnTotals.stockVarianceToday > 0
        ? "danger"
        : returnTotals.stockVarianceToday < 0
          ? "warning"
          : "success";

    return [
      {
        label: "Total Loaded Today",
        icon: Boxes,
        value: roleRecords
          .filter((record) => record.date === today && record.status !== "draft")
          .reduce((total, record) => total + record.loadedCartons, 0)
          .toLocaleString()
      },
      {
        label: "Pending Confirmations",
        icon: ClipboardCheck,
        tone: "warning" as const,
        value: roleRecords
          .filter((record) => record.status === "pending")
          .length.toLocaleString()
      },
      {
        label: "Confirmed Loads",
        icon: ShieldCheck,
        tone: "success" as const,
        value: roleRecords
          .filter((record) => record.status === "confirmed")
          .length.toLocaleString()
      },
      {
        label: "Rejected Loads",
        icon: TrendingDown,
        tone: "danger" as const,
        value: roleRecords
          .filter((record) => record.status === "rejected")
          .length.toLocaleString()
      },
      {
        label: "Total Sold Today",
        icon: FileText,
        value: salesTotals.totalSoldToday.toLocaleString()
      },
      {
        label: "Expected Returns Today",
        icon: PackageCheck,
        value: salesTotals.expectedReturnsToday.toLocaleString()
      },
      {
        label: "Total Sales Value",
        icon: TrendingUp,
        tone: "success" as const,
        value: formatMoney(salesTotals.totalSalesValue)
      },
      {
        label: "Cash Received Today",
        icon: WalletCards,
        tone: "success" as const,
        value: formatMoney(cashTotals.cashReceivedToday)
      },
      {
        label: "Cash Variance Today",
        icon: cashVarianceTone === "danger" ? TrendingDown : TrendingUp,
        tone: cashVarianceTone,
        value: formatMoney(cashTotals.cashVarianceToday)
      },
      {
        label: "Returns Received Today",
        icon: PackageCheck,
        value: returnTotals.returnsReceivedToday.toLocaleString()
      },
      {
        label: "Stock Variance Today",
        icon: stockVarianceTone === "danger" ? TrendingDown : TrendingUp,
        tone: stockVarianceTone,
        value: returnTotals.stockVarianceToday.toLocaleString()
      },
      {
        label: "Total Expenses Today",
        icon: ReceiptText,
        value: formatMoney(expenseTotals.totalExpensesToday)
      },
      {
        label: "Closing Cash Balance Today",
        icon: WalletCards,
        tone: "success" as const,
        value: formatMoney(expenseTotals.closingCashBalanceToday)
      },
      {
        label: "Total Warehouse Stock",
        icon: Boxes,
        value: inventoryTotals.totalWarehouseStock.toLocaleString()
      },
      {
        label: "Low Stock Items",
        icon: TrendingDown,
        tone: inventoryTotals.lowStockItems > 0 ? ("warning" as const) : ("success" as const),
        value: inventoryTotals.lowStockItems.toLocaleString()
      },
      {
        label: "Out of Stock Items",
        icon: TrendingDown,
        tone: inventoryTotals.outOfStockItems > 0 ? ("danger" as const) : ("success" as const),
        value: inventoryTotals.outOfStockItems.toLocaleString()
      }
    ] satisfies DashboardStat[];
  }, [
    cashRecords,
    expenseRecords,
    inventoryMovements,
    minimumStocks,
    records,
    returnRecords,
    salesRecords,
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
              Welcome, {user.displayName}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {roleSummaries[user.role]}
            </p>
          </div>
          <div className="rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-bold text-brand-900">
            Signed in as {user.username}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const toneClass = getStatToneClass(stat.tone);

          return (
          <article
            className="app-card group p-5 transition hover:-translate-y-0.5 hover:shadow-soft"
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleModules.map((module) => {
          const Icon = module.icon;

          return (
            <Link
              className="app-card p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft"
              href={module.href}
              key={module.title}
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-950">
                {module.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {module.description}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
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
