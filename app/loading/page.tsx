"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { Boxes, Save, Send } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LoadingRecordsView } from "@/components/LoadingRecordsView";
import { mockUsers } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";
import type { LoadingRecord } from "@/lib/loading-data";
import {
  createRecordId,
  getLoadingRecords,
  getTodayIsoDate,
  logAuditEvent,
  upsertLoadingRecord
} from "@/lib/loading-data";
import {
  getActivePrice,
  getProductsForCompany,
  type ProductMaster
} from "@/lib/products-data";
import { getCompanyWorkspaceId } from "@/lib/companies-data";
import { getPendingOrders, type PendingOrder } from "@/lib/call-center-data";
import { getClientOrders, type ClientPortalOrder } from "@/lib/client-portal-data";

type LoadingFormState = {
  id: string;
  date: string;
  productName: string;
  itemCode: string;
  pricePerCarton: string;
  marketerUsername: string;
  truck: string;
  loadedCartons: string;
  notes: string;
};

const emptyForm: LoadingFormState = {
  id: "",
  date: getTodayIsoDate(),
  productName: "",
  itemCode: "",
  pricePerCarton: "",
  marketerUsername: "marketer1",
  truck: "",
  loadedCartons: "",
  notes: ""
};

const marketers = mockUsers.filter((user) => user.role === "marketer");

export default function LoadingPage() {
  return (
    <AppShell allowedRoles={["admin", "supervisor", "storekeeper"]}>
      {(user) => <LoadingContent user={user} />}
    </AppShell>
  );
}

