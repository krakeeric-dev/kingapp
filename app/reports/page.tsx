"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Boxes, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getLoadingRecords } from "@/lib/loading-data";
import type { LoadingRecord } from "@/lib/loading-data";
import { formatMoney, getSalesRecords } from "@/lib/sales-data";
import type { SalesRecord } from "@/lib/sales-data";
import { getReturnRecords } from "@/lib/returns-data";
import type { ReturnRecord } from "@/lib/returns-data";
import {
  getInventoryMovements,
  getInventoryRows,
  getInventorySummary,
  getMinimumStocks
} from "@/lib/inventory-data";
import type { InventoryMovement, MinimumStock } from "@/lib/inventory-data";
import type { SessionUser } from "@/lib/auth";
import {
  getActiveCompanyId,
  getCompanies,
  setActiveCompanyId
} from "@/lib/companies-data";
import { getExecutiveCompanyMetrics } from "@/lib/executive-data";

export default function ReportsPage() {
  return (
    <AppShell allowedRoles={["admin", "supervisor", "manager"]}>
      {(user) => <ReportsContent user={user} />}
    </AppShell>
  );
}

function ReportsContent({ user }: { user: SessionUser }) {
  const [loadingRecords, setLoadingRecords] = useState<LoadingRecord[]>([]);
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [returnRecords, setReturnRecords] = useState<ReturnRecord[]>([]);
  const [inventoryMovements, setInventoryMovements] = useState<
    InventoryMovement[]
  >([]);
  const [minimumStocks, setMinimumStocks] = useState<MinimumStock[]>([]);
  const [companyId, setCompanyId] = useState("all");
  const [filters, setFilters] = useState({
    date: "",
    location: "",
    marketer: "",
    product: ""
  });

  useEffect(() => {
    setLoadingRecords(safeArray(getLoadingRecords));
    setSalesRecords(safeArray(getSalesRecords));
    setReturnRecords(safeArray(getReturnRecords));
    setInventoryMovements(safeArray(getInventoryMovements));
    setMinimumStocks(safeArray(getMinimumStocks));
    setCompanyId(getActiveCompanyId(user));
  }, []);

  function changeCompany(value: string) {
    setCompanyId(value);
    if (user.role === "admin") {
      setActiveCompanyId(value);
      window.dispatchEvent(new Event("kingapp:company-switched"));
    }
  }

  const scopedLoadingRecords = useMemo(() => scopeRecords(loadingRecords, companyId, user), [companyId, loadingRecords, user]);
  const scopedSalesRecords = useMemo(() => scopeRecords(salesRecords, companyId, user), [companyId, salesRecords, user]);
  const scopedReturnRecords = useMemo(() => scopeRecords(returnRecords, companyId, user), [companyId, returnRecords, user]);
  const scopedInventoryMovements = useMemo(() => scopeRecords(inventoryMovements, companyId, user), [companyId, inventoryMovements, user]);
  const companyMetrics = useMemo(() => getExecutiveCompanyMetrics(), [companyId]);

  const inventorySummary = useMemo(
    () => {
      try {
        return getInventorySummary(
          getInventoryRows({
            loadingRecords: safeRecords(scopedLoadingRecords),
            manualMovements: safeRecords(scopedInventoryMovements),
            minimumStocks: safeRecords(minimumStocks),
            returnRecords: safeRecords(scopedReturnRecords)
          })
        );
      } catch (error) {
        console.warn("[KingApp] Reports inventory summary fallback", error);
        return {
          openingStock: 0,
          receivedStock: 0,
          loadedOut: 0,
          actualReturns: 0,
          closingStock: 0
        };
      }
    },
    [minimumStocks, scopedInventoryMovements, scopedLoadingRecords, scopedReturnRecords]
  );

  const clientSalesSummary = useMemo(() => {
    const rows = safeRecords(scopedSalesRecords).flatMap((record) =>
      safeRecords(record?.clientSales).flatMap((client) => {
        const clientTotalAmount = safeNumber(client?.totalAmount);
        const clientAmountPaid = safeNumber(client?.amountPaid);
        const clientBalance = safeNumber(client?.balance);

        if (!client?.productQuantities) {
          return [
            {
              ...client,
              id: String(client?.id ?? `${record.id}-client`),
              clientName: String(client?.clientName ?? "Unknown Client"),
              clientPhone: String(client?.clientPhone ?? ""),
              clientLocation: String(client?.clientLocation ?? ""),
              productName: String(client?.productName ?? record.productName ?? "Unknown Product"),
              itemCode: String(client?.itemCode ?? record.itemCode ?? ""),
              quantityCartons: safeNumber(client?.quantityCartons),
              totalAmount: clientTotalAmount,
              amountPaid: clientAmountPaid,
              balance: clientBalance,
              date: String(record.date ?? ""),
              marketerName: String(record.marketerName ?? ""),
              marketerUsername: String(record.marketerUsername ?? ""),
              salesRecordId: String(record.id ?? "")
            }
          ];
        }

        return reportProducts
          .map((product) => {
            const quantityCartons = client.productQuantities?.[product.key] ?? 0;
            const totalAmount = client.productAmounts?.[product.key] ?? 0;

            if (quantityCartons <= 0) {
              return null;
            }

            return {
              ...client,
              id: String(client.id ?? `${record.id}-${product.key}`),
              clientName: String(client.clientName ?? "Unknown Client"),
              clientPhone: String(client.clientPhone ?? ""),
              clientLocation: String(client.clientLocation ?? ""),
              productName: product.productName,
              itemCode: product.itemCode,
              quantityCartons,
              totalAmount,
              amountPaid:
                clientTotalAmount > 0
                  ? (clientAmountPaid * totalAmount) / clientTotalAmount
                  : 0,
              balance:
                clientTotalAmount > 0
                  ? (clientBalance * totalAmount) / clientTotalAmount
                  : 0,
              date: String(record.date ?? ""),
              marketerName: String(record.marketerName ?? ""),
              marketerUsername: String(record.marketerUsername ?? ""),
              salesRecordId: String(record.id ?? "")
            };
          })
          .filter((row): row is NonNullable<typeof row> => Boolean(row));
      })
    );
    const filteredRows = rows.filter((row) => {
      const matchesDate = !filters.date || row.date === filters.date;
      const matchesMarketer =
        !filters.marketer ||
        `${row.marketerName ?? ""} ${row.marketerUsername ?? ""}`
          .toLowerCase()
          .includes(filters.marketer.toLowerCase());
      const matchesProduct =
        !filters.product ||
        String(row.productName ?? "")
          .toLowerCase()
          .includes(filters.product.toLowerCase());
      const matchesLocation =
        !filters.location ||
        String(row.clientLocation ?? "")
          .toLowerCase()
          .includes(filters.location.toLowerCase());

      return matchesDate && matchesMarketer && matchesProduct && matchesLocation;
    });

    return {
      rows: filteredRows,
      clients: new Set(filteredRows.map((row) => `${row.salesRecordId}-${row.id}`))
        .size,
      quantity: filteredRows.reduce((total, row) => total + row.quantityCartons, 0),
      totalAmount: filteredRows.reduce((total, row) => total + row.totalAmount, 0),
      paid: filteredRows.reduce((total, row) => total + row.amountPaid, 0),
      balance: filteredRows.reduce((total, row) => total + row.balance, 0)
    };
  }, [filters, scopedSalesRecords]);

  function updateFilter(field: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-950">Reports</h2>
            <p className="mt-1 text-sm text-slate-600">
              {companyId === "all" ? "Group report across all companies." : "Company report for the selected workspace."}
            </p>
          </div>
          </div>
          {user.role === "admin" ? (
            <select className="form-input max-w-xs" onChange={(event) => changeCompany(event.target.value)} value={companyId}>
              <option value="all">All Companies</option>
              {getCompanies().map((company) => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-brand-700" />
          <h3 className="text-lg font-bold text-slate-950">Company Comparison Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Sales</th>
                <th>Cash</th>
                <th>Orders</th>
                <th>Debt</th>
                <th>Inventory Value</th>
                <th>Calls</th>
                <th>Complaints</th>
                <th>Performance</th>
              </tr>
            </thead>
            <tbody>
              {companyMetrics
                .filter((row) => companyId === "all" || row.company.id === companyId)
                .map((row) => (
                  <tr key={row.company.id}>
                    <td className="font-bold text-slate-950">{row.company.name}</td>
                    <td>{formatMoney(row.salesToday)} RWF</td>
                    <td>{formatMoney(row.cashCollected)} RWF</td>
                    <td>{row.orders.toLocaleString()}</td>
                    <td>{formatMoney(row.outstandingDebt)} RWF</td>
                    <td>{formatMoney(row.inventoryValue)} RWF</td>
                    <td>{row.callsToday.toLocaleString()}</td>
                    <td>{row.complaintsOpen.toLocaleString()}</td>
                    <td>{row.performance}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Boxes className="h-5 w-5 text-brand-700" />
          <h3 className="text-lg font-bold text-slate-950">
            Inventory Summary
          </h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <ReportMetric label="Opening Stock" value={inventorySummary.openingStock} />
          <ReportMetric label="Received Stock" value={inventorySummary.receivedStock} />
          <ReportMetric label="Loaded Out" value={inventorySummary.loadedOut} />
          <ReportMetric
            label="Returns Received"
            value={inventorySummary.actualReturns}
          />
          <ReportMetric label="Closing Stock" value={inventorySummary.closingStock} />
        </div>
      </section>

      <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-brand-700" />
            <h3 className="text-lg font-bold text-slate-950">
              Client Sales Summary
            </h3>
          </div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <Search className="h-4 w-4 text-brand-700" />
            Filter by marketer, product, location, and date
          </div>
        </div>
        <div className="mb-4 grid gap-3 md:grid-cols-4">
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
          <FilterField label="Location">
            <input
              className="form-input"
              onChange={(event) => updateFilter("location", event.target.value)}
              placeholder="Search location"
              value={filters.location}
            />
          </FilterField>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <ReportMetric label="Clients Served" value={clientSalesSummary.clients} />
          <ReportMetric label="Cartons Sold" value={clientSalesSummary.quantity} />
          <ReportMoneyMetric
            label="Client Sales"
            value={clientSalesSummary.totalAmount}
          />
          <ReportMoneyMetric label="Paid" value={clientSalesSummary.paid} />
          <ReportMoneyMetric
            label="Unpaid Balance"
            value={clientSalesSummary.balance}
          />
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Marketer</th>
                <th>Client</th>
                <th>Phone</th>
                <th>Location</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {clientSalesSummary.rows.map((row) => (
                <tr key={`${row.salesRecordId}-${row.id}`}>
                  <td>{row.date}</td>
                  <td>{row.marketerName}</td>
                  <td className="font-bold text-slate-950">{row.clientName}</td>
                  <td>{row.clientPhone || "-"}</td>
                  <td>{row.clientLocation || "-"}</td>
                  <td>{row.productName}</td>
                  <td>{row.quantityCartons.toLocaleString()}</td>
                  <td>{formatMoney(row.totalAmount)} RWF</td>
                  <td>{formatMoney(row.amountPaid)} RWF</td>
                  <td>{formatMoney(row.balance)} RWF</td>
                </tr>
              ))}
            </tbody>
          </table>
          {clientSalesSummary.rows.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm font-semibold text-slate-500">
              No client sales match these filters.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

const reportProducts: Array<{ key: string; productName: string; itemCode: string }> = [];

function safeArray<T>(loader: () => T[]): T[] {
  try {
    const records = loader();
    return Array.isArray(records) ? records : [];
  } catch (error) {
    console.warn("[KingApp] Reports data fallback", error);
    return [];
  }
}

function safeRecords<T>(records: T[] | null | undefined): T[] {
  return Array.isArray(records) ? records : [];
}

function safeNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function scopeRecords<T extends object>(records: T[], companyId: string, user: SessionUser) {
  const activeCompany = user.role === "admin" ? companyId : user.companyId;

  if (user.role === "admin" && activeCompany === "all") {
    return records;
  }

  return records.filter((record) => (record as { companyId?: string }).companyId === activeCompany);
}

function ReportMetric({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-lg bg-brand-50 px-4 py-3">
      <p className="text-sm font-semibold text-brand-800">{label}</p>
      <p className="mt-2 text-2xl font-bold text-brand-900">
        {value.toLocaleString()}
      </p>
    </article>
  );
}

function ReportMoneyMetric({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-lg bg-brand-50 px-4 py-3">
      <p className="text-sm font-semibold text-brand-800">{label}</p>
      <p className="mt-2 text-2xl font-bold text-brand-900">
        {formatMoney(value)} RWF
      </p>
    </article>
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
