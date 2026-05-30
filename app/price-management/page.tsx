"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, History } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { SessionUser } from "@/lib/auth";
import { getTodayIsoDate, formatDate, formatDateTime } from "@/lib/loading-data";
import { formatMoney } from "@/lib/sales-data";
import {
  getActivePrice,
  getPriceHistory,
  getProducts,
  updateProductPrice,
  type PriceHistoryEntry,
  type ProductMaster
} from "@/lib/products-data";

type PriceFormState = {
  effectiveDate: string;
  newPrice: string;
  reason: string;
};

export default function PriceManagementPage() {
  return (
    <AppShell allowedRoles={["admin"]}>
      {(user) => <PriceManagementContent user={user} />}
    </AppShell>
  );
}

function PriceManagementContent({ user }: { user: SessionUser }) {
  const [products, setProducts] = useState<ProductMaster[]>([]);
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [forms, setForms] = useState<Record<string, PriceFormState>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const productMaster = getProducts();
    const today = getTodayIsoDate();

    setProducts(productMaster);
    setHistory(getPriceHistory());
    setForms(
      Object.fromEntries(
        productMaster.map((product) => [
          product.itemCode,
          {
            effectiveDate: today,
            newPrice: String(
              getActivePrice(product.name, product.itemCode, today)
            ),
            reason: ""
          }
        ])
      )
    );
  }, []);

  const currentPrices = useMemo(() => {
    return Object.fromEntries(
      products.map((product) => [
        product.itemCode,
        getActivePrice(product.name, product.itemCode)
      ])
    );
  }, [history, products]);

  function updateForm(
    itemCode: string,
    field: keyof PriceFormState,
    value: string
  ) {
    setForms((current) => ({
      ...current,
      [itemCode]: {
        ...current[itemCode],
        [field]: value
      }
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>, product: ProductMaster) {
    event.preventDefault();
    setMessage("");
    setError("");

    const form = forms[product.itemCode];
    const newPrice = Number(form?.newPrice);

    if (!form?.effectiveDate) {
      setError("Effective date is required.");
      return;
    }

    if (!newPrice || newPrice <= 0) {
      setError("New price must be greater than zero.");
      return;
    }

    updateProductPrice({
      effectiveDate: form.effectiveDate,
      newPrice,
      product,
      reason: form.reason,
      user
    });

    setHistory(getPriceHistory());
    setForms((current) => ({
      ...current,
      [product.itemCode]: {
        effectiveDate: getTodayIsoDate(),
        newPrice: String(getActivePrice(product.name, product.itemCode)),
        reason: ""
      }
    }));
    setMessage(`${product.name} price updated successfully.`);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <BadgeDollarSign className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-950">
              Price Management
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Update carton prices for official products while keeping past
              transactions unchanged.
            </p>
          </div>
        </div>
      </div>

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

      <section className="rounded-lg border border-brand-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-bold text-slate-950">
            Product Price Table
          </h3>
        </div>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-50 text-xs uppercase tracking-normal text-brand-800">
              <tr>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3">Item Code</th>
                <th className="px-4 py-3 text-right">
                  Current Price Per Carton
                </th>
                <th className="px-4 py-3">New Price</th>
                <th className="px-4 py-3">Effective Date</th>
                <th className="px-4 py-3">Reason / Notes</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((product) => (
                <tr key={product.itemCode}>
                  <td className="px-4 py-3 font-bold text-slate-950">
                    {product.name}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-600">
                    {product.itemCode}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-brand-800">
                    {formatMoney(currentPrices[product.itemCode] ?? 0)}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      className="form-input min-w-28"
                      min="1"
                      onChange={(event) =>
                        updateForm(product.itemCode, "newPrice", event.target.value)
                      }
                      type="number"
                      value={forms[product.itemCode]?.newPrice ?? ""}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      className="form-input min-w-36"
                      onChange={(event) =>
                        updateForm(
                          product.itemCode,
                          "effectiveDate",
                          event.target.value
                        )
                      }
                      type="date"
                      value={forms[product.itemCode]?.effectiveDate ?? ""}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      className="form-input min-w-48"
                      onChange={(event) =>
                        updateForm(product.itemCode, "reason", event.target.value)
                      }
                      placeholder="Optional note"
                      value={forms[product.itemCode]?.reason ?? ""}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form onSubmit={(event) => handleSubmit(event, product)}>
                      <button
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-800"
                        type="submit"
                      >
                        <BadgeDollarSign className="h-4 w-4" />
                        Update Price
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 p-4 lg:hidden">
          {products.map((product) => (
            <form
              className="rounded-lg border border-slate-100 bg-slate-50 p-4"
              key={product.itemCode}
              onSubmit={(event) => handleSubmit(event, product)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-950">{product.name}</h4>
                  <p className="text-sm font-semibold text-slate-500">
                    {product.itemCode}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold uppercase tracking-normal text-slate-500">
                    Current
                  </p>
                  <p className="font-bold text-brand-800">
                    {formatMoney(currentPrices[product.itemCode] ?? 0)}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                <Field label="New Price">
                  <input
                    className="form-input"
                    min="1"
                    onChange={(event) =>
                      updateForm(product.itemCode, "newPrice", event.target.value)
                    }
                    type="number"
                    value={forms[product.itemCode]?.newPrice ?? ""}
                  />
                </Field>
                <Field label="Effective Date">
                  <input
                    className="form-input"
                    onChange={(event) =>
                      updateForm(
                        product.itemCode,
                        "effectiveDate",
                        event.target.value
                      )
                    }
                    type="date"
                    value={forms[product.itemCode]?.effectiveDate ?? ""}
                  />
                </Field>
                <Field label="Reason / Notes">
                  <input
                    className="form-input"
                    onChange={(event) =>
                      updateForm(product.itemCode, "reason", event.target.value)
                    }
                    placeholder="Optional note"
                    value={forms[product.itemCode]?.reason ?? ""}
                  />
                </Field>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-800"
                  type="submit"
                >
                  <BadgeDollarSign className="h-4 w-4" />
                  Update Price
                </button>
              </div>
            </form>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-brand-100 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <History className="h-5 w-5 text-brand-700" />
          <h3 className="text-lg font-bold text-slate-950">
            Price History Table
          </h3>
        </div>
        {history.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm font-semibold text-slate-500">
            No price changes yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-brand-50 text-xs uppercase tracking-normal text-brand-800">
                <tr>
                  <th className="px-4 py-3">Date Changed</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Item Code</th>
                  <th className="px-4 py-3 text-right">Old Price</th>
                  <th className="px-4 py-3 text-right">New Price</th>
                  <th className="px-4 py-3">Effective Date</th>
                  <th className="px-4 py-3">Changed By</th>
                  <th className="px-4 py-3">Reason / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDateTime(entry.changedAt)}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-950">
                      {entry.productName}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-600">
                      {entry.itemCode}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatMoney(entry.oldPrice)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-brand-800">
                      {formatMoney(entry.newPrice)}
                    </td>
                    <td className="px-4 py-3">{formatDate(entry.effectiveDate)}</td>
                    <td className="px-4 py-3">{entry.changedBy}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {entry.reason || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
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
