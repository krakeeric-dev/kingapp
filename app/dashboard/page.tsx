"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  FileText,
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
import {
  getCallbacks,
  getCallLogs,
  getComplaints,
  getMissedCalls,
  getPendingOrders
} from "@/lib/call-center-data";
import type {
  CallbackItem,
  CallLog,
  ComplaintRecord,
  MissedCall,
  PendingOrder
} from "@/lib/call-center-data";
import { filterCompanyRecords } from "@/lib/companies-data";

type DashboardStat = {
  label: string;
  value: string;
  icon: typeof BarChart3;
  tone?: "success" | "danger" | "warning" | "neutral";
  trend?: string;
};

type Activity = {
  date: string;
  type: string;
  reference: string;
  user: string;
  status: string;
};

type DashboardTab =
  | "Overall"
  | "By Date"
  | "By Product"
  | "By Marketer"
  | "By Region"
  | "Cash Collection"
  | "Returns"
  | "Damages"
  | "Loading"
  | "Inventory"
  | "Raw Materials";

type KpiMetric = {
  label: string;
  tone: "blue" | "green" | "amber" | "red" | "purple" | "slate";
  value: string;
};

type StorePlanningMetric = KpiMetric & {
  helper: string;
};

type OperationalTableRow = {
  cashReceived: number;
  confirmed: number;
  damaged: number;
  date: string;
  difference: number;
  expectedCash: number;
  loaded: number;
  marketer: string;
  product: string;
  region: string;
  returned: number;
  revenue: number;
  sold: number;
  status: string;
};

type CallCenterReportRow = {
  complaints: number;
  date: string;
  followUpsPending: number;
  missedCalls: number;
  ordersRequested: number;
  totalCalls: number;
};

const dashboardTabs: DashboardTab[] = [
  "Overall",
  "By Date",
  "By Product",
  "By Marketer",
  "By Region",
  "Cash Collection",
  "Returns",
  "Damages"
];

const storekeeperDashboardTabs: DashboardTab[] = [
  "Overall",
  "Loading",
  "Inventory",
  "Returns",
  "Damages",
  "Raw Materials"
];

