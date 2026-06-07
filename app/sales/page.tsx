"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { FileText, LockOpen, Plus, Search, Send, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { SessionUser } from "@/lib/auth";
import {
  formatDate,
  getLoadingRecords,
  getTodayIsoDate,
  statusChipClass
} from "@/lib/loading-data";
import type { LoadingRecord } from "@/lib/loading-data";
import { getActivePrice, getProducts } from "@/lib/products-data";
import type { ProductMaster } from "@/lib/products-data";
import {
  formatMoney,
  getSalesRecords,
  submitSalesRecord,
  unlockSalesRecord,
  type ClientSaleLine,
  type PaymentStatus,
  type SalesRecord
} from "@/lib/sales-data";

type ClientSaleDraft = {
  id: string;
  clientName: string;
  clientPhone: string;
  clientLocation: string;
  saleDate: string;
  marketerName: string;
  productKey: ProductGridKey;
  quantities: Record<ProductGridKey, string>;
  paymentStatus: PaymentStatus;
  amountPaid: string;
  notes: string;
};

type DraftClientRows = Record<string, ClientSaleDraft[]>;
type ProductGridKey = "500ml" | "1L" | "1.5L" | "5L";

const productGrid: {
  key: ProductGridKey;
  label: string;
  itemCode: string;
  productName: string;
}[] = [
  {
    key: "500ml",
    label: "500ml",
    itemCode: "WT-500",
    productName: "Water 500ml"
  },
  {
    key: "1L",
    label: "1L",
    itemCode: "WT-1000",
    productName: "Water 1L"
  },
  {
    key: "1.5L",
    label: "1.5L",
    itemCode: "WT-1500",
    productName: "Water 1.5L"
  },
  {
    key: "5L",
    label: "5L",
    itemCode: "WT-5000",
    productName: "Water 5L"
  }
];

const paymentStatuses: PaymentStatus[] = ["Paid", "Partial", "Unpaid"];

export default function SalesPage() {
  return (
    <AppShell
      allowedRoles={["admin", "manager", "supervisor", "marketer", "accountant"]}
    >
      {(user) => <SalesContent user={user} />}
    </AppShell>
  );
}

