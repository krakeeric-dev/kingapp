"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Printer, ScrollText, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
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
  getInventoryMovements,
  getInventoryRows,
  getInventorySummary,
  getMinimumStocks
} from "@/lib/inventory-data";
import type { InventoryMovement, MinimumStock } from "@/lib/inventory-data";

type Filters = {
  date: string;
  marketer: string;
  product: string;
};

export default function DailyReportPage() {
  return (
    <AppShell allowedRoles={["admin", "manager", "supervisor", "accountant"]}>
      {() => <DailyReportContent />}
    </AppShell>
  );
}

function DailyReportContent() {
  const [loadingRecords, setLoadingRecords] = useState<LoadingRecord[]>([]);
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [cashRecords, setCashRecords] = useState<CashRecord[]>([]);
  const [returnRecords, setReturnRecords] = useState<ReturnRecord[]>([]);
  const [expenseRecords, setExpenseRecords] = useState<ExpenseRecord[]>([]);
  const [inventoryMovements, setInventoryMovements] = useState<
    InventoryMovement[]
  >([]);
  const [minimumStocks, setMinimumStocks] = useState<MinimumStock[]>([]);
  const [filters, setFilters] = useState<Filters>({
    date: getTodayIsoDate(),
    marketer: "",
    product: ""
  });

  useEffect(() => {
    setLoadingRecords(getLoadingRecords());
    setSalesRecords(getSalesRecords());
    setCashRecords(getCashRecords());
    setReturnRecords(getReturnRecords());
    setExpenseRecords(getExpenseRecords());
    setInventoryMovements(getInventoryMovements());
    setMinimumStocks(getMinimumStocks());
  }, []);

  const report = useMemo(() => {
    const matches = (record: {
      date: string;
      marketerName?: string;
      marketerUsername?: string;
      productName?: string;
    }) => {
      const matchesDate = !filters.date || record.date === filters.date;
      const marketerText = `${record.marketerName ?? ""} ${
        record.marketerUsername ?? ""
      }`.toLowerCase();
      const matchesMarketer =
        !filters.marketer ||
        marketerText.includes(filters.marketer.toLowerCase());
      const matchesProduct =
        !filters.product ||
        (record.productName ?? "")
          .toLowerCase()
          .includes(filters.product.toLowerCase());

      return matchesDate && matchesMarketer && matchesProduct;
    };

    const loads = loadingRecords.filter(
      (record) => record.status !== "draft" && matches(record)
    );
    const sales = salesRecords.filter(
      (record) => record.status === "sales_submitted" && matches(record)
    );
    const cash = cashRecords.filter((record) => matches(record));
    const returns = returnRecords.filter((record) => matches(record));
    const expenses = expenseRecords.filter((record) => matches(record));
    const inventoryRows = getInventoryRows({
      loadingRecords: loads,
      manualMovements: inventoryMovements.filter((record) => matches(record)),
      minimumStocks,
      returnRecords: returns
    });
    const inventorySummary = getInventorySummary(inventoryRows);

    const expenseSummary = expenses.reduce(
      (total, record) => ({
        fuel: total.fuel + record.fuel,
        transport: total.transport + record.transport,
        loaderPayment: total.loaderPayment + record.loaderPayment,
        commission: total.commission + record.commission,
        airtime: total.airtime + record.airtime,
        food: total.food + record.food,
        miscellaneous: total.miscellaneous + record.miscellaneous,
        totalExpenses: total.totalExpenses + record.totalExpenses,
        closingBalance: total.closingBalance + record.closingBalance
      }),
      {
        fuel: 0,
        transport: 0,
        loaderPayment: 0,
        commission: 0,
        airtime: 0,
        food: 0,
        miscellaneous: 0,
        totalExpenses: 0,
        closingBalance: 0
      }
    );

    const totalLoaded = loads.reduce(
      (total, record) => total + record.loadedCartons,
      0
    );
    const totalSold = sales.reduce(
      (total, record) => total + record.soldCartons,
      0
    );
    const expectedReturns = sales.reduce(
      (total, record) => total + record.expectedReturnCartons,
      0
    );
    const actualReturns = returns.reduce(
      (total, record) => total + record.actualReturnCartons,
      0
    );
    const stockVariance = expectedReturns - actualReturns;
    const totalSalesValue = sales.reduce(
      (total, record) => total + record.salesValue,
      0
    );
    const totalClientSales = sales.reduce(
      (total, record) =>
        total +
        (record.clientSales?.reduce((sum, row) => sum + row.totalAmount, 0) ??
          record.salesValue),
      0
    );
    const paidAmount = sales.reduce(
      (total, record) => total + (record.totalPaid ?? record.salesValue),
      0
    );
    const unpaidBalance = sales.reduce(
      (total, record) => total + (record.totalUnpaidBalance ?? 0),
      0
    );
    const clientsServed = sales.reduce(
      (total, record) => total + (record.clientsServed ?? record.clientSales?.length ?? 0),
      0
    );
    const expectedCash = cash.length
      ? cash.reduce((total, record) => total + record.expectedCash, 0)
      : totalSalesValue;
    const cashReceived = cash.reduce(
      (total, record) => total + record.cashReceived,
      0
    );
    const cashVariance = cashReceived - expectedCash;

    return {
      totalLoaded,
      totalSold,
      expectedReturns,
      actualReturns,
      stockVariance,
      totalSalesValue,
      totalClientSales,
      paidAmount,
      unpaidBalance,
      clientsServed,
      expectedCash,
      cashReceived,
      cashVariance,
      inventorySummary,
      ...expenseSummary
    };
  }, [
    cashRecords,
    expenseRecords,
    filters,
    inventoryMovements,
    loadingRecords,
    minimumStocks,
    returnRecords,
    salesRecords
  ]);

  function updateFilter(field: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function printReport() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <div className="no-print app-card-soft p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <ScrollText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-950">
                Daily Closing Report
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Generate the end-of-day management report.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className="secondary-button"
              onClick={printReport}
              type="button"
            >
              <Printer className="h-4 w-4" />
              Print Report
            </button>
            <button
              className="primary-button"
              onClick={printReport}
              type="button"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          </div>
        </div>
      </div>

      <div className="no-print app-card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
          <Search className="h-4 w-4 text-brand-700" />
          Report filters
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <FilterField label="Date">
            <input
              className="form-input"
              onChange={(event) => updateFilter("date", event.target.value)}
              type="date"
              value={filters.date}
            />
          </FilterField>
          <FilterField label="Marketer">
            <input
              className="form-input"
              onChange={(event) => updateFilter("marketer", event.target.value)}
              placeholder="Search marketer"
              value={filters.marketer}
            />
          </FilterField>
          <FilterField label="Product">
            <input
              className="form-input"
              onChange={(event) => updateFilter("product", event.target.value)}
              placeholder="Search product"
              value={filters.product}
            />
          </FilterField>
        </div>
      </div>

      <article className="print-page rounded-lg border border-slate-200 bg-white p-5 shadow-executive sm:p-8">
        <header className="rounded-lg bg-gradient-to-r from-brand-950 to-brand-700 p-5 text-white">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/15 text-xl font-black text-white">
                K
              </div>
              <div>
                <h1 className="text-2xl font-black text-white">KingApp</h1>
                <p className="text-sm font-semibold text-emerald-100">
                  Sales & Stock Management
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-sm font-semibold uppercase tracking-normal text-emerald-100">
                Daily Closing Report
              </p>
              <p className="mt-1 text-xl font-black text-white">
                {formatDate(filters.date)}
              </p>
            </div>
          </div>
        </header>

        <section className="mt-5 grid gap-3 md:grid-cols-2">
          <VarianceAlert
            label="Stock"
            unit="carton"
            value={report.stockVariance}
          />
          <VarianceAlert
            isMoney
            label="Cash"
            unit="RWF"
            value={report.cashVariance}
          />
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <ReportSection title="Stock Summary">
            <ReportLine label="Total Loaded" value={report.totalLoaded} />
            <ReportLine label="Total Sold" value={report.totalSold} />
            <ReportLine label="Expected Returns" value={report.expectedReturns} />
            <ReportLine
              label="Actual Returns Received"
              value={report.actualReturns}
            />
            <ReportLine label="Stock Variance" value={stockLabel(report.stockVariance)} />
          </ReportSection>

          <ReportSection title="Sales Summary">
            <ReportLine
              label="Total Sales Value"
              value={`${formatMoney(report.totalSalesValue)} RWF`}
            />
            <ReportLine
              label="Total Client Sales"
              value={`${formatMoney(report.totalClientSales)} RWF`}
            />
            <ReportLine
              label="Paid Amount"
              value={`${formatMoney(report.paidAmount)} RWF`}
            />
            <ReportLine
              label="Unpaid Balance"
              value={`${formatMoney(report.unpaidBalance)} RWF`}
            />
            <ReportLine
              label="Clients Served"
              value={report.clientsServed.toLocaleString()}
            />
          </ReportSection>

          <ReportSection title="Inventory Summary">
            <ReportLine
              label="Opening Stock"
              value={report.inventorySummary.openingStock}
            />
            <ReportLine
              label="Received Stock"
              value={report.inventorySummary.receivedStock}
            />
            <ReportLine
              label="Loaded Out"
              value={report.inventorySummary.loadedOut}
            />
            <ReportLine
              label="Returns Received"
              value={report.inventorySummary.actualReturns}
            />
            <ReportLine
              label="Closing Stock"
              value={report.inventorySummary.closingStock}
            />
          </ReportSection>

          <ReportSection title="Cash Summary">
            <ReportLine
              label="Expected Cash"
              value={`${formatMoney(report.expectedCash)} RWF`}
            />
            <ReportLine
              label="Cash Received"
              value={`${formatMoney(report.cashReceived)} RWF`}
            />
            <ReportLine
              label="Cash Variance"
              value={`${formatMoney(report.cashVariance)} RWF`}
            />
          </ReportSection>

          <ReportSection title="Expense Summary">
            <ReportLine label="Fuel" value={`${formatMoney(report.fuel)} RWF`} />
            <ReportLine
              label="Transport"
              value={`${formatMoney(report.transport)} RWF`}
            />
            <ReportLine
              label="Loader Payment"
              value={`${formatMoney(report.loaderPayment)} RWF`}
            />
            <ReportLine
              label="Commission"
              value={`${formatMoney(report.commission)} RWF`}
            />
            <ReportLine
              label="Airtime"
              value={`${formatMoney(report.airtime)} RWF`}
            />
            <ReportLine label="Food" value={`${formatMoney(report.food)} RWF`} />
            <ReportLine
              label="Miscellaneous"
              value={`${formatMoney(report.miscellaneous)} RWF`}
            />
            <ReportLine
              emphasis
              label="Total Expenses"
              value={`${formatMoney(report.totalExpenses)} RWF`}
            />
          </ReportSection>
        </section>

        <section className="mt-4 rounded-lg border border-brand-200 bg-gradient-to-r from-brand-50 to-white p-5">
          <p className="text-sm font-semibold uppercase tracking-normal text-brand-700">
            Final Closing Summary
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-xl font-bold text-brand-950">
              Closing Cash Balance
            </h2>
            <p className="text-3xl font-black text-brand-800">
              {formatMoney(report.closingBalance)} RWF
            </p>
          </div>
        </section>
      </article>
    </div>
  );
}

