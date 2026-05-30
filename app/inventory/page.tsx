"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Boxes, History, PackagePlus, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { SessionUser } from "@/lib/auth";
import { formatDate, getLoadingRecords } from "@/lib/loading-data";
import type { LoadingRecord } from "@/lib/loading-data";
import { getReturnRecords } from "@/lib/returns-data";
import type { ReturnRecord } from "@/lib/returns-data";
import {
  addInventoryAdjustment,
  addInventoryMovement,
  getGeneratedInventoryMovements,
  getInventoryDashboardTotals,
  getInventoryMovements,
  getInventoryRows,
  getMinimumStocks,
  productKey,
  saveMinimumStock
} from "@/lib/inventory-data";
import type {
  InventoryMovement,
  InventoryRow,
  MinimumStock
} from "@/lib/inventory-data";
import { getProducts, type ProductMaster } from "@/lib/products-data";

type StockForm = {
  date: string;
  productName: string;
  itemCode: string;
  quantity: string;
  supplier: string;
  notes: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyStockForm: StockForm = {
  date: today(),
  productName: "",
  itemCode: "",
  quantity: "",
  supplier: "",
  notes: ""
};

export default function InventoryPage() {
  return (
    <AppShell allowedRoles={["admin", "storekeeper", "manager", "supervisor"]}>
      {(user) => <InventoryContent user={user} />}
    </AppShell>
  );
}

function InventoryContent({ user }: { user: SessionUser }) {
  const [loadingRecords, setLoadingRecords] = useState<LoadingRecord[]>([]);
  const [returnRecords, setReturnRecords] = useState<ReturnRecord[]>([]);
  const [manualMovements, setManualMovements] = useState<InventoryMovement[]>([]);
  const [minimumStocks, setMinimumStocks] = useState<MinimumStock[]>([]);
  const [products, setProducts] = useState<ProductMaster[]>([]);
  const [openingForm, setOpeningForm] = useState<StockForm>(emptyStockForm);
  const [receivedForm, setReceivedForm] = useState<StockForm>(emptyStockForm);
  const [minimumForm, setMinimumForm] = useState({
    productName: "",
    itemCode: "",
    minimumStock: ""
  });
  const [adjustmentForm, setAdjustmentForm] = useState({
    productName: "",
    itemCode: "",
    adjustmentType: "Add",
    quantity: "",
    reason: ""
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setProducts(getProducts());
    setLoadingRecords(getLoadingRecords());
    setReturnRecords(getReturnRecords());
    setManualMovements(getInventoryMovements());
    setMinimumStocks(getMinimumStocks());
  }, []);

  const rows = useMemo(
    () =>
      getInventoryRows({
        loadingRecords,
        manualMovements,
        minimumStocks,
        returnRecords
      }),
    [loadingRecords, manualMovements, minimumStocks, returnRecords]
  );

  const totals = useMemo(() => getInventoryDashboardTotals(rows), [rows]);

  const history = useMemo(() => {
    return [
      ...manualMovements,
      ...getGeneratedInventoryMovements(loadingRecords, returnRecords)
    ].sort((a, b) => b.date.localeCompare(a.date));
  }, [loadingRecords, manualMovements, returnRecords]);

  function updateStockForm(
    setter: React.Dispatch<React.SetStateAction<StockForm>>,
    field: keyof StockForm,
    value: string
  ) {
    setter((current) => ({ ...current, [field]: value }));
  }

  function submitMovement(
    event: FormEvent<HTMLFormElement>,
    form: StockForm,
    movementType: "Opening Stock" | "Stock Received",
    reset: () => void
  ) {
    event.preventDefault();
    setMessage("");
    setError("");

    const quantity = Number(form.quantity);

    if (!form.productName.trim() || !form.itemCode.trim()) {
      setError("Product name and item code are required.");
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Quantity must be greater than zero.");
      return;
    }

    setManualMovements(
      addInventoryMovement({
        date: form.date,
        productName: form.productName.trim(),
        itemCode: form.itemCode.trim(),
        movementType,
        quantity,
        reference: movementType === "Stock Received" ? form.supplier.trim() : "Opening",
        user: user.displayName,
        notes: form.notes.trim()
      })
    );
    reset();
    setMessage(`${movementType} saved.`);
  }

  function submitMinimumStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const minimumStock = Number(minimumForm.minimumStock);

    if (!minimumForm.productName.trim() || !minimumForm.itemCode.trim()) {
      setError("Product name and item code are required.");
      return;
    }

    if (!Number.isFinite(minimumStock) || minimumStock < 0) {
      setError("Minimum stock cannot be negative.");
      return;
    }

    setMinimumStocks(
      saveMinimumStock({
        productKey: productKey(minimumForm.productName, minimumForm.itemCode),
        productName: minimumForm.productName.trim(),
        itemCode: minimumForm.itemCode.trim(),
        minimumStock
      })
    );
    setMinimumForm({ productName: "", itemCode: "", minimumStock: "" });
    setMessage("Minimum stock saved.");
  }

  function submitAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const quantity = Number(adjustmentForm.quantity);

    if (!adjustmentForm.productName.trim() || !adjustmentForm.itemCode.trim()) {
      setError("Product name and item code are required.");
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Adjustment quantity must be greater than zero.");
      return;
    }

    if (!adjustmentForm.reason.trim()) {
      setError("Adjustment reason is required.");
      return;
    }

    setManualMovements(
      addInventoryAdjustment({
        adjustmentType: adjustmentForm.adjustmentType as "Add" | "Remove",
        itemCode: adjustmentForm.itemCode.trim(),
        productName: adjustmentForm.productName.trim(),
        quantity,
        reason: adjustmentForm.reason.trim(),
        user
      })
    );
    setAdjustmentForm({
      productName: "",
      itemCode: "",
      adjustmentType: "Add",
      quantity: "",
      reason: ""
    });
    setMessage("Inventory adjustment saved.");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-950">
              Warehouse Inventory
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Track warehouse stock before and after loading, receipts, and returns.
            </p>
          </div>
        </div>
      </div>

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Total Warehouse Stock" value={totals.totalWarehouseStock} />
        <SummaryCard label="Low Stock Items" value={totals.lowStockItems} warning />
        <SummaryCard label="Out of Stock Items" value={totals.outOfStockItems} danger />
      </div>

      <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold text-slate-950">Product Master</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {products.map((product) => (
            <article
              className="rounded-lg border border-brand-100 bg-brand-50 p-4"
              key={product.itemCode}
            >
              <h4 className="font-bold text-brand-900">{product.name}</h4>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                {product.itemCode}
              </p>
              <p className="mt-3 text-sm text-slate-600">
                {product.category} · {product.unit}
              </p>
              <p className="mt-2 text-sm font-semibold text-brand-800">
                Minimum: {product.minimumStock} cartons
              </p>
            </article>
          ))}
        </div>
      </section>

      {user.role === "storekeeper" || user.role === "admin" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <StockMovementForm
            form={openingForm}
            icon={<SlidersHorizontal className="h-5 w-5" />}
            onChange={(field, value) =>
              updateStockForm(setOpeningForm, field, value)
            }
            onSubmit={(event) =>
              submitMovement(event, openingForm, "Opening Stock", () =>
                setOpeningForm({ ...emptyStockForm, date: today() })
              )
            }
            products={products}
            title="Set Opening Stock"
          />
          <StockMovementForm
            form={receivedForm}
            icon={<PackagePlus className="h-5 w-5" />}
            onChange={(field, value) =>
              updateStockForm(setReceivedForm, field, value)
            }
            onSubmit={(event) =>
              submitMovement(event, receivedForm, "Stock Received", () =>
                setReceivedForm({ ...emptyStockForm, date: today() })
              )
            }
            products={products}
            showSupplier
            title="Add Stock Received"
          />
        </div>
      ) : null}

      {user.role === "admin" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <form
            className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm"
            onSubmit={submitMinimumStock}
          >
            <h3 className="font-bold text-slate-950">Minimum Stock Alert</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <ProductSelect
                label="Product Name"
                onChange={(product) =>
                  setMinimumForm((current) => ({
                    ...current,
                    productName: product.name,
                    itemCode: product.itemCode,
                    minimumStock: String(product.minimumStock)
                  }))
                }
                products={products}
                value={minimumForm.productName}
              />
              <Input
                label="Item Code"
                onChange={(value) =>
                  setMinimumForm((current) => ({ ...current, itemCode: value }))
                }
                value={minimumForm.itemCode}
              />
              <Input
                label="Minimum Stock"
                onChange={(value) =>
                  setMinimumForm((current) => ({ ...current, minimumStock: value }))
                }
                type="number"
                value={minimumForm.minimumStock}
              />
            </div>
            <button className="mt-4 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-800">
              Save minimum stock
            </button>
          </form>

          <form
            className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm"
            onSubmit={submitAdjustment}
          >
            <h3 className="font-bold text-slate-950">Admin Adjustment</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <ProductSelect
                label="Product"
                onChange={(product) =>
                  setAdjustmentForm((current) => ({
                    ...current,
                    productName: product.name,
                    itemCode: product.itemCode
                  }))
                }
                products={products}
                value={adjustmentForm.productName}
              />
              <Input
                label="Item Code"
                onChange={(value) =>
                  setAdjustmentForm((current) => ({ ...current, itemCode: value }))
                }
                value={adjustmentForm.itemCode}
              />
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Adjustment Type
                </span>
                <select
                  className="form-input"
                  onChange={(event) =>
                    setAdjustmentForm((current) => ({
                      ...current,
                      adjustmentType: event.target.value
                    }))
                  }
                  value={adjustmentForm.adjustmentType}
                >
                  <option>Add</option>
                  <option>Remove</option>
                </select>
              </label>
              <Input
                label="Quantity"
                onChange={(value) =>
                  setAdjustmentForm((current) => ({ ...current, quantity: value }))
                }
                type="number"
                value={adjustmentForm.quantity}
              />
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Reason
                </span>
                <textarea
                  className="min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
                  onChange={(event) =>
                    setAdjustmentForm((current) => ({
                      ...current,
                      reason: event.target.value
                    }))
                  }
                  value={adjustmentForm.reason}
                />
              </label>
            </div>
            <button className="mt-4 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-800">
              Save adjustment
            </button>
          </form>
        </div>
      ) : null}

      <section className="rounded-lg border border-brand-100 bg-white shadow-sm">
        <div className="border-b border-brand-100 p-5">
          <h3 className="text-lg font-bold text-slate-950">Product Stock</h3>
        </div>
        <InventoryTable rows={rows} />
      </section>

      <section className="rounded-lg border border-brand-100 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-brand-100 p-5">
          <History className="h-5 w-5 text-brand-700" />
          <h3 className="text-lg font-bold text-slate-950">
            Inventory Movement History
          </h3>
        </div>
        <HistoryTable records={history} />
      </section>
    </div>
  );
}