function LoadingContent({ user }: { user: SessionUser }) {
  const [records, setRecords] = useState<LoadingRecord[]>([]);
  const [products, setProducts] = useState<ProductMaster[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [clientOrders, setClientOrders] = useState<ClientPortalOrder[]>([]);
  const [form, setForm] = useState<LoadingFormState>(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const productMaster = getProductsForCompany(getCompanyWorkspaceId(user));
    setProducts(productMaster);
    setForm((current) => {
      if (current.productName || productMaster.length === 0) {
        return current;
      }

      return {
        ...current,
        productName: productMaster[0].name,
        itemCode: productMaster[0].itemCode,
        pricePerCarton: String(
          getActivePrice(
            productMaster[0].name,
            productMaster[0].itemCode,
            current.date
          )
        )
      };
    });
    setRecords(getLoadingRecords());
    setPendingOrders(getPendingOrders());
    setClientOrders(getClientOrders().filter((order) => order.status === "Approved"));
  }, [user]);

  const visibleRecords = useMemo(() => {
    if (user.role === "admin" || user.role === "supervisor") {
      return records;
    }

    return records.filter(
      (record) =>
        record.storekeeperUsername === user.username && record.status !== "draft"
    );
  }, [records, user.role, user.username]);

  function getProductPriceForDate(product: ProductMaster, date: string) {
    return String(getActivePrice(product.name, product.itemCode, date));
  }

  function updateField(field: keyof LoadingFormState, value: string) {
    if (field === "date") {
      setForm((current) => {
        const selectedProduct = products.find(
          (product) => product.name === current.productName
        );

        return {
          ...current,
          date: value,
          pricePerCarton: selectedProduct
            ? getProductPriceForDate(selectedProduct, value)
            : current.pricePerCarton
        };
      });
      return;
    }

    setForm((current) => ({ ...current, [field]: value }));
  }

  function selectProduct(productName: string) {
    const selectedProduct = products.find(
      (product) => product.name === productName
    );

    setForm((current) => ({
      ...current,
      productName,
      itemCode: selectedProduct?.itemCode ?? current.itemCode,
      pricePerCarton: selectedProduct
        ? getProductPriceForDate(selectedProduct, current.date)
        : current.pricePerCarton
    }));
  }

  function resetForm() {
    const firstProduct = products[0];

    setForm({
      ...emptyForm,
      date: getTodayIsoDate(),
      productName: firstProduct?.name ?? "",
      itemCode: firstProduct?.itemCode ?? "",
      pricePerCarton: firstProduct
        ? getProductPriceForDate(firstProduct, getTodayIsoDate())
        : ""
    });
  }

  function validateForm() {
    if (!form.date || !form.productName.trim() || !form.itemCode.trim()) {
      return "Date, product name, and item code are required.";
    }

    if (!form.pricePerCarton || Number(form.pricePerCarton) <= 0) {
      return "Price per carton must be greater than zero.";
    }

    if (!form.loadedCartons || Number(form.loadedCartons) <= 0) {
      return "Loaded cartons must be greater than zero.";
    }

    if (!form.truck.trim()) {
      return "Truck / vehicle is required.";
    }

    return "";
  }

  function buildRecord(status: "draft" | "pending"): LoadingRecord {
    const existingRecord = records.find((record) => record.id === form.id);
    const selectedMarketer = marketers.find(
      (marketer) => marketer.username === form.marketerUsername
    );
    const now = new Date().toISOString();

    return {
      id: form.id || createRecordId(),
      date: form.date,
      productName: form.productName.trim(),
      itemCode: form.itemCode.trim(),
      pricePerCarton: Number(form.pricePerCarton),
      marketerUsername: selectedMarketer?.username ?? form.marketerUsername,
      marketerName: selectedMarketer?.displayName ?? form.marketerUsername,
      truck: form.truck.trim(),
      loadedCartons: Number(form.loadedCartons),
      notes: form.notes.trim(),
      status,
      storekeeperUsername:
        existingRecord?.storekeeperUsername ?? user.username,
      storekeeperName: existingRecord?.storekeeperName ?? user.displayName,
      locked: existingRecord?.locked ?? false,
      rejectionReason: status === "pending" ? "" : existingRecord?.rejectionReason,
      submittedAt: status === "pending" ? now : existingRecord?.submittedAt,
      createdAt: existingRecord?.createdAt ?? now,
      updatedAt: now
    };
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    const record = buildRecord("draft");
    const updatedRecords = upsertLoadingRecord(record);
    logAuditEvent({
      action: "loading_created",
      companyId: user.companyId,
      companyName: user.companyName,
      module: "Loading",
      newValue: record,
      recordId: record.id,
      reason: "Loading record saved as draft",
      status: "success",
      user
    });
    setRecords(updatedRecords);
    setForm((current) => ({ ...current, id: record.id }));
    setMessage("Loading record saved as draft.");
  }

  function handleSubmitRecord() {
    setMessage("");
    setError("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    const record = buildRecord("pending");
    const updatedRecords = upsertLoadingRecord(record);
    logAuditEvent({
      action: "loading_submitted",
      companyId: user.companyId,
      companyName: user.companyName,
      module: "Loading",
      newValue: record,
      recordId: record.id,
      reason: "Loading record submitted for marketer confirmation",
      status: "success",
      user
    });
    setRecords(updatedRecords);
    resetForm();
    setMessage("Loading record submitted for marketer confirmation.");
  }

  function loadRejectedRecord(record: LoadingRecord) {
    setForm({
      id: record.id,
      date: record.date,
      productName: record.productName,
      itemCode: record.itemCode,
      pricePerCarton: String(record.pricePerCarton),
      marketerUsername: record.marketerUsername,
      truck: record.truck,
      loadedCartons: String(record.loadedCartons),
      notes: record.notes
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const rejectedRecords = visibleRecords.filter(
    (record) => record.status === "rejected" && !record.locked
  );

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-950">Stock Loading</h2>
            <p className="mt-1 text-sm text-slate-600">
              Create, save, and submit loading records for marketer confirmation.
            </p>
          </div>
        </div>
      </div>

      {user.role === "storekeeper" || user.role === "admin" ? (
        <form
          className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm sm:p-6"
          onSubmit={handleSave}
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Date">
              <input
                className="form-input"
                onChange={(event) => updateField("date", event.target.value)}
                type="date"
                value={form.date}
              />
            </Field>
            <Field label="Product name">
              <select
                className="form-input"
                onChange={(event) => selectProduct(event.target.value)}
                value={form.productName}
              >
                {products.map((product) => (
                  <option key={product.itemCode} value={product.name}>
                    {product.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Item code">
              <input
                className="form-input"
                readOnly
                value={form.itemCode}
              />
            </Field>
            <Field label="Price per carton">
              <input
                className={`form-input ${
                  user.role === "admin" ? "" : "bg-slate-50 text-slate-700"
                }`}
                min="1"
                onChange={(event) =>
                  updateField("pricePerCarton", event.target.value)
                }
                placeholder="0"
                readOnly={user.role !== "admin"}
                type="number"
                value={form.pricePerCarton}
              />
            </Field>
            <Field label="Marketer name">
              <select
                className="form-input"
                onChange={(event) =>
                  updateField("marketerUsername", event.target.value)
                }
                value={form.marketerUsername}
              >
                {marketers.map((marketer) => (
                  <option key={marketer.username} value={marketer.username}>
                    {marketer.displayName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Truck / vehicle">
              <input
                className="form-input"
                onChange={(event) => updateField("truck", event.target.value)}
                placeholder="Example: RAB 123A"
                value={form.truck}
              />
            </Field>
            <Field label="Loaded cartons">
              <input
                className="form-input"
                min="1"
                onChange={(event) =>
                  updateField("loadedCartons", event.target.value)
                }
                placeholder="0"
                type="number"
                value={form.loadedCartons}
              />
            </Field>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Notes
              </span>
              <textarea
                className="min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
                onChange={(event) => updateField("notes", event.target.value)}
                placeholder="Optional loading notes"
                value={form.notes}
              />
            </label>
          </div>

          {error ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              {message}
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand-200 px-4 py-2.5 text-sm font-bold text-brand-800 transition hover:bg-brand-50"
              type="submit"
            >
              <Save className="h-4 w-4" />
              Save loading record
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-800"
              onClick={handleSubmitRecord}
              type="button"
            >
              <Send className="h-4 w-4" />
              Submit loading record
            </button>
          </div>
        </form>
      ) : null}

      {(user.role === "storekeeper" || user.role === "admin") && pendingOrders.length > 0 ? (
        <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-slate-950">Pending Orders from Customer Care & Relationship Management (CCRM)</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pendingOrders.map((order) => (
              <article className="rounded-lg border border-brand-100 bg-brand-50 p-4" key={order.id}>
                <h4 className="font-bold text-brand-950">{order.clientName}</h4>
                <p className="mt-1 text-sm font-semibold text-slate-600">{order.phone} - {order.area}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <Info label="Product" value={order.product} />
                  <Info label="Quantity" value={order.quantity.toLocaleString()} />
                  <Info label="Delivery" value={order.deliveryDate} />
                  <Info label="Reference" value={order.id} />
                </div>
                {order.notes ? <p className="mt-3 text-sm text-slate-600">{order.notes}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {(user.role === "storekeeper" || user.role === "admin") && clientOrders.length > 0 ? (
        <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-slate-950">Approved Client Portal Orders for Loading</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {clientOrders.map((order) => (
              <article className="rounded-lg border border-brand-100 bg-brand-50 p-4" key={order.id}>
                <h4 className="font-bold text-brand-950">{order.clientName}</h4>
                <p className="mt-1 text-sm font-semibold text-slate-600">{order.phone} - {order.location}</p>
                <p className="mt-3 font-bold text-brand-800">{order.totalQuantity} cartons</p>
                <p className="text-sm text-slate-600">Reference: {order.id}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {(user.role === "storekeeper" || user.role === "admin") &&
      rejectedRecords.length > 0 ? (
        <div className="rounded-lg border border-red-100 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-slate-950">Rejected records to correct</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {rejectedRecords.map((record) => (
              <button
                className="rounded-lg border border-red-100 bg-red-50 p-4 text-left transition hover:border-red-200"
                key={record.id}
                onClick={() => loadRejectedRecord(record)}
                type="button"
              >
                <span className="block font-bold text-slate-950">
                  {record.productName}
                </span>
                <span className="mt-1 block text-sm font-medium text-red-700">
                  {record.rejectionReason}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <h3 className="mb-3 text-lg font-bold text-slate-950">
          {user.role === "admin" ? "All loading records" : "Submitted records"}
        </h3>
        <LoadingRecordsView
          emptyMessage="No submitted loading records yet."
          onRecordsChange={setRecords}
          records={visibleRecords}
          showAdminFilters={user.role === "admin"}
          user={user}
        />
      </div>
    </div>
  );
}

function Field({
  children,
  label
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-xs font-semibold uppercase tracking-normal text-brand-700">
        {label}
      </span>
      <span className="font-bold text-slate-950">{value}</span>
    </div>
  );
}