function FilterField({
  children,
  label
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-normal text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function ReportSection({
  children,
  title
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="border-b border-slate-100 pb-3 text-base font-black text-slate-950">
        {title}
      </h2>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

function ReportLine({
  emphasis = false,
  label,
  value
}: {
  emphasis?: boolean;
  label: string;
  value: number | string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 text-sm ${
        emphasis ? "border-t border-slate-100 pt-2 font-bold" : ""
      }`}
    >
      <span className="text-slate-600">{label}</span>
      <span className="text-right font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function VarianceAlert({
  isMoney = false,
  label,
  unit,
  value
}: {
  isMoney?: boolean;
  label: string;
  unit: string;
  value: number;
}) {
  const balanced = value === 0;
  const shortage = isMoney ? value < 0 : value > 0;
  const title = balanced
    ? `${label} balanced`
    : shortage
      ? `${label} shortage`
      : `${label} excess`;
  const display = isMoney
    ? `${formatMoney(value)} ${unit}`
    : `${Math.abs(value).toLocaleString()} ${unit}${
        Math.abs(value) === 1 ? "" : "s"
      }`;

  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        balanced
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : shortage
            ? "border-red-200 bg-red-50 text-red-800"
            : "border-amber-200 bg-amber-50 text-amber-800"
      }`}
    >
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 text-lg font-bold">{balanced ? "0" : display}</p>
    </div>
  );
}

function stockLabel(value: number) {
  if (value === 0) {
    return "0";
  }

  if (value > 0) {
    return `${value.toLocaleString()} shortage`;
  }

  return `+${Math.abs(value).toLocaleString()} excess`;
}