function StockMovementForm({
  form,
  icon,
  onChange,
  onSubmit,
  products,
  showSupplier = false,
  title
}: {
  form: StockForm;
  icon: React.ReactNode;
  onChange: (field: keyof StockForm, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  products: ProductMaster[];
  showSupplier?: boolean;
  title: string;
}) {
  return (
    <form
      className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm"
      onSubmit={onSubmit}
    >
      <div className="flex items-center gap-2">
        <div className="text-brand-700">{icon}</div>
        <h3 className="font-bold text-slate-950">{title}</h3>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Input
          label="Date"
          onChange={(value) => onChange("date", value)}
          type="date"
          value={form.date}
        />
        <ProductSelect
          label="Product Name"
          onChange={(product) => {
            onChange("productName", product.name);
            onChange("itemCode", product.itemCode);
          }}
          products={products}
          value={form.productName}
        />
        <Input
          label="Item Code"
          onChange={(value) => onChange("itemCode", value)}
          value={form.itemCode}
        />
        <Input
          label="Quantity"
          onChange={(value) => onChange("quantity", value)}
          type="number"
          value={form.quantity}
        />
        {showSupplier ? (
          <Input
            label="Supplier / Factory"
            onChange={(value) => onChange("supplier", value)}
            value={form.supplier}
          />
        ) : null}
        <Input
          label="Notes"
          onChange={(value) => onChange("notes", value)}
          value={form.notes}
        />
      </div>
      <button className="mt-4 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-800">
        Save
      </button>
    </form>
  );
}

function ProductSelect({
  label,
  onChange,
  products,
  value
}: {
  label: string;
  onChange: (product: ProductMaster) => void;
  products: ProductMaster[];
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      <select
        className="form-input"
        onChange={(event) => {
          const selectedProduct = products.find(
            (product) => product.name === event.target.value
          );

          if (selectedProduct) {
            onChange(selectedProduct);
          }
        }}
        value={value}
      >
        <option value="">Select product</option>
        {products.map((product) => (
          <option key={product.itemCode} value={product.name}>
            {product.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto xl:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-50 text-xs font-bold uppercase tracking-normal text-brand-900">
            <tr>
              <th className="px-4 py-3">Product Name</th>
              <th className="px-4 py-3">Item Code</th>
              <th className="px-4 py-3 text-right">Opening Stock</th>
              <th className="px-4 py-3 text-right">Received Stock</th>
              <th className="px-4 py-3 text-right">Loaded Out</th>
              <th className="px-4 py-3 text-right">Actual Returns</th>
              <th className="px-4 py-3 text-right">Closing Stock</th>
              <th className="px-4 py-3">Stock Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.productKey}>
                <td className="px-4 py-3 font-semibold text-slate-950">
                  {row.productName}
                </td>
                <td className="px-4 py-3 text-slate-700">{row.itemCode}</td>
                <td className="px-4 py-3 text-right">{row.openingStock}</td>
                <td className="px-4 py-3 text-right">{row.receivedStock}</td>
                <td className="px-4 py-3 text-right">{row.loadedOut}</td>
                <td className="px-4 py-3 text-right">{row.actualReturns}</td>
                <td className="px-4 py-3 text-right font-bold text-brand-800">
                  {row.closingStock}
                </td>
                <td className="px-4 py-3">
                  <StockStatusChip status={row.stockStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 p-4 xl:hidden">
        {rows.map((row) => (
          <article
            className="rounded-lg border border-brand-100 p-4"
            key={row.productKey}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-bold text-slate-950">{row.productName}</h4>
                <p className="text-sm text-slate-600">{row.itemCode}</p>
              </div>
              <StockStatusChip status={row.stockStatus} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Info label="Opening" value={row.openingStock} />
              <Info label="Received" value={row.receivedStock} />
              <Info label="Loaded Out" value={row.loadedOut} />
              <Info label="Actual Returns" value={row.actualReturns} />
              <Info label="Closing" value={row.closingStock} strong />
            </div>
          </article>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="p-8 text-center text-sm font-semibold text-slate-500">
          No inventory records yet.
        </div>
      ) : null}
    </>
  );
}

function HistoryTable({ records }: { records: InventoryMovement[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-brand-50 text-xs font-bold uppercase tracking-normal text-brand-900">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Product</th>
            <th className="px-4 py-3">Item Code</th>
            <th className="px-4 py-3">Movement Type</th>
            <th className="px-4 py-3 text-right">Quantity</th>
            <th className="px-4 py-3">Reference</th>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {records.map((record) => (
            <tr key={record.id}>
              <td className="px-4 py-3">{formatDate(record.date)}</td>
              <td className="px-4 py-3 font-semibold text-slate-950">
                {record.productName}
              </td>
              <td className="px-4 py-3">{record.itemCode}</td>
              <td className="px-4 py-3">{record.movementType}</td>
              <td className="px-4 py-3 text-right font-semibold">
                {record.quantity}
              </td>
              <td className="px-4 py-3">{record.reference}</td>
              <td className="px-4 py-3">{record.user}</td>
              <td className="px-4 py-3">{record.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {records.length === 0 ? (
        <div className="p-8 text-center text-sm font-semibold text-slate-500">
          No inventory movement history yet.
        </div>
      ) : null}
    </div>
  );
}

function StockStatusChip({ status }: { status: InventoryRow["stockStatus"] }) {
  const className =
    status === "Out of Stock"
      ? "border-red-200 bg-red-50 text-red-700"
      : status === "Low Stock"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${className}`}>
      {status}
    </span>
  );
}

function SummaryCard({
  danger = false,
  label,
  value,
  warning = false
}: {
  danger?: boolean;
  label: string;
  value: number;
  warning?: boolean;
}) {
  const color = danger
    ? "text-red-700"
    : warning
      ? "text-amber-700"
      : "text-brand-800";

  return (
    <article className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className={`mt-3 text-3xl font-bold ${color}`}>{value}</p>
    </article>
  );
}

function Input({
  label,
  onChange,
  type = "text",
  value
}: {
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      <input
        className="form-input"
        min={type === "number" ? "0" : undefined}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  );
}

function Info({
  label,
  strong = false,
  value
}: {
  label: string;
  strong?: boolean;
  value: number;
}) {
  return (
    <div>
      <span className="block text-xs font-semibold uppercase tracking-normal text-slate-500">
        {label}
      </span>
      <span className={`font-semibold ${strong ? "text-brand-800" : "text-slate-900"}`}>
        {value}
      </span>
    </div>
  );
}