function SalesContent({ user }: { user: SessionUser }) {
  const [loadingRecords, setLoadingRecords] = useState<LoadingRecord[]>([]);
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [products, setProducts] = useState<ProductMaster[]>([]);
  const [draftClientRows, setDraftClientRows] = useState<DraftClientRows>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    date: "",
    marketer: "",
    product: ""
  });
  const [unlockRecordId, setUnlockRecordId] = useState("");
  const [unlockReason, setUnlockReason] = useState("");
  const [unlockError, setUnlockError] = useState("");

  useEffect(() => {
    const loads = getLoadingRecords();
    const sales = getSalesRecords();
    const productMaster = getProducts();
    setLoadingRecords(loads);
    setSalesRecords(sales);
    setProducts(productMaster);

    const initialDrafts = sales.reduce<DraftClientRows>((drafts, record) => {
      if (record.clientSales?.length) {
        drafts[record.loadingRecordId] = record.clientSales.map(clientLineToDraft);
      }

      return drafts;
    }, {});
    setDraftClientRows(initialDrafts);
  }, []);

  const salesByLoadId = useMemo(() => {
    return new Map(
      salesRecords.map((record) => [record.loadingRecordId, record] as const)
    );
  }, [salesRecords]);

  const confirmedLoads = useMemo(() => {
    const filteredLoads = loadingRecords.filter((record) => {
      if (record.status !== "confirmed") {
        return false;
      }

      if (user.role === "marketer") {
        return record.marketerUsername === user.username;
      }

      const matchesDate = !filters.date || record.date === filters.date;
      const matchesMarketer =
        !filters.marketer ||
        record.marketerName.toLowerCase().includes(filters.marketer.toLowerCase()) ||
        record.marketerUsername
          .toLowerCase()
          .includes(filters.marketer.toLowerCase());
      const matchesProduct =
        !filters.product ||
        record.productName.toLowerCase().includes(filters.product.toLowerCase());

      return matchesDate && matchesMarketer && matchesProduct;
    });

    return groupConfirmedLoads(filteredLoads);
  }, [filters, loadingRecords, user.role, user.username]);

  function getDraftRows(load: LoadingRecord) {
    const salesRecord = salesByLoadId.get(load.id);

    return (
      draftClientRows[load.id] ??
      salesRecord?.clientSales?.map(clientLineToDraft) ??
      []
    );
  }

  function createDraftClient(load: LoadingRecord): ClientSaleDraft {
    return {
      id: `SALE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase(),
      clientName: "",
      clientPhone: "",
      clientLocation: "",
      saleDate: getTodayIsoDate(),
      marketerName: user.displayName || user.username || load.marketerName,
      productKey: "500ml",
      quantities: {
        "500ml": "",
        "1L": "",
        "1.5L": "",
        "5L": ""
      },
      paymentStatus: "Unpaid",
      amountPaid: "",
      notes: ""
    };
  }

  function addClientRow(load: LoadingRecord) {
    setDraftClientRows((current) => ({
      ...current,
      [load.id]: [...(current[load.id] ?? []), createDraftClient(load)]
    }));
  }

  function removeClientRow(loadId: string, rowId: string) {
    setDraftClientRows((current) => ({
      ...current,
      [loadId]: (current[loadId] ?? []).filter((row) => row.id !== rowId)
    }));
  }

  function updateClientRow(
    load: LoadingRecord,
    rowId: string,
    field: keyof ClientSaleDraft,
    value: string,
    productKey?: ProductGridKey
  ) {
    setDraftClientRows((current) => ({
      ...current,
      [load.id]: (current[load.id] ?? []).map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        if (field === "quantities" && productKey) {
          return {
            ...row,
            quantities: {
              ...row.quantities,
              [productKey]: value
            }
          };
        }

        if (field === "productKey") {
          const nextProductKey = value as ProductGridKey;
          const currentQuantity = row.quantities[row.productKey] ?? "";

          return {
            ...row,
            productKey: nextProductKey,
            quantities: {
              "500ml": "",
              "1L": "",
              "1.5L": "",
              "5L": "",
              [nextProductKey]: currentQuantity
            }
          };
        }

        return {
          ...row,
          [field]: field === "paymentStatus" ? (value as PaymentStatus) : value
        };
      })
    }));
  }

  function getTotals(rows: ClientSaleDraft[]) {
    return rows.reduce(
      (total, row) => {
        const quantity = getRowTotalCartons(row);
        const totalAmount = getRowTotalAmount(row, products);
        const amountPaid = toNumber(row.amountPaid);
        const balance = totalAmount - amountPaid;

        return {
          soldCartons: total.soldCartons + quantity,
          salesValue: total.salesValue + totalAmount,
          totalPaid: total.totalPaid + amountPaid,
          totalUnpaidBalance: total.totalUnpaidBalance + balance,
          clientsServed: total.clientsServed + (row.clientName.trim() ? 1 : 0)
        };
      },
      {
        soldCartons: 0,
        salesValue: 0,
        totalPaid: 0,
        totalUnpaidBalance: 0,
        clientsServed: 0
      }
    );
  }

  function normalizeClientRows(rows: ClientSaleDraft[]) {
    return rows.map((row) => {
      const productQuantities = getProductQuantities(row);
      const productAmounts = getProductAmounts(row, products);
      const quantityCartons = getRowTotalCartons(row);
      const totalAmount = getRowTotalAmount(row, products);
      const amountPaid = toNumber(row.amountPaid);
      const selectedProduct = productGrid.find(
        (product) => product.key === row.productKey
      );
      const pricePerCarton = getProductPrice(row.productKey, products);

      return {
        id: row.id,
        clientName: row.clientName.trim(),
        clientPhone: row.clientPhone.trim(),
        clientLocation: row.clientLocation.trim(),
        saleDate: row.saleDate,
        marketerName: row.marketerName,
        productName: selectedProduct?.productName ?? "Water 500ml",
        itemCode: selectedProduct?.itemCode ?? "WT-500",
        productQuantities,
        productAmounts,
        quantityCartons,
        pricePerCarton,
        totalAmount,
        paymentStatus: normalizePaymentStatus(row.paymentStatus),
        amountPaid,
        balance: totalAmount - amountPaid,
        notes: row.notes.trim()
      };
    });
  }

  function handleSubmitSales(load: LoadingRecord) {
    setMessage("");
    setError("");

    const existingRecord = salesByLoadId.get(load.id);

    if (existingRecord?.locked) {
      setError("This sales record is locked. Admin must unlock it before edits.");
      return;
    }

    const draftRows = getDraftRows(load);

    if (draftRows.length === 0) {
      setError("Add at least one client before submitting sales.");
      return;
    }

    const clientSales = normalizeClientRows(draftRows);
    const missingClient = clientSales.find((row) => !row.clientName);

    if (missingClient) {
      setError("Every client row needs a client name.");
      return;
    }

    const invalidRow = clientSales.find(
      (row) =>
        row.quantityCartons < 0 ||
        row.amountPaid < 0 ||
        row.amountPaid > row.totalAmount
    );

    if (invalidRow) {
      setError("Check quantities and paid amounts before submitting.");
      return;
    }

    const soldCartons = clientSales.reduce(
      (total, row) => total + row.quantityCartons,
      0
    );

    if (soldCartons > load.loadedCartons) {
      setError("Total client quantities cannot be greater than loaded cartons.");
      return;
    }

    const result = submitSalesRecord(
      load,
      soldCartons,
      existingRecord,
      clientSales
    );
    setSalesRecords(result.records);
    setDraftClientRows((current) => ({
      ...current,
      [load.id]: clientSales.map(clientLineToDraft)
    }));
    setMessage("Client sales submitted and locked.");
  }

  function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUnlockError("");

    if (!unlockReason.trim()) {
      setUnlockError("Enter an unlock reason before continuing.");
      return;
    }

    const updatedRecords = unlockSalesRecord(
      unlockRecordId,
      unlockReason.trim(),
      user
    );
    setSalesRecords(updatedRecords);
    setUnlockRecordId("");
    setUnlockReason("");
    setMessage("Sales record unlocked.");
  }

  return (
    <div className="space-y-6">
      <div className="app-card-soft p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-950">
              Client Sales & Returns
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Record what each client took, track payments, and calculate
              expected returns from confirmed loads.
            </p>
          </div>
        </div>
      </div>

      {user.role !== "marketer" ? (
        <div className="app-card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
            <Search className="h-4 w-4 text-brand-700" />
            Filter sales records
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <FilterField label="Date">
              <input
                className="form-input"
                onChange={(event) =>
                  setFilters((current) => ({ ...current, date: event.target.value }))
                }
                type="date"
                value={filters.date}
              />
            </FilterField>
            <FilterField label="Marketer">
              <input
                className="form-input"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    marketer: event.target.value
                  }))
                }
                placeholder="Search marketer"
                value={filters.marketer}
              />
            </FilterField>
            <FilterField label="Product">
              <input
                className="form-input"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    product: event.target.value
                  }))
                }
                placeholder="Search product"
                value={filters.product}
              />
            </FilterField>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="space-y-4">
        {confirmedLoads.map((load) => {
          const rows = getDraftRows(load);
          const salesRecord = salesByLoadId.get(load.id);

          return (
            <SalesLoadPanel
              addClientRow={addClientRow}
              draftRows={rows}
              getTotals={getTotals}
              handleSubmitSales={handleSubmitSales}
              key={load.id}
              load={load}
              products={products}
              removeClientRow={removeClientRow}
              salesRecord={salesRecord}
              setUnlockRecordId={setUnlockRecordId}
              updateClientRow={updateClientRow}
              user={user}
            />
          );
        })}
      </div>

      {confirmedLoads.length === 0 ? (
        <div className="rounded-lg border border-dashed border-brand-200 bg-white px-5 py-8 text-center text-sm font-semibold text-slate-500">
          No confirmed loading records are ready for sales entry.
        </div>
      ) : null}

      {unlockRecordId ? (
        <div className="app-card p-4">
          <form className="space-y-3" onSubmit={handleUnlock}>
            <div>
              <h3 className="font-bold text-slate-950">Unlock sales record</h3>
              <p className="mt-1 text-sm text-slate-600">
                A reason is required and will be saved in the audit log.
              </p>
            </div>
            <textarea
              className="min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
              onChange={(event) => setUnlockReason(event.target.value)}
              placeholder="Reason for sales unlock"
              value={unlockReason}
            />
            {unlockError ? (
              <p className="text-sm font-semibold text-red-700">{unlockError}</p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button className="primary-button" type="submit">
                Save unlock
              </button>
              <button
                className="secondary-button"
                onClick={() => {
                  setUnlockRecordId("");
                  setUnlockReason("");
                  setUnlockError("");
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function SalesLoadPanel({
  addClientRow,
  draftRows,
  getTotals,
  handleSubmitSales,
  load,
  products,
  removeClientRow,
  salesRecord,
  setUnlockRecordId,
  updateClientRow,
  user
}: {
  addClientRow: (load: LoadingRecord) => void;
  draftRows: ClientSaleDraft[];
  getTotals: (rows: ClientSaleDraft[]) => {
    clientsServed: number;
    salesValue: number;
    soldCartons: number;
    totalPaid: number;
    totalUnpaidBalance: number;
  };
  handleSubmitSales: (load: LoadingRecord) => void;
  load: LoadingRecord;
  products: ProductMaster[];
  removeClientRow: (loadId: string, rowId: string) => void;
  salesRecord?: SalesRecord;
  setUnlockRecordId: (recordId: string) => void;
  updateClientRow: (
    load: LoadingRecord,
    rowId: string,
    field: keyof ClientSaleDraft,
    value: string,
    productKey?: ProductGridKey
  ) => void;
  user: SessionUser;
}) {
  const isLocked = Boolean(salesRecord?.locked);
  const canEdit = user.role === "marketer" && !isLocked;
  const totals = getTotals(draftRows);
  const expectedReturn = load.loadedCartons - totals.soldCartons;

  return (
    <article className="app-card overflow-hidden">
      <div className="border-b border-slate-100 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-black text-slate-950">
                Truck {load.truck}
              </h3>
              <SalesStatusChip salesRecord={salesRecord} />
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {formatDate(load.date)} - {load.marketerName}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              One truck/load sales entry for all confirmed products.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric label="Loaded" value={load.loadedCartons.toLocaleString()} />
          <Metric label="Sold" value={totals.soldCartons.toLocaleString()} />
          <Metric
            label="Expected Return"
            tone={expectedReturn < 0 ? "danger" : "default"}
            value={expectedReturn.toLocaleString()}
          />
          <Metric label="Sales Value" value={`${formatMoney(totals.salesValue)} RWF`} />
          <Metric label="Paid" value={`${formatMoney(totals.totalPaid)} RWF`} />
          <Metric
            label="Unpaid Balance"
            tone={totals.totalUnpaidBalance > 0 ? "danger" : "default"}
            value={`${formatMoney(totals.totalUnpaidBalance)} RWF`}
          />
        </div>
      </div>

      <div className="p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="font-black text-slate-950">Client sales</h4>
            <p className="text-sm text-slate-600">
              {draftRows.length.toLocaleString()} row(s),{" "}
              {totals.clientsServed.toLocaleString()} client(s) served
            </p>
          </div>
          {canEdit ? (
            <button
              className="primary-button w-full sm:w-auto"
              onClick={() => addClientRow(load)}
              type="button"
            >
              <Plus className="h-4 w-4" />
              + Add Row
            </button>
          ) : null}
        </div>

        <SalesEntryTable
          canEdit={canEdit}
          draftRows={draftRows}
          load={load}
          products={products}
          removeClientRow={removeClientRow}
          updateClientRow={updateClientRow}
        />

        {false ? (
          <div className="grid gap-3">
            {draftRows.map((row, index) => (
              <ClientSaleCard
                canEdit={canEdit}
                index={index}
                key={row.id}
                load={load}
                products={products}
                removeClientRow={removeClientRow}
                row={row}
                updateClientRow={updateClientRow}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm font-semibold text-slate-500">
            <p>
              {canEdit
                ? "No client rows yet — click + Add Client"
                : "No client rows yet."}
            </p>
            {canEdit ? (
              <button
                className="primary-button mx-auto mt-4"
                onClick={() => addClientRow(load)}
                type="button"
              >
                <Plus className="h-4 w-4" />
                + Add Client
              </button>
            ) : null}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          {canEdit ? (
            <button
              className="primary-button w-full sm:w-auto"
              onClick={() => addClientRow(load)}
              type="button"
            >
              <Plus className="h-4 w-4" />
              + Add Row
            </button>
          ) : null}
          <SalesAction
            canEdit={canEdit}
            handleSubmitSales={handleSubmitSales}
            isLocked={isLocked}
            load={load}
            salesRecord={salesRecord}
            setUnlockRecordId={setUnlockRecordId}
            user={user}
          />
        </div>
      </div>
    </article>
  );
}

function SalesEntryTable({
  canEdit,
  draftRows,
  load,
  products,
  removeClientRow,
  updateClientRow
}: {
  canEdit: boolean;
  draftRows: ClientSaleDraft[];
  load: LoadingRecord;
  products: ProductMaster[];
  removeClientRow: (loadId: string, rowId: string) => void;
  updateClientRow: (
    load: LoadingRecord,
    rowId: string,
    field: keyof ClientSaleDraft,
    value: string,
    productKey?: ProductGridKey
  ) => void;
}) {
  if (!draftRows.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm font-semibold text-slate-500">
        {canEdit
          ? "No sales rows yet. Click + Add Row to start."
          : "No sales rows yet."}
      </div>
    );
  }

  const totalQuantity = draftRows.reduce(
    (total, row) => total + toNumber(row.quantities[row.productKey]),
    0
  );
  const totalAmount = draftRows.reduce(
    (total, row) =>
      total +
      toNumber(row.quantities[row.productKey]) *
        getProductPrice(row.productKey, products),
    0
  );

  return (
    <div>
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
        <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
          <thead className="bg-brand-50 text-xs font-black uppercase tracking-normal text-brand-900">
            <tr>
              <th className="border-b border-brand-100 px-3 py-3">Client Name</th>
              <th className="border-b border-brand-100 px-3 py-3">Phone Number</th>
              <th className="border-b border-brand-100 px-3 py-3">Location/Area</th>
              <th className="border-b border-brand-100 px-3 py-3">Date</th>
              <th className="border-b border-brand-100 px-3 py-3">Marketer</th>
              <th className="border-b border-brand-100 px-3 py-3">Product</th>
              <th className="border-b border-brand-100 px-3 py-3 text-right">Quantity</th>
              <th className="border-b border-brand-100 px-3 py-3 text-right">Unit Price</th>
              <th className="border-b border-brand-100 px-3 py-3 text-right">Amount</th>
              {canEdit ? <th className="border-b border-brand-100 px-3 py-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {draftRows.map((row) => {
              const price = getProductPrice(row.productKey, products);
              const quantity = toNumber(row.quantities[row.productKey]);
              const amount = quantity * price;

              return (
                <tr className="border-b border-slate-100 last:border-b-0" key={row.id}>
                  <td className="px-2 py-2">
                    <input
                      className="form-input min-w-36"
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateClientRow(load, row.id, "clientName", event.target.value)
                      }
                      placeholder="Jean"
                      value={row.clientName}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      className="form-input min-w-32"
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateClientRow(load, row.id, "clientPhone", event.target.value)
                      }
                      placeholder="078..."
                      value={row.clientPhone}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      className="form-input min-w-32"
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateClientRow(load, row.id, "clientLocation", event.target.value)
                      }
                      placeholder="Kigali"
                      value={row.clientLocation}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      className="form-input min-w-36"
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateClientRow(load, row.id, "saleDate", event.target.value)
                      }
                      type="date"
                      value={row.saleDate}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input className="form-input min-w-36" disabled value={row.marketerName} />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      className="form-input min-w-40"
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateClientRow(load, row.id, "productKey", event.target.value)
                      }
                      value={row.productKey}
                    >
                      {productGrid.map((product) => (
                        <option key={product.key} value={product.key}>
                          {product.productName}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      className="form-input min-w-24 text-right"
                      disabled={!canEdit}
                      min="0"
                      onChange={(event) =>
                        updateClientRow(
                          load,
                          row.id,
                          "quantities",
                          event.target.value,
                          row.productKey
                        )
                      }
                      placeholder="0"
                      type="number"
                      value={row.quantities[row.productKey] ?? ""}
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-slate-700">
                    {formatMoney(price)} RWF
                  </td>
                  <td className="px-3 py-2 text-right font-black text-brand-800">
                    {formatMoney(amount)} RWF
                  </td>
                  {canEdit ? (
                    <td className="px-2 py-2 text-right">
                      <button
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
                        onClick={() => removeClientRow(load.id, row.id)}
                        title="Remove row"
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-brand-50">
            <tr>
              <td className="px-3 py-3 font-black text-brand-900" colSpan={6}>
                Totals
              </td>
              <td className="px-3 py-3 text-right font-black text-brand-900">
                {totalQuantity.toLocaleString()}
              </td>
              <td />
              <td className="px-3 py-3 text-right font-black text-brand-900">
                {formatMoney(totalAmount)} RWF
              </td>
              {canEdit ? <td /> : null}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {draftRows.map((row) => {
          const price = getProductPrice(row.productKey, products);
          const quantity = toNumber(row.quantities[row.productKey]);
          const amount = quantity * price;

          return (
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm" key={row.id}>
              <div className="grid gap-3">
                <Field label="Client Name">
                  <input
                    className="form-input"
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateClientRow(load, row.id, "clientName", event.target.value)
                    }
                    value={row.clientName}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    className="form-input"
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateClientRow(load, row.id, "clientPhone", event.target.value)
                    }
                    value={row.clientPhone}
                  />
                </Field>
                <Field label="Location">
                  <input
                    className="form-input"
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateClientRow(load, row.id, "clientLocation", event.target.value)
                    }
                    value={row.clientLocation}
                  />
                </Field>
                <Field label="Date">
                  <input
                    className="form-input"
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateClientRow(load, row.id, "saleDate", event.target.value)
                    }
                    type="date"
                    value={row.saleDate}
                  />
                </Field>
                <Field label="Marketer">
                  <input className="form-input" disabled value={row.marketerName} />
                </Field>
                <Field label="Product">
                  <select
                    className="form-input"
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateClientRow(load, row.id, "productKey", event.target.value)
                    }
                    value={row.productKey}
                  >
                    {productGrid.map((product) => (
                      <option key={product.key} value={product.key}>
                        {product.productName}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Qty">
                  <input
                    className="form-input"
                    disabled={!canEdit}
                    min="0"
                    onChange={(event) =>
                      updateClientRow(
                        load,
                        row.id,
                        "quantities",
                        event.target.value,
                        row.productKey
                      )
                    }
                    type="number"
                    value={row.quantities[row.productKey] ?? ""}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Metric label="Unit Price" value={`${formatMoney(price)} RWF`} />
                  <Metric label="Amount" value={`${formatMoney(amount)} RWF`} />
                </div>
                {canEdit ? (
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50"
                    onClick={() => removeClientRow(load.id, row.id)}
                    type="button"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove row
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Total Quantity" value={totalQuantity.toLocaleString()} />
          <Metric label="Total Amount" value={`${formatMoney(totalAmount)} RWF`} />
        </div>
      </div>
    </div>
  );
}

function ClientSaleCard({
  canEdit,
  index,
  load,
  products,
  removeClientRow,
  row,
  updateClientRow
}: {
  canEdit: boolean;
  index: number;
  load: LoadingRecord;
  products: ProductMaster[];
  removeClientRow: (loadId: string, rowId: string) => void;
  row: ClientSaleDraft;
  updateClientRow: (
    load: LoadingRecord,
    rowId: string,
    field: keyof ClientSaleDraft,
    value: string,
    productKey?: ProductGridKey
  ) => void;
}) {
  const totalCartons = getRowTotalCartons(row);
  const totalAmount = getRowTotalAmount(row, products);
  const amountPaid = toNumber(row.amountPaid);
  const balance = totalAmount - amountPaid;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h5 className="text-sm font-black text-slate-950">
          Client {index + 1}
        </h5>
      </div>
      <div className="grid gap-3 lg:grid-cols-4">
        <Field label="Client Name">
          <input
            className="form-input"
            disabled={!canEdit}
            onChange={(event) =>
              updateClientRow(load, row.id, "clientName", event.target.value)
            }
            placeholder="Customer name"
            value={row.clientName}
          />
        </Field>
        <Field label="Phone Number">
          <input
            className="form-input"
            disabled={!canEdit}
            onChange={(event) =>
              updateClientRow(load, row.id, "clientPhone", event.target.value)
            }
            placeholder="Phone number"
            value={row.clientPhone}
          />
        </Field>
        <Field label="Location / Area">
          <input
            className="form-input"
            disabled={!canEdit}
            onChange={(event) =>
              updateClientRow(load, row.id, "clientLocation", event.target.value)
            }
            placeholder="Client location"
            value={row.clientLocation}
          />
        </Field>
        <Field label="Date">
          <input
            className="form-input"
            disabled={!canEdit}
            onChange={(event) =>
              updateClientRow(load, row.id, "saleDate", event.target.value)
            }
            type="date"
            value={row.saleDate}
          />
        </Field>
        <Field label="Marketer">
          <input className="form-input" disabled value={row.marketerName} />
        </Field>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="hidden grid-cols-[1fr_120px_150px_150px] bg-brand-50 text-xs font-black uppercase tracking-normal text-brand-900 md:grid">
          <div className="px-3 py-2">Product</div>
          <div className="px-3 py-2 text-right">Qty</div>
          <div className="px-3 py-2 text-right">Unit Price</div>
          <div className="px-3 py-2 text-right">Amount</div>
        </div>
        <div className="divide-y divide-slate-100">
          {productGrid.map((product) => {
            const price = getProductPrice(product.key, products);
            const quantity = toNumber(row.quantities[product.key]);
            const amount = quantity * price;

            return (
              <div
                className="grid gap-3 p-3 md:grid-cols-[1fr_120px_150px_150px] md:items-center"
                key={product.key}
              >
                <div>
                  <p className="text-sm font-black text-slate-950">
                    {product.productName}
                  </p>
                  <p className="text-xs font-semibold text-slate-500">
                    {product.itemCode}
                  </p>
                </div>
                <input
                  className="form-input md:text-right"
                  disabled={!canEdit}
                  min="0"
                  onChange={(event) =>
                    updateClientRow(
                      load,
                      row.id,
                      "quantities",
                      event.target.value,
                      product.key
                    )
                  }
                  placeholder="0"
                  type="number"
                  value={row.quantities[product.key] ?? ""}
                />
                <p className="text-sm font-bold text-slate-700 md:text-right">
                  {formatMoney(price)} RWF
                </p>
                <p className="text-sm font-black text-brand-800 md:text-right">
                  {formatMoney(amount)} RWF
                </p>
              </div>
            );
          })}
          <div className="grid gap-2 bg-brand-50 p-3 md:grid-cols-[1fr_120px_150px_150px] md:items-center">
            <p className="text-sm font-black text-brand-900">Client total</p>
            <p className="text-right text-sm font-black text-brand-900">
              {totalCartons.toLocaleString()}
            </p>
            <span />
            <p className="text-right text-sm font-black text-brand-900">
              {formatMoney(totalAmount)} RWF
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        <Metric label="Total Cartons" value={totalCartons.toLocaleString()} />
        <Metric label="Total Amount" value={`${formatMoney(totalAmount)} RWF`} />
        <Field label="Cash Received">
          <input
            className="form-input"
            disabled={!canEdit}
            min="0"
            onChange={(event) =>
              updateClientRow(load, row.id, "amountPaid", event.target.value)
            }
            type="number"
            value={row.amountPaid}
          />
        </Field>
        <Metric
          label="Balance"
          tone={balance > 0 ? "danger" : "default"}
          value={`${formatMoney(balance)} RWF`}
        />
        <Field label="Payment Status">
          <select
            className="form-input"
            disabled={!canEdit}
            onChange={(event) =>
              updateClientRow(load, row.id, "paymentStatus", event.target.value)
            }
            value={row.paymentStatus}
          >
            {paymentStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notes">
          <input
            className="form-input"
            disabled={!canEdit}
            onChange={(event) =>
              updateClientRow(load, row.id, "notes", event.target.value)
            }
            placeholder="Optional notes"
            value={row.notes}
          />
        </Field>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button className="secondary-button" disabled={!canEdit} type="button">
          Save draft
        </button>
        <button className="secondary-button" onClick={() => window.print()} type="button">
          Print client receipt
        </button>
        {canEdit ? (
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50"
            onClick={() => removeClientRow(load.id, row.id)}
            type="button"
          >
            <Trash2 className="h-4 w-4" />
            Remove client
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SalesAction({
  canEdit,
  handleSubmitSales,
  isLocked,
  load,
  salesRecord,
  setUnlockRecordId,
  user
}: {
  canEdit: boolean;
  handleSubmitSales: (load: LoadingRecord) => void;
  isLocked: boolean;
  load: LoadingRecord;
  salesRecord?: SalesRecord;
  setUnlockRecordId: (recordId: string) => void;
  user: SessionUser;
}) {
  if (user.role === "admin") {
    if (salesRecord?.locked) {
      return (
        <button
          className="secondary-button"
          onClick={() => setUnlockRecordId(salesRecord.id)}
          type="button"
        >
          <LockOpen className="h-4 w-4" />
          Unlock
        </button>
      );
    }

    return (
      <span className="text-sm font-semibold text-slate-500">
        {salesRecord ? "Unlocked for correction" : "No sales yet"}
      </span>
    );
  }

  if (!canEdit) {
    return (
      <span className="inline-flex rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">
        {isLocked ? "Locked after submission" : "View only"}
      </span>
    );
  }

  return (
    <button
      className="primary-button"
      onClick={() => handleSubmitSales(load)}
      type="button"
    >
      <Send className="h-4 w-4" />
      Submit Load Sales
    </button>
  );
}

function SalesStatusChip({ salesRecord }: { salesRecord?: SalesRecord }) {
  if (!salesRecord) {
    return (
      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700">
        Not Submitted
      </span>
    );
  }

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
        salesRecord.locked
          ? statusChipClass("confirmed")
          : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
    >
      {salesRecord.locked ? "Sales Submitted" : "Unlocked"}
    </span>
  );
}

function FilterField({
  children,
  label
}: {
  children: ReactNode;
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

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-normal text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function Metric({
  label,
  tone = "default",
  value
}: {
  label: string;
  tone?: "danger" | "default";
  value: string;
}) {
  return (
    <div
      className={`rounded-lg px-3 py-2 ${
        tone === "danger"
          ? "border border-red-100 bg-red-50"
          : "border border-brand-100 bg-brand-50"
      }`}
    >
      <span
        className={`block text-xs font-semibold ${
          tone === "danger" ? "text-red-700" : "text-brand-800"
        }`}
      >
        {label}
      </span>
      <span
        className={`mt-1 block font-black ${
          tone === "danger" ? "text-red-800" : "text-brand-900"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function clientLineToDraft(line: ClientSaleLine): ClientSaleDraft {
  const productQuantities = line.productQuantities ?? {
    "500ml": line.itemCode === "WT-500" ? line.quantityCartons : 0,
    "1L": line.itemCode === "WT-1000" ? line.quantityCartons : 0,
    "1.5L": line.itemCode === "WT-1500" ? line.quantityCartons : 0,
    "5L": line.itemCode === "WT-5000" ? line.quantityCartons : 0
  };
  const productKey =
    productGrid.find((product) => Number(productQuantities[product.key]) > 0)
      ?.key ??
    productGrid.find((product) => product.itemCode === line.itemCode)?.key ??
    "500ml";

  return {
    id: line.id,
    clientName: line.clientName,
    clientPhone: line.clientPhone,
    clientLocation: line.clientLocation,
    saleDate: line.saleDate ?? getTodayIsoDate(),
    marketerName: line.marketerName ?? "",
    productKey,
    quantities: {
      "500ml": String(productQuantities["500ml"] ?? ""),
      "1L": String(productQuantities["1L"] ?? ""),
      "1.5L": String(productQuantities["1.5L"] ?? ""),
      "5L": String(productQuantities["5L"] ?? "")
    },
    paymentStatus: normalizePaymentStatus(line.paymentStatus),
    amountPaid: String(line.amountPaid),
    notes: line.notes
  };
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePaymentStatus(status: PaymentStatus): PaymentStatus {
  return status === "Not Paid" ? "Unpaid" : status;
}

function groupConfirmedLoads(loads: LoadingRecord[]) {
  const groups = new Map<string, LoadingRecord[]>();

  loads.forEach((load) => {
    const key = [
      load.date,
      load.truck.trim().toLowerCase(),
      load.marketerUsername.trim().toLowerCase()
    ].join("::");
    groups.set(key, [...(groups.get(key) ?? []), load]);
  });

  return Array.from(groups.entries()).map(([key, groupLoads]) => {
    const firstLoad = groupLoads[0];
    const loadedCartons = groupLoads.reduce(
      (total, load) => total + load.loadedCartons,
      0
    );
    const updatedAt = groupLoads
      .map((load) => load.updatedAt)
      .sort((first, second) => second.localeCompare(first))[0];

    return {
      ...firstLoad,
      id: `GROUP-${key.replace(/[^a-z0-9]+/gi, "-").toUpperCase()}`,
      productName: "Grouped Load",
      itemCode: "LOAD-GROUP",
      pricePerCarton: 0,
      loadedCartons,
      notes: groupLoads.map((load) => `${load.productName}: ${load.loadedCartons}`).join("; "),
      createdAt: firstLoad.createdAt,
      updatedAt
    };
  });
}

function getProductPrice(productKey: ProductGridKey, products: ProductMaster[]) {
  const gridProduct = productGrid.find((product) => product.key === productKey);
  const product = products.find(
    (item) =>
      item.itemCode === gridProduct?.itemCode ||
      item.name.toLowerCase() === gridProduct?.productName.toLowerCase()
  );

  if (!gridProduct) {
    return 0;
  }

  return product
    ? getActivePrice(product.name, product.itemCode)
    : getActivePrice(gridProduct.productName, gridProduct.itemCode);
}

function getProductQuantities(row: ClientSaleDraft) {
  return productGrid.reduce<Record<string, number>>((quantities, product) => {
    quantities[product.key] = toNumber(row.quantities[product.key]);
    return quantities;
  }, {});
}

function getProductAmounts(row: ClientSaleDraft, products: ProductMaster[]) {
  return productGrid.reduce<Record<string, number>>((amounts, product) => {
    amounts[product.key] =
      toNumber(row.quantities[product.key]) * getProductPrice(product.key, products);
    return amounts;
  }, {});
}

function getRowTotalCartons(row: ClientSaleDraft) {
  return productGrid.reduce(
    (total, product) => total + toNumber(row.quantities[product.key]),
    0
  );
}

function getRowTotalAmount(row: ClientSaleDraft, products: ProductMaster[]) {
  return productGrid.reduce(
    (total, product) =>
      total + toNumber(row.quantities[product.key]) * getProductPrice(product.key, products),
    0
  );
}