const _roleSummaries: Partial<Record<UserRole, string>> = {
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
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [missedCalls, setMissedCalls] = useState<MissedCall[]>([]);
  const [callbacks, setCallbacks] = useState<CallbackItem[]>([]);
  const [syncSummary, setSyncSummary] = useState({
    conflicts: 0,
    failed: 0,
    pending: 0
  });
  const [selectedDate, setSelectedDate] = useState(getTodayIsoDate());
  const [permissionMessage, setPermissionMessage] = useState("");
  const [activeTab, setActiveTab] = useState<DashboardTab>("Overall");

  function loadDashboardData() {
    setRecords(getLoadingRecords());
    setSalesRecords(getSalesRecords());
    setCashRecords(getCashRecords());
    setReturnRecords(getReturnRecords());
    setExpenseRecords(getExpenseRecords());
    setInventoryMovements(getInventoryMovements());
    setMinimumStocks(getMinimumStocks());
    setComplaints(getComplaints());
    setCallLogs(getCallLogs());
    setPendingOrders(getPendingOrders());
    setMissedCalls(getMissedCalls());
    setCallbacks(getCallbacks());
    void getSyncSummary().then((summary) =>
      setSyncSummary({
        conflicts: summary.conflicts,
        failed: summary.failed,
        pending: summary.pending
      })
    );
  }

  useEffect(() => {
    loadDashboardData();
    const blockedMessage = window.sessionStorage.getItem(
      "kingapp.permissionMessage"
    );

    if (blockedMessage) {
      setPermissionMessage(blockedMessage);
      window.sessionStorage.removeItem("kingapp.permissionMessage");
    }

    window.addEventListener("kingapp:data-synced", loadDashboardData);

    return () => {
      window.removeEventListener("kingapp:data-synced", loadDashboardData);
    };
  }, []);

  const dashboard = useMemo(() => {
    const companyRecords = filterCompanyRecords(records, user);
    const companySalesRecords = filterCompanyRecords(salesRecords, user);
    const companyCashRecords = filterCompanyRecords(cashRecords, user);
    const companyReturnRecords = filterCompanyRecords(returnRecords, user);
    const companyExpenseRecords = filterCompanyRecords(expenseRecords, user);
    const companyComplaints = filterCompanyRecords(complaints, user);

    const roleRecords =
      user.role === "marketer"
        ? companyRecords.filter((record) => record.marketerUsername === user.username)
        : user.role === "storekeeper"
          ? companyRecords.filter((record) => record.storekeeperUsername === user.username)
          : companyRecords;
    const roleSalesRecords =
      user.role === "marketer"
        ? companySalesRecords.filter(
            (record) => record.marketerUsername === user.username
          )
        : companySalesRecords;
    const roleCashRecords =
      user.role === "marketer"
        ? companyCashRecords.filter((record) => record.marketerUsername === user.username)
        : companyCashRecords;
    const roleReturnRecords =
      user.role === "marketer"
        ? companyReturnRecords.filter(
            (record) => record.marketerUsername === user.username
          )
        : companyReturnRecords;
    const roleExpenseRecords =
      user.role === "marketer"
        ? companyExpenseRecords.filter(
            (record) => record.marketerUsername === user.username
          )
        : companyExpenseRecords;

    const todayLoads = roleRecords.filter(
      (record) => record.date === selectedDate && record.status !== "draft"
    );
    const todaySales = roleSalesRecords.filter(
      (record) =>
        record.date === selectedDate && record.status === "sales_submitted"
    );
    const todayCash = roleCashRecords.filter(
      (record) => record.date === selectedDate
    );
    const todayReturns = roleReturnRecords.filter(
      (record) => record.date === selectedDate
    );
    const todayExpenses = roleExpenseRecords.filter(
      (record) => record.date === selectedDate
    );
    const inventoryRows = getInventoryRows({
      loadingRecords: roleRecords,
      manualMovements: inventoryMovements,
      minimumStocks,
      returnRecords: roleReturnRecords
    });
    const inventoryTotals = getInventoryDashboardTotals(inventoryRows);

    const totalLoaded = todayLoads.reduce(
      (total, record) => total + record.loadedCartons,
      0
    );
    const totalSold = todaySales.reduce(
      (total, record) => total + getSalesSoldCartons(record),
      0
    );
    const expectedReturns = todaySales.reduce(
      (total, record) =>
        total + (record.loadedCartons - getSalesSoldCartons(record)),
      0
    );
    const actualReturns = todayReturns.reduce(
      (total, record) => total + record.actualReturnCartons,
      0
    );
    const salesValue = todaySales.reduce(
      (total, record) => total + getSalesValue(record),
      0
    );
    const expectedCash = salesValue;
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
    const openComplaints = companyComplaints.filter(
      (record) => record.status !== "Closed"
    ).length;
    const todayCallLogs = callLogs.filter((record) => record.date === selectedDate);
    const todayComplaints = companyComplaints.filter((record) =>
      getDatePart(record.createdAt) === selectedDate
    );
    const todayOrdersRequested = pendingOrders.filter((record) =>
      getDatePart(record.createdAt) === selectedDate
    );
    const todayMissedCalls = missedCalls.filter((record) => record.date === selectedDate);
    const todayCallbacks = callbacks.filter(
      (record) => record.callbackDate === selectedDate && record.status === "Pending"
    );
    const managerCallCenterReport = getLastSevenDays(selectedDate).map((date) => ({
      complaints: companyComplaints.filter((record) => getDatePart(record.createdAt) === date).length,
      date,
      followUpsPending: callbacks.filter(
        (record) => record.callbackDate === date && record.status === "Pending"
      ).length,
      missedCalls: missedCalls.filter((record) => record.date === date).length,
      ordersRequested: pendingOrders.filter((record) => getDatePart(record.createdAt) === date).length,
      totalCalls: callLogs.filter((record) => record.date === date).length
    }));
    const managerCallCenterSummary = {
      complaintsReceived: todayComplaints.length,
      customersWhoPressedOrder: todayOrdersRequested.length,
      followUpsPending: todayCallbacks.length,
      missedCalls: todayMissedCalls.length,
      totalCallsToday: todayCallLogs.length
    };
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
        trend: "Distribution volume",
        value: totalLoaded.toLocaleString()
      },
      {
        label: "Sold Today",
        icon: FileText,
        trend: "Cartons sold",
        value: totalSold.toLocaleString()
      },
      {
        label: "Sales Value",
        icon: TrendingUp,
        tone: "success",
        trend: "Revenue booked",
        value: formatMoney(salesValue)
      },
      {
        label: "Cash Received",
        icon: WalletCards,
        tone: "success",
        trend: "Cash collected",
        value: formatMoney(cashReceived)
      },
      {
        label: "Cash Variance",
        icon: cashVariance < 0 ? TrendingDown : TrendingUp,
        tone: cashVariance < 0 ? "danger" : cashVariance > 0 ? "warning" : "success",
        trend: cashVariance < 0 ? "Needs attention" : "Controlled",
        value: formatMoney(cashVariance)
      },
      {
        label: "Warehouse Stock",
        icon: Boxes,
        trend: "Closing stock",
        value: inventoryTotals.totalWarehouseStock.toLocaleString()
      },
      ...syncStats
    ];

    const overviewDays = getLastSevenDays(selectedDate).map((date) => {
      const loaded = roleRecords
        .filter((record) => record.date === date && record.status !== "draft")
        .reduce((total, record) => total + record.loadedCartons, 0);
      const sold = roleSalesRecords
        .filter(
          (record) => record.date === date && record.status === "sales_submitted"
        )
        .reduce((total, record) => total + getSalesSoldCartons(record), 0);
      const cash = roleCashRecords
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

        current.sold += getSalesSoldCartons(record);
        current.value += getSalesValue(record);
        map.set(record.marketerName, current);
        return map;
      }, new Map<string, { marketer: string; sold: number; value: number }>())
    )
      .map(([, value]) => value)
      .sort((first, second) => second.value - first.value)
      .slice(0, 5);

    const totalProfit = Math.max(0, salesValue - totalExpenses);
    const outstandingCash = Math.max(0, expectedCash - cashReceived);
    const collectionRate = expectedCash > 0 ? Math.round((cashReceived / expectedCash) * 100) : 0;
    const damages = todayReturns.reduce(
      (total, record) => total + Math.max(0, Number(record.stockVariance) || 0),
      0
    );
    const marketerKpiMetrics: KpiMetric[] = [
      { label: "Cartons Loaded", tone: "slate", value: totalLoaded.toLocaleString() },
      { label: "Cartons Sold", tone: "blue", value: totalSold.toLocaleString() },
      { label: "Returns", tone: "amber", value: actualReturns.toLocaleString() },
      { label: "Damages", tone: damages > 0 ? "red" : "green", value: damages.toLocaleString() },
      { label: "Cash Expected", tone: "purple", value: `${formatMoney(expectedCash)} RWF` },
      { label: "Cash Given", tone: "green", value: `${formatMoney(cashReceived)} RWF` },
      { label: "Outstanding Cash", tone: outstandingCash > 0 ? "red" : "green", value: `${formatMoney(outstandingCash)} RWF` },
      { label: "Collection Rate", tone: collectionRate >= 95 ? "green" : collectionRate >= 70 ? "amber" : "red", value: `${collectionRate}%` }
    ];
    const rawMaterialMovements = inventoryMovements.filter((movement) =>
      `${movement.productName} ${movement.itemCode} ${movement.notes ?? ""}`
        .toLowerCase()
        .includes("raw")
    );
    const rawMaterialsAvailable = rawMaterialMovements.reduce(
      (total, movement) => total + movement.quantity,
      0
    );
    const rawMaterialsUsed = rawMaterialMovements
      .filter((movement) => movement.quantity < 0)
      .reduce((total, movement) => total + Math.abs(movement.quantity), 0);
    const storekeeperKpiMetrics: KpiMetric[] = [
      { label: "Available Stock", tone: "green", value: inventoryTotals.totalWarehouseStock.toLocaleString() },
      { label: "Cartons Loaded", tone: "blue", value: totalLoaded.toLocaleString() },
      { label: "Stock Returned", tone: "amber", value: actualReturns.toLocaleString() },
      { label: "Damages", tone: damages > 0 ? "red" : "green", value: damages.toLocaleString() },
      { label: "Raw Materials Available", tone: "slate", value: Math.max(0, rawMaterialsAvailable).toLocaleString() },
      { label: "Raw Materials Used", tone: "purple", value: rawMaterialsUsed.toLocaleString() },
      { label: "Low Stock Alerts", tone: inventoryTotals.lowStockItems > 0 ? "amber" : "green", value: inventoryTotals.lowStockItems.toLocaleString() },
      { label: "Pending Confirmations", tone: pending > 0 ? "amber" : "green", value: pending.toLocaleString() }
    ];
    const executiveKpiMetrics: KpiMetric[] = [
      { label: "Total Revenue", tone: "blue", value: `${formatMoney(salesValue)} RWF` },
      { label: "Total Profit", tone: "green", value: `${formatMoney(totalProfit)} RWF` },
      ...marketerKpiMetrics.map((metric) =>
        metric.label === "Cash Given" ? { ...metric, label: "Cash Received" } : metric
      )
    ];
    const kpiMetrics =
      user.role === "storekeeper"
        ? storekeeperKpiMetrics
        : user.role === "marketer"
          ? marketerKpiMetrics
          : executiveKpiMetrics;

    const revenueProfit = overviewDays.map((day) => {
      const dayExpenses = roleExpenseRecords
        .filter((record) => record.date === day.date)
        .reduce((total, record) => total + record.totalExpenses, 0);
      return {
        date: day.date,
        profit: Math.max(0, day.cash - dayExpenses),
        revenue: day.cash
      };
    });
    const cashComparison = overviewDays.map((day) => {
      const expected = roleSalesRecords
        .filter((record) => record.date === day.date && record.status === "sales_submitted")
        .reduce((total, record) => total + getSalesValue(record), 0);
      return { cash: day.cash, date: day.date, expected };
    });
    const productDistribution = Array.from(
      todaySales.reduce((map, record) => {
        const current = map.get(record.productName) ?? 0;
        map.set(record.productName, current + getSalesValue(record));
        return map;
      }, new Map<string, number>())
    )
      .map(([label, value]) => ({ label, value }))
      .sort((first, second) => second.value - first.value);
    const loadedSoldReturned = overviewDays.map((day) => {
      const returned = roleReturnRecords
        .filter((record) => record.date === day.date)
        .reduce((total, record) => total + record.actualReturnCartons, 0);
      return { ...day, returned };
    });
    const stockInOut = overviewDays.map((day) => {
      const stockIn =
        inventoryMovements
          .filter((movement) => movement.date === day.date && movement.movementType === "Stock Received")
          .reduce((total, movement) => total + movement.quantity, 0) +
        roleReturnRecords
          .filter((record) => record.date === day.date)
          .reduce((total, record) => total + record.actualReturnCartons, 0);
      const stockOut = roleRecords
        .filter((record) => record.date === day.date && record.status !== "draft")
        .reduce((total, record) => total + record.loadedCartons, 0);

      return { date: day.date, stockIn, stockOut };
    });
    const loadedByMarketer = Array.from(
      todayLoads.reduce((map, record) => {
        const current = map.get(record.marketerName) ?? {
          marketer: record.marketerName,
          sold: 0,
          value: 0
        };
        current.sold += record.loadedCartons;
        current.value += record.loadedCartons;
        map.set(record.marketerName, current);
        return map;
      }, new Map<string, { marketer: string; sold: number; value: number }>())
    ).map(([, value]) => value);
    const returnsByDay = loadedSoldReturned.map((day) => ({
      date: day.date,
      returned: day.returned
    }));
    const damagesByDay = overviewDays.map((day) => ({
      date: day.date,
      damaged: roleReturnRecords
        .filter((record) => record.date === day.date)
        .reduce((total, record) => total + Math.max(0, record.stockVariance), 0)
    }));
    const rawMaterialsUsage = overviewDays.map((day) => ({
      date: day.date,
      used: rawMaterialMovements
        .filter((movement) => movement.date === day.date && movement.quantity < 0)
        .reduce((total, movement) => total + Math.abs(movement.quantity), 0)
    }));
    const todayStockMovement = stockInOut.find((day) => day.date === selectedDate) ?? {
      date: selectedDate,
      stockIn: 0,
      stockOut: 0
    };
    const reorderNeeded = inventoryRows.filter((row) => row.stockStatus !== "Available").length;
    const averageDailySales =
      overviewDays.length > 0
        ? overviewDays.reduce((total, day) => total + day.sold, 0) / overviewDays.length
        : 0;
    const daysOfStockRemaining =
      averageDailySales > 0
        ? Math.floor(inventoryTotals.totalWarehouseStock / averageDailySales)
        : inventoryTotals.totalWarehouseStock > 0
          ? 999
          : 0;
    const storePlanning: StorePlanningMetric[] = [
      {
        helper: "Finished goods ready for loading",
        label: "Finished Goods Stock",
        tone: "green",
        value: inventoryTotals.totalWarehouseStock.toLocaleString()
      },
      {
        helper: "Raw materials identified in stock movements",
        label: "Raw Materials Stock",
        tone: "slate",
        value: Math.max(0, rawMaterialsAvailable).toLocaleString()
      },
      {
        helper: "Factory receipts and actual returns today",
        label: "Stock In",
        tone: "blue",
        value: todayStockMovement.stockIn.toLocaleString()
      },
      {
        helper: "Cartons loaded out today",
        label: "Stock Out",
        tone: "amber",
        value: todayStockMovement.stockOut.toLocaleString()
      },
      {
        helper: "Total cartons assigned to marketers",
        label: "Cartons Loaded",
        tone: "blue",
        value: totalLoaded.toLocaleString()
      },
      {
        helper: "Actual stock returned to store",
        label: "Returns",
        tone: "amber",
        value: actualReturns.toLocaleString()
      },
      {
        helper: "Shortage or damaged cartons recorded",
        label: "Damages",
        tone: damages > 0 ? "red" : "green",
        value: damages.toLocaleString()
      },
      {
        helper: "Products below minimum stock",
        label: "Low Stock Alerts",
        tone: inventoryTotals.lowStockItems > 0 ? "red" : "green",
        value: inventoryTotals.lowStockItems.toLocaleString()
      },
      {
        helper: "Products needing replenishment",
        label: "Reorder Needed",
        tone: reorderNeeded > 0 ? "amber" : "green",
        value: reorderNeeded.toLocaleString()
      },
      {
        helper: "Based on recent seven-day sales pace",
        label: "Days of Stock Remaining",
        tone: daysOfStockRemaining <= 3 ? "red" : daysOfStockRemaining <= 7 ? "amber" : "green",
        value: daysOfStockRemaining >= 999 ? "Stable" : daysOfStockRemaining.toLocaleString()
      }
    ];
    const salesByLoad = new Map(todaySales.map((record) => [record.loadingRecordId, record]));
    const cashBySale = new Map(todayCash.map((record) => [record.salesRecordId, record]));
    const returnsBySale = new Map(todayReturns.map((record) => [record.salesRecordId, record]));
    const operationRows: OperationalTableRow[] = todayLoads.map((record) => {
      const sale = salesByLoad.get(record.id);
      const cash = sale ? cashBySale.get(sale.id) : undefined;
      const returnRecord = sale ? returnsBySale.get(sale.id) : undefined;
      const sold = sale ? getSalesSoldCartons(sale) : 0;
      const revenue = sale ? getSalesValue(sale) : 0;
      const expected = sale ? getSalesValue(sale) : 0;
      const received = cash?.cashReceived ?? 0;
      const returned = returnRecord?.actualReturnCartons ?? 0;
      const damaged = Math.max(0, returnRecord?.stockVariance ?? 0);

      return {
        cashReceived: received,
        confirmed: record.status === "confirmed" || !!sale ? record.loadedCartons : 0,
        damaged,
        date: record.date,
        difference: received - expected,
        expectedCash: expected,
        loaded: record.loadedCartons,
        marketer: record.marketerName,
        product: record.productName,
        region: (record as { companyName?: string }).companyName ?? user.companyName ?? "Main Region",
        returned,
        revenue,
        sold,
        status: cash?.status ?? sale?.status ?? record.status
      };
    });

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
      },
      {
        label: "Open complaints",
        value: openComplaints.toLocaleString(),
        tone: openComplaints > 0 ? "warning" : "success"
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
      managerCallCenterReport,
      managerCallCenterSummary,
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
      cashComparison,
      collectionRate,
      damages,
      kpiMetrics,
      loadedByMarketer,
      loadedSoldReturned,
      operationRows,
      productDistribution,
      rawMaterialsUsage,
      revenueProfit,
      returnsByDay,
      salesValue,
      storePlanning,
      stockInOut,
      damagesByDay,
      totalProfit
    };
  }, [
    cashRecords,
    callbacks,
    callLogs,
    complaints,
    expenseRecords,
    inventoryMovements,
    missedCalls,
    minimumStocks,
    pendingOrders,
    records,
    returnRecords,
    salesRecords,
    selectedDate,
    syncSummary.conflicts,
    syncSummary.failed,
    syncSummary.pending,
    user.role,
    user.username
  ]);

  const isMarketerDashboard = user.role === "marketer";
  const isStorekeeperDashboard = user.role === "storekeeper";
  const canViewStorePlanning = user.role === "admin" || user.role === "manager";
  const visibleDashboardTabs = isStorekeeperDashboard
    ? storekeeperDashboardTabs
    : dashboardTabs;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-[0_16px_45px_rgba(15,35,80,0.07)] sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-blue-700">
              {roleLabels[user.role]} Dashboard
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">
              {isMarketerDashboard
                ? "Field Salesperson Dashboard"
                : "Regional Sales Management Dashboard"}
            </h2>
            <p className="mt-1 max-w-4xl text-sm font-semibold text-slate-500">
              {isMarketerDashboard
                ? "Your assigned loads, confirmed sales, returns, cash given, and collection progress."
                : "Beverage distribution, outsourcing operations, call center follow-up, stock movement, and cash collection control."}
            </p>
          </div>
          <label className="block w-full max-w-xs">
            <span className="mb-1 block text-xs font-black uppercase text-slate-500">Dashboard Date</span>
            <input
              className="form-input"
              onChange={(event) => setSelectedDate(event.target.value)}
              type="date"
              value={selectedDate}
            />
          </label>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {visibleDashboardTabs.map((tab) => (
            <button
              className={`shrink-0 rounded-lg border px-3.5 py-2 text-xs font-black transition ${
                activeTab === tab
                  ? "border-blue-700 bg-blue-700 text-white shadow-sm"
                  : "border-blue-100 bg-blue-50 text-blue-800 hover:bg-blue-100"
              }`}
              key={tab}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>
      </section>

      {permissionMessage ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          {permissionMessage}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {dashboard.kpiMetrics.map((metric, index) => (
          <BeverageKpiCard key={metric.label} metric={metric} featured={index === 0} />
        ))}
      </section>

      {canViewStorePlanning ? <StorePlanningSection metrics={dashboard.storePlanning} /> : null}

      {user.role === "manager" ? (
        <ManagerCallCenterReport
          rows={dashboard.managerCallCenterReport}
          summary={dashboard.managerCallCenterSummary}
        />
      ) : null}

      {isStorekeeperDashboard ? (
        <>
          <section className="grid gap-4 xl:grid-cols-[1.25fr_0.9fr_0.9fr]">
            <DashboardPanel title="Stock In vs Stock Out" subtitle="Warehouse stock movement">
              <DualBarChart
                data={dashboard.stockInOut}
                firstColor="bg-emerald-500"
                firstKey="stockIn"
                firstLabel="Stock In"
                secondColor="bg-blue-600"
                secondKey="stockOut"
                secondLabel="Stock Out"
              />
            </DashboardPanel>
            <DashboardPanel title="Cartons Loaded by Marketer" subtitle="Today loading activity">
              <HorizontalRanking rows={dashboard.loadedByMarketer} />
            </DashboardPanel>
            <DashboardPanel title="Returns Received" subtitle="Daily returned cartons">
              <SingleBarChart data={dashboard.returnsByDay} valueKey="returned" color="bg-amber-500" />
            </DashboardPanel>
          </section>
          <section className="grid gap-4 xl:grid-cols-2">
            <DashboardPanel title="Damages Recorded" subtitle="Daily damaged/short cartons">
              <SingleBarChart data={dashboard.damagesByDay} valueKey="damaged" color="bg-red-500" />
            </DashboardPanel>
            <DashboardPanel title="Raw Materials Usage" subtitle="Daily raw material movement">
              <SingleBarChart data={dashboard.rawMaterialsUsage} valueKey="used" color="bg-purple-500" />
            </DashboardPanel>
          </section>
        </>
      ) : (
        <>
          <section className="grid gap-4 xl:grid-cols-[1.25fr_0.9fr_0.9fr]">
            {isMarketerDashboard ? (
          <DashboardPanel title="Cash Expected vs Cash Given" subtitle="Your cash collection control">
            <DualBarChart
              data={dashboard.cashComparison}
              firstColor="bg-amber-500"
              firstKey="expected"
              firstLabel="Expected"
              secondColor="bg-blue-600"
              secondKey="cash"
              secondLabel="Given"
            />
          </DashboardPanel>
        ) : (
          <DashboardPanel title="Revenue vs Profit" subtitle="Daily financial comparison">
            <DualBarChart
              data={dashboard.revenueProfit}
              firstColor="bg-blue-600"
              firstKey="revenue"
              firstLabel="Revenue"
              secondColor="bg-emerald-500"
              secondKey="profit"
              secondLabel="Profit"
            />
          </DashboardPanel>
            )}
            <DashboardPanel title="Daily Cartons Sold" subtitle="Cartons sold by date">
              <SingleBarChart data={dashboard.overviewDays} valueKey="sold" color="bg-blue-500" />
            </DashboardPanel>
            <DashboardPanel title="Product Sales Distribution" subtitle="Revenue by product">
              <DistributionChart data={dashboard.productDistribution} />
            </DashboardPanel>
          </section>

          <section className={`grid gap-4 ${isMarketerDashboard ? "xl:grid-cols-1" : "xl:grid-cols-[1fr_1fr_1fr]"}`}>
            {!isMarketerDashboard ? (
              <>
                <DashboardPanel title="Cash Expected vs Cash Received" subtitle="Collection control">
                  <DualBarChart
                    data={dashboard.cashComparison}
                    firstColor="bg-amber-500"
                    firstKey="expected"
                    firstLabel="Expected"
                    secondColor="bg-blue-600"
                    secondKey="cash"
                    secondLabel="Received"
                  />
                </DashboardPanel>
                <DashboardPanel title="Top Marketers" subtitle="Ranked by sales value">
                  <HorizontalRanking rows={dashboard.marketerPerformance} />
                </DashboardPanel>
              </>
            ) : null}
            <DashboardPanel title="Loaded vs Sold vs Returned" subtitle="Stock movement flow">
              <TripleBarChart data={dashboard.loadedSoldReturned} />
            </DashboardPanel>
          </section>
        </>
      )}

      <DashboardPanel title="Beverage Distribution Operations Table" subtitle="Storekeeper → Marketer Confirmation → Sales → Returns → Accountant Cash Entry → Admin Reports">
        {isStorekeeperDashboard ? (
          <StorekeeperOperationsTable rows={dashboard.operationRows} />
        ) : (
          <OperationsTable rows={dashboard.operationRows} />
        )}
      </DashboardPanel>
    </div>
  );
}

function _ExecutiveSection({
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
    <section className="enterprise-panel p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="enterprise-section-title">{title}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {children}
    </section>
  );
}

function DashboardPanel({
  children,
  subtitle,
  title
}: {
  children: React.ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-[0_16px_45px_rgba(15,35,80,0.07)]">
      <div className="mb-4">
        <h3 className="text-sm font-black uppercase tracking-normal text-slate-950">{title}</h3>
        <p className="mt-1 text-xs font-bold text-slate-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function BeverageKpiCard({ featured, metric }: { featured?: boolean; metric: KpiMetric }) {
  const tone = getBeverageTone(metric.tone);

  return (
    <article
      className={`relative overflow-hidden rounded-xl border p-4 shadow-[0_14px_35px_rgba(15,35,80,0.07)] ${
        featured
          ? "border-blue-700 bg-gradient-to-br from-blue-700 to-blue-500 text-white"
          : "border-blue-100 bg-white text-slate-950"
      }`}
    >
      <div className={`absolute right-0 top-0 h-20 w-20 translate-x-7 -translate-y-7 rounded-full ${featured ? "bg-white/15" : tone.bg}`} />
      <p className={`relative text-xs font-black uppercase tracking-normal ${featured ? "text-blue-50" : "text-slate-500"}`}>
        {metric.label}
      </p>
      <p className={`relative mt-3 text-2xl font-black ${featured ? "text-white" : tone.text}`}>
        {metric.value}
      </p>
      <p className={`relative mt-3 text-[11px] font-black ${featured ? "text-blue-50" : "text-slate-400"}`}>
        Beverage Pro metric
      </p>
    </article>
  );
}

function StorePlanningSection({ metrics }: { metrics: StorePlanningMetric[] }) {
  return (
    <section className="rounded-xl border border-brand-100 bg-white p-4 shadow-[0_16px_45px_rgba(15,35,80,0.07)]">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-black uppercase tracking-normal text-slate-950">
            Store Planning
          </h3>
          <p className="mt-1 text-xs font-bold text-slate-500">
            Finished goods, raw materials, stock movement, and reorder visibility for production planning.
          </p>
        </div>
        <span className="w-fit rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-[11px] font-black uppercase tracking-normal text-brand-800">
          Manager / Admin
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map((metric) => {
          const tone = getBeverageTone(metric.tone);

          return (
            <article
              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              key={metric.label}
            >
              <p className="text-[11px] font-black uppercase tracking-normal text-slate-500">
                {metric.label}
              </p>
              <p className={`mt-2 text-2xl font-black ${tone.text}`}>{metric.value}</p>
              <p className="mt-2 text-xs font-bold text-slate-500">{metric.helper}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ManagerCallCenterReport({
  rows,
  summary
}: {
  rows: CallCenterReportRow[];
  summary: {
    complaintsReceived: number;
    customersWhoPressedOrder: number;
    followUpsPending: number;
    missedCalls: number;
    totalCallsToday: number;
  };
}) {
  const cards = [
    { label: "Total Calls Today", value: summary.totalCallsToday },
    { label: "Complaints Received", value: summary.complaintsReceived },
    { label: "Customers Who Pressed Order", value: summary.customersWhoPressedOrder },
    { label: "Missed Calls", value: summary.missedCalls },
    { label: "Follow-ups Pending", value: summary.followUpsPending }
  ];

  return (
    <section className="rounded-xl border border-brand-100 bg-white p-4 shadow-[0_16px_45px_rgba(15,35,80,0.07)]">
      <div className="mb-4">
        <h3 className="text-sm font-black uppercase tracking-normal text-slate-950">
          Call Center Summary Reports
        </h3>
        <p className="mt-1 text-xs font-bold text-slate-500">
          Manager read-only view. Call center agents handle calls and admin controls settings.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <article className="rounded-lg border border-brand-100 bg-brand-50 p-4" key={card.label}>
            <p className="text-xs font-black uppercase tracking-normal text-brand-800">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-black text-brand-950">
              {card.value.toLocaleString()}
            </p>
          </article>
        ))}
      </div>
      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="data-table min-w-[760px]">
          <thead>
            <tr>
              <th>Date</th>
              <th>Total Calls</th>
              <th>Complaints</th>
              <th>Orders Requested</th>
              <th>Missed Calls</th>
              <th>Follow-ups Pending</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date}>
                <td>{formatDate(row.date)}</td>
                <td>{row.totalCalls.toLocaleString()}</td>
                <td>{row.complaints.toLocaleString()}</td>
                <td>{row.ordersRequested.toLocaleString()}</td>
                <td>{row.missedCalls.toLocaleString()}</td>
                <td>{row.followUpsPending.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DualBarChart<T extends { date: string }>({
  data,
  firstColor,
  firstKey,
  firstLabel,
  secondColor,
  secondKey,
  secondLabel
}: {
  data: T[];
  firstColor: string;
  firstKey: keyof T;
  firstLabel: string;
  secondColor: string;
  secondKey: keyof T;
  secondLabel: string;
}) {
  const maxValue = Math.max(
    1,
    ...data.map((row) => Math.max(Number(row[firstKey]) || 0, Number(row[secondKey]) || 0))
  );

  return (
    <div className="space-y-4">
      <ChartLegend items={[{ color: firstColor, label: firstLabel }, { color: secondColor, label: secondLabel }]} />
      <div className="grid grid-cols-7 gap-2">
        {data.map((row) => (
          <div className="space-y-2" key={row.date}>
            <div className="flex h-44 items-end justify-center gap-1 rounded-lg border border-blue-50 bg-slate-50 px-2 py-3">
              <span className={`w-4 rounded-t ${firstColor}`} style={{ height: `${Math.max(5, ((Number(row[firstKey]) || 0) / maxValue) * 100)}%` }} />
              <span className={`w-4 rounded-t ${secondColor}`} style={{ height: `${Math.max(5, ((Number(row[secondKey]) || 0) / maxValue) * 100)}%` }} />
            </div>
            <p className="text-center text-[11px] font-black text-slate-500">{formatShortDate(row.date)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SingleBarChart<T extends { date: string }>({
  color,
  data,
  valueKey
}: {
  color: string;
  data: T[];
  valueKey: keyof T;
}) {
  const maxValue = Math.max(1, ...data.map((row) => Number(row[valueKey]) || 0));

  return (
    <div className="grid grid-cols-7 gap-2">
      {data.map((row) => (
        <div className="space-y-2" key={row.date}>
          <div className="flex h-44 items-end rounded-lg border border-blue-50 bg-slate-50 px-3 py-3">
            <span className={`w-full rounded-t ${color}`} style={{ height: `${Math.max(5, ((Number(row[valueKey]) || 0) / maxValue) * 100)}%` }} />
          </div>
          <p className="text-center text-[11px] font-black text-slate-500">{formatShortDate(row.date)}</p>
        </div>
      ))}
    </div>
  );
}

function TripleBarChart({ data }: { data: Array<{ date: string; loaded: number; returned: number; sold: number }> }) {
  const maxValue = Math.max(1, ...data.map((row) => Math.max(row.loaded, row.sold, row.returned)));

  return (
    <div className="space-y-4">
      <ChartLegend items={[{ color: "bg-blue-600", label: "Loaded" }, { color: "bg-emerald-500", label: "Sold" }, { color: "bg-amber-500", label: "Returned" }]} />
      <div className="grid grid-cols-7 gap-2">
        {data.map((row) => (
          <div className="space-y-2" key={row.date}>
            <div className="flex h-44 items-end justify-center gap-1 rounded-lg border border-blue-50 bg-slate-50 px-2 py-3">
              <span className="w-3 rounded-t bg-blue-600" style={{ height: `${Math.max(5, (row.loaded / maxValue) * 100)}%` }} />
              <span className="w-3 rounded-t bg-emerald-500" style={{ height: `${Math.max(5, (row.sold / maxValue) * 100)}%` }} />
              <span className="w-3 rounded-t bg-amber-500" style={{ height: `${Math.max(5, (row.returned / maxValue) * 100)}%` }} />
            </div>
            <p className="text-center text-[11px] font-black text-slate-500">{formatShortDate(row.date)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DistributionChart({ data }: { data: Array<{ label: string; value: number }> }) {
  const total = data.reduce((sum, row) => sum + row.value, 0) || 1;
  const colors = ["bg-blue-600", "bg-cyan-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500"];

  if (!data.length) {
    return <EmptyChart label="No product sales submitted for this date." />;
  }

  return (
    <div className="space-y-3">
      {data.slice(0, 5).map((row, index) => (
        <div key={row.label}>
          <div className="mb-1 flex items-center justify-between text-xs font-black">
            <span className="text-slate-700">{row.label}</span>
            <span className="text-slate-500">{Math.round((row.value / total) * 100)}%</span>
          </div>
          <div className="h-3 rounded-full bg-slate-100">
            <div className={`h-3 rounded-full ${colors[index % colors.length]}`} style={{ width: `${Math.max(4, (row.value / total) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function HorizontalRanking({ rows }: { rows: { marketer: string; sold: number; value: number }[] }) {
  const maxValue = Math.max(1, ...rows.map((row) => row.value));

  if (!rows.length) {
    return <EmptyChart label="No marketer sales submitted yet." />;
  }

  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={row.marketer}>
          <div className="mb-1 flex items-center justify-between text-xs font-black">
            <span className="text-slate-700">{index + 1}. {row.marketer}</span>
            <span className="text-blue-700">{row.sold.toLocaleString()} cartons</span>
          </div>
          <div className="h-3 rounded-full bg-slate-100">
            <div className="h-3 rounded-full bg-blue-600" style={{ width: `${Math.max(6, (row.value / maxValue) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function OperationsTable({ rows }: { rows: OperationalTableRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table min-w-[1320px]">
        <thead>
          <tr>
            <th>Date</th>
            <th>Region</th>
            <th>Marketer</th>
            <th>Product</th>
            <th>Loaded</th>
            <th>Confirmed</th>
            <th>Sold</th>
            <th>Returned</th>
            <th>Damaged</th>
            <th>Revenue</th>
            <th>Expected Cash</th>
            <th>Cash Received</th>
            <th>Difference</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.date}-${row.marketer}-${row.product}-${row.loaded}`}>
              <td>{formatDate(row.date)}</td>
              <td>{row.region}</td>
              <td className="font-bold text-slate-950">{row.marketer}</td>
              <td>{row.product}</td>
              <td>{row.loaded.toLocaleString()}</td>
              <td>{row.confirmed.toLocaleString()}</td>
              <td>{row.sold.toLocaleString()}</td>
              <td>{row.returned.toLocaleString()}</td>
              <td>{row.damaged.toLocaleString()}</td>
              <td>{formatMoney(row.revenue)}</td>
              <td>{formatMoney(row.expectedCash)}</td>
              <td>{formatMoney(row.cashReceived)}</td>
              <td className={row.difference < 0 ? "font-black text-red-600" : "font-black text-emerald-700"}>{formatMoney(row.difference)}</td>
              <td><span className="status-badge border-blue-100 bg-blue-50 text-blue-700">{row.status.replace(/_/g, " ")}</span></td>
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td className="text-center text-slate-500" colSpan={14}>No beverage operations recorded for this date.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function StorekeeperOperationsTable({ rows }: { rows: OperationalTableRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table min-w-[920px]">
        <thead>
          <tr>
            <th>Date</th>
            <th>Region</th>
            <th>Marketer</th>
            <th>Product</th>
            <th>Loaded</th>
            <th>Confirmed</th>
            <th>Returned</th>
            <th>Damaged</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.date}-${row.marketer}-${row.product}-${row.loaded}`}>
              <td>{formatDate(row.date)}</td>
              <td>{row.region}</td>
              <td className="font-bold text-slate-950">{row.marketer}</td>
              <td>{row.product}</td>
              <td>{row.loaded.toLocaleString()}</td>
              <td>{row.confirmed.toLocaleString()}</td>
              <td>{row.returned.toLocaleString()}</td>
              <td className={row.damaged > 0 ? "font-black text-red-700" : ""}>
                {row.damaged.toLocaleString()}
              </td>
              <td>
                <span className="status-badge border-brand-100 bg-brand-50 text-brand-800">
                  {row.status.replace(/_/g, " ")}
                </span>
              </td>
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td className="text-center text-slate-500" colSpan={9}>
                No store operations recorded for this date.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function ChartLegend({ items }: { items: Array<{ color: string; label: string }> }) {
  return (
    <div className="flex flex-wrap gap-3 text-xs font-black text-slate-500">
      {items.map((item) => (
        <span className="inline-flex items-center gap-2" key={item.label}>
          <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex min-h-44 items-center justify-center rounded-lg border border-dashed border-blue-100 bg-blue-50/40 px-4 text-center text-sm font-bold text-slate-500">
      {label}
    </div>
  );
}

function getBeverageTone(tone: KpiMetric["tone"]) {
  const styles = {
    amber: { bg: "bg-amber-50", text: "text-amber-700" },
    blue: { bg: "bg-blue-50", text: "text-blue-700" },
    green: { bg: "bg-emerald-50", text: "text-emerald-700" },
    purple: { bg: "bg-purple-50", text: "text-purple-700" },
    red: { bg: "bg-red-50", text: "text-red-700" },
    slate: { bg: "bg-slate-50", text: "text-slate-800" }
  };

  return styles[tone];
}

function _StockCashOverview({
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
            <div className="flex h-40 items-end justify-center gap-1 rounded-lg border border-slate-100 bg-[repeating-linear-gradient(135deg,#f8fafc_0,#f8fafc_4px,#eef4f0_4px,#eef4f0_8px)] px-2 py-3">
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

function _RecentActivities({ activities }: { activities: Activity[] }) {
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

function _MarketerPerformance({
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

function _SummaryTile({
  label,
  value
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
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

function _getStatToneClass(tone: DashboardStat["tone"] = "neutral") {
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

function _getAlertClass(tone: "success" | "danger" | "warning") {
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
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
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

function getDatePart(value: string) {
  return value.includes("T") ? value.split("T")[0] : value;
}

function getSalesSoldCartons(record: SalesRecord) {
  if (!record.clientSales?.length) {
    return Number(record.soldCartons) || 0;
  }

  return record.clientSales.reduce(
    (total, row) => total + (Number(row.quantityCartons) || 0),
    0
  );
}

function getSalesValue(record: SalesRecord) {
  if (!record.clientSales?.length) {
    return Number(record.salesValue) || 0;
  }

  return record.clientSales.reduce(
    (total, row) => total + (Number(row.totalAmount) || 0),
    0
  );
}
