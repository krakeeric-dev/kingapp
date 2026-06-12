"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Printer, ScrollText, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { KingAppLogo } from "@/components/KingAppLogo";
import type { SessionUser } from "@/lib/auth";
import { getActiveCompanyId, getCompanyById } from "@/lib/companies-data";
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
      {(user) => <DailyReportContent user={user} />}
    </AppShell>
  );
}

function DailyReportContent({ user }: { user: SessionUser }) {
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
    const cash = preferGroupedCashRecords(cashRecords.filter((record) => matches(record)));
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
    const totalDifference = Math.max(0, expectedCash - cashReceived);
    const collectionRate = expectedCash > 0 ? (cashReceived / expectedCash) * 100 : 0;
    const openingBalance = expenses.reduce(
      (total, record) => total + (Number(record.openingCash) || 0),
      0
    );
    const netCashAfterExpenses = cashReceived - expenseSummary.totalExpenses;
    const closingBalance =
      openingBalance + cashReceived - expenseSummary.totalExpenses;
    const cashBySalesId = new Map(cash.map((record) => [record.salesRecordId, record]));
    const cashRows = groupSalesByMarketerDate(sales).map((group) => {
      const groupedCash = cashBySalesId.get(group.id);
      const legacyCash = groupedCash
        ? []
        : cash.filter(
            (record) =>
              record.date === group.date &&
              record.marketerUsername === group.marketerUsername
          );
      const received = groupedCash
        ? groupedCash.cashReceived
        : legacyCash.reduce((total, record) => total + record.cashReceived, 0);
      const notes = groupedCash?.notes ?? legacyCash.map((record) => record.notes).filter(Boolean).join("; ");
      const difference = group.salesValue - received;

      return {
        collectionRate: group.salesValue > 0 ? (received / group.salesValue) * 100 : 0,
        date: group.date,
        difference,
        expectedCash: group.salesValue,
        marketerName: group.marketerName,
        notes,
        received,
        soldCartons: group.soldCartons,
        status: groupedCash?.status ?? (legacyCash.length ? "cash_submitted" : "Pending")
      };
    });
    const expenseRows = expenses.map((record) => ({
      airtime: record.airtime,
      commission: record.commission,
      date: record.date,
      food: record.food,
      fuel: record.fuel,
      loaderPayment: record.loaderPayment,
      marketerName: record.marketerName || "Company",
      miscellaneous: record.miscellaneous,
      notes: record.notes,
      totalExpenses: record.totalExpenses,
      transport: record.transport
    }));
    const outstandingRows = cashRows.filter((row) => row.difference > 0);

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
      ...expenseSummary,
      cashRows,
      closingBalance,
      collectionRate,
      expenseRows,
      inventorySummary,
      netCashAfterExpenses,
      openingBalance,
      outstandingRows,
      totalDifference
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

  const company = getCompanyById(getActiveCompanyId(user));
  const companyName = company?.name ?? (getActiveCompanyId(user) === "all" ? "KingApp Group" : user.companyName);
  const companyLogo = company?.logo ?? "";
  const tinNumber = company?.tinNumber ?? "";

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

      <section className="no-print grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <DailyFinancialCard
          label="Expected Cash"
          value={`${formatMoney(report.expectedCash)} RWF`}
        />
        <DailyFinancialCard
          label="Cash Collected"
          value={`${formatMoney(report.cashReceived)} RWF`}
        />
        <DailyFinancialCard
          label="Difference"
          tone={report.totalDifference > 0 ? "danger" : "default"}
          value={`${formatMoney(report.totalDifference)} RWF`}
        />
        <DailyFinancialCard
          label="Total Expenses"
          value={`${formatMoney(report.totalExpenses)} RWF`}
        />
        <DailyFinancialCard
          label="Net Cash After Expenses"
          tone={report.netCashAfterExpenses < 0 ? "danger" : "default"}
          value={`${formatMoney(report.netCashAfterExpenses)} RWF`}
        />
        <DailyFinancialCard
          label="Collection Rate"
          tone={report.collectionRate >= 95 ? "default" : "warning"}
          value={`${report.collectionRate.toFixed(0)}%`}
        />
      </section>

      <section className="no-print grid gap-4 xl:grid-cols-3">
        <FinanceTable title="Cash Collected by Marketer">
          <thead>
            <tr>
              <th>Date</th>
              <th>Marketer</th>
              <th>Sold</th>
              <th>Expected</th>
              <th>Collected</th>
            </tr>
          </thead>
          <tbody>
            {report.cashRows.map((row) => (
              <tr key={`${row.date}-${row.marketerName}`}>
                <td>{formatDate(row.date)}</td>
                <td className="font-bold text-slate-950">{row.marketerName}</td>
                <td>{row.soldCartons.toLocaleString()}</td>
                <td>{formatMoney(row.expectedCash)}</td>
                <td>{formatMoney(row.received)}</td>
              </tr>
            ))}
          </tbody>
        </FinanceTable>

        <FinanceTable title="Expenses Used Today">
          <thead>
            <tr>
              <th>Marketer</th>
              <th>Fuel</th>
              <th>Transport</th>
              <th>Loader</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {report.expenseRows.map((row) => (
              <tr key={`${row.date}-${row.marketerName}-${row.totalExpenses}`}>
                <td className="font-bold text-slate-950">{row.marketerName}</td>
                <td>{formatMoney(row.fuel)}</td>
                <td>{formatMoney(row.transport)}</td>
                <td>{formatMoney(row.loaderPayment)}</td>
                <td>{formatMoney(row.totalExpenses)}</td>
              </tr>
            ))}
          </tbody>
        </FinanceTable>

        <FinanceTable title="Outstanding Cash by Marketer">
          <thead>
            <tr>
              <th>Marketer</th>
              <th>Expected</th>
              <th>Collected</th>
              <th>Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {report.outstandingRows.map((row) => (
              <tr key={`${row.date}-${row.marketerName}-outstanding`}>
                <td className="font-bold text-slate-950">{row.marketerName}</td>
                <td>{formatMoney(row.expectedCash)}</td>
                <td>{formatMoney(row.received)}</td>
                <td className="font-bold text-red-700">{formatMoney(row.difference)}</td>
              </tr>
            ))}
          </tbody>
        </FinanceTable>
      </section>

      <article className="print-page rounded-lg border border-slate-200 bg-white p-5 shadow-executive sm:p-8">
        <header className="rounded-lg bg-gradient-to-r from-brand-950 to-brand-700 p-5 text-white">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {companyLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={`${companyName} logo`} className="h-14 w-14 rounded-lg bg-white object-contain p-1" src={companyLogo} />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white p-1">
                  <KingAppLogo size={44} />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-black text-white">{companyName}</h1>
                <p className="text-sm font-semibold text-emerald-100">
                  Sales & Stock Management
                </p>
                <p className="text-xs font-bold text-emerald-100">TIN: {tinNumber || "Not recorded"}</p>
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

function DailyFinancialCard({
  label,
  tone = "default",
  value
}: {
  label: string;
  tone?: "danger" | "default" | "warning";
  value: string;
}) {
  const toneClass =
    tone === "danger"
      ? "border-red-100 bg-red-50 text-red-800"
      : tone === "warning"
        ? "border-amber-100 bg-amber-50 text-amber-800"
        : "border-brand-100 bg-white text-brand-900";

  return (
    <article className={`rounded-lg border p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-black uppercase tracking-normal text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-black">{value}</p>
    </article>
  );
}

function FinanceTable({
  children,
  title
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-brand-100 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="font-black text-slate-950">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table min-w-[520px]">{children}</table>
      </div>
    </section>
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

function preferGroupedCashRecords(records: CashRecord[]) {
  const groupedRecords = records.filter((record) =>
    record.salesRecordId.startsWith("CASH-GROUP-")
  );

  return groupedRecords.length > 0 ? groupedRecords : records;
}

function groupSalesByMarketerDate(records: SalesRecord[]) {
  const groups = new Map<string, SalesRecord[]>();

  records.forEach((record) => {
    const key = `${record.date}::${record.marketerUsername}`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  });

  return Array.from(groups.entries()).map(([key, groupRecords]) => {
    const firstRecord = groupRecords[0];
    const loadedCartons = groupRecords.reduce(
      (total, record) => total + record.loadedCartons,
      0
    );
    const soldCartons = groupRecords.reduce(
      (total, record) => total + record.soldCartons,
      0
    );
    const salesValue = groupRecords.reduce(
      (total, record) => total + record.salesValue,
      0
    );

    return {
      ...firstRecord,
      id: `CASH-GROUP-${key.replace(/[^a-z0-9]+/gi, "-").toUpperCase()}`,
      itemCode: "GROUP",
      loadedCartons,
      pricePerCarton: 0,
      productName: "All Products",
      salesValue,
      soldCartons
    };
  });
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
