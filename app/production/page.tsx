"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Droplets, Hammer, History } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { SessionUser } from "@/lib/auth";
import { getCompanies, getCompanyWorkspaceId, type Company } from "@/lib/companies-data";
import {
  getInventoryMovements,
  getInventoryRows,
  getMinimumStocks,
  productKey,
  type InventoryRow
} from "@/lib/inventory-data";
import { formatDate, getLoadingRecords } from "@/lib/loading-data";
import { hasPermission } from "@/lib/permissions";
import {
  addProductionRecord,
  getProductionRecords,
  getUtilityRecords,
  piecesPerCartonOf,
  planProductionUsage,
  saveUtilityRecord,
  voidProductionRecord,
  type ProductionRecord,
  type UtilityRecord
} from "@/lib/production-data";
import { getProductsForCompany, type ProductMaster } from "@/lib/products-data";
import {
  formatPacks,
  getRawMaterialMinimums,
  getRawMaterialMovements,
  getRawMaterialRows,
  getRawMaterialsForCompany,
  type RawMaterialMaster,
  type RawMaterialRow
} from "@/lib/raw-materials-data";
import { getReturnRecords } from "@/lib/returns-data";

const today = () => new Date().toISOString().slice(0, 10);
const formatNumber = (value: number) => (Math.round(value * 100) / 100).toLocaleString();

export default function ProductionPage() {
  return <AppShell>{(user) => <ProductionContent user={user} />}</AppShell>;
}

function ProductionContent({ user }: { user: SessionUser }) {
  const workspaceCompanyId = getCompanyWorkspaceId(user);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [products, setProducts] = useState<ProductMaster[]>([]);
  const [materials, setMaterials] = useState<RawMaterialMaster[]>([]);
  const [materialRows, setMaterialRows] = useState<RawMaterialRow[]>([]);
  const [inventoryRows, setInventoryRows] = useState<InventoryRow[]>([]);
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [utilities, setUtilities] = useState<UtilityRecord[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const canRecord = hasPermission(user, "production.record");
  const canCancel = hasPermission(user, "production.cancel");

  function loadData(activeCompanyId: string) {
    const companyMaterials = getRawMaterialsForCompany(activeCompanyId);
    setProducts(getProductsForCompany(activeCompanyId));
    setMaterials(companyMaterials);
    setMaterialRows(
      getRawMaterialRows({
        companyId: activeCompanyId,
        materials: companyMaterials,
        minimums: getRawMaterialMinimums().filter((minimum) => minimum.companyId === activeCompanyId),
        movements: getRawMaterialMovements().filter((movement) => movement.companyId === activeCompanyId)
      })
    );
    setInventoryRows(
      getInventoryRows({
        loadingRecords: getLoadingRecords(),
        manualMovements: getInventoryMovements(),
        minimumStocks: getMinimumStocks(),
        returnRecords: getReturnRecords()
      })
    );
    setRecords(getProductionRecords().filter((record) => record.companyId === activeCompanyId));
    setUtilities(getUtilityRecords().filter((record) => record.companyId === activeCompanyId));
  }

  useEffect(() => {
    const companyList = getCompanies();
    const initialCompanyId =
      workspaceCompanyId && workspaceCompanyId !== "all" ? workspaceCompanyId : companyList[0]?.id ?? "";

    setCompanies(companyList);
    setCompanyId(initialCompanyId);
    loadData(initialCompanyId);

    function refresh() {
      loadData(initialCompanyId);
    }

    window.addEventListener("kingapp:data-synced", refresh);
    return () => window.removeEventListener("kingapp:data-synced", refresh);
  }, [workspaceCompanyId]);

  function changeCompany(nextCompanyId: string) {
    setCompanyId(nextCompanyId);
    setMessage("");
    setError("");
    loadData(nextCompanyId);
  }

  function showResult(text: string) {
    setError("");
    setMessage(text);
    loadData(companyId);
  }

  const canPickCompany = workspaceCompanyId === "all" && companies.length > 1;

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Hammer className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-950">Production</h2>
            <p className="mt-1 text-sm text-slate-600">
              Record cartons produced. Raw materials leave the store and finished cartons enter stock automatically.
            </p>
          </div>
        </div>
        {canPickCompany ? (
          <label className="mt-4 block max-w-sm">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Company</span>
            <select className="form-input" onChange={(event) => changeCompany(event.target.value)} value={companyId}>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </section>

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700" role="status">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">
          {error}
        </div>
      ) : null}

      {!companyId ? (
        <Notice>
          No company has been created yet. An admin needs to add one under Companies before production can be recorded.
        </Notice>
      ) : products.length === 0 ? (
        <Notice>
          This company has no products yet. Add the products it makes under{" "}
          <Link className="font-bold text-brand-700 underline" href="/product-management">
            Products
          </Link>{" "}
          first.
        </Notice>
      ) : canRecord ? (
        <ProductionForm
          inventoryRows={inventoryRows}
          materialRows={materialRows}
          materials={materials}
          onError={(text) => {
            setMessage("");
            setError(text);
          }}
          onSaved={showResult}
          products={products}
          user={user}
        />
      ) : null}

      {companyId && canRecord ? (
        <UtilitiesForm companyId={companyId} onSaved={showResult} records={utilities} user={user} />
      ) : null}

      {companyId ? (
        <ProductionHistory
          canCancel={canCancel}
          onCancelled={showResult}
          records={records}
          user={user}
          utilities={utilities}
        />
      ) : null}
    </div>
  );
}

function ProductionForm({
  inventoryRows,
  materialRows,
  materials,
  onError,
  onSaved,
  products,
  user
}: {
  inventoryRows: InventoryRow[];
  materialRows: RawMaterialRow[];
  materials: RawMaterialMaster[];
  onError: (text: string) => void;
  onSaved: (text: string) => void;
  products: ProductMaster[];
  user: SessionUser;
}) {
  const [date, setDate] = useState(today());
  const [itemCode, setItemCode] = useState("");
  const [cartons, setCartons] = useState("");
  const [notes, setNotes] = useState("");
  const [damages, setDamages] = useState<Record<string, string>>({});

  const product = products.find((item) => item.itemCode === itemCode);
  const cartonsProduced = Number(cartons);
  const validCartons = Number.isFinite(cartonsProduced) && cartonsProduced > 0 ? cartonsProduced : 0;
  const piecesPerCarton = piecesPerCartonOf(product);
  const plan = useMemo(
    () => (product ? planProductionUsage(product, validCartons, materials) : []),
    [materials, product, validCartons]
  );
  const stockOf = (materialCode: string) =>
    materialRows.find((row) => row.materialCode === materialCode)?.remainingStock ?? 0;
  const lines = plan.map((line) => {
    const damaged = Math.max(0, Number(damages[line.materialCode]) || 0);
    const stock = stockOf(line.materialCode);

    return { ...line, damaged, stock, stockAfter: stock - line.used - damaged };
  });
  const shortLines = lines.filter((line) => line.stockAfter < 0);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!product) {
      onError("Choose the product that was produced.");
      return;
    }

    if (!validCartons) {
      onError("Enter how many cartons were produced.");
      return;
    }

    if (!date) {
      onError("Choose the production date.");
      return;
    }

    if (shortLines.length > 0) {
      onError(
        `Not enough ${shortLines.map((line) => line.materialName).join(", ")} in the raw materials store. Record the stock received first, or correct the cartons.`
      );
      return;
    }

    addProductionRecord({
      cartonsProduced: validCartons,
      date,
      notes: notes.trim(),
      product,
      usage: lines.map(({ damaged, materialCode, materialName, unit, used, usedPer }) => ({
        damaged,
        materialCode,
        materialName,
        unit,
        used,
        usedPer
      })),
      user
    });

    const stockBefore =
      inventoryRows.find((row) => row.productKey === productKey(product.name, product.itemCode))?.closingStock ?? 0;

    setCartons("");
    setNotes("");
    setDamages({});
    onSaved(
      `Saved. ${formatNumber(validCartons)} cartons of ${product.name} added to stock, now ${formatNumber(stockBefore + validCartons)} cartons.`
    );
  }

  return (
    <form className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm" onSubmit={submit}>
      <h3 className="text-lg font-bold text-slate-950">Record production</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Field label="Date">
          <input className="form-input" onChange={(event) => setDate(event.target.value)} type="date" value={date} />
        </Field>
        <Field label="Product">
          <select
            className="form-input"
            onChange={(event) => {
              setItemCode(event.target.value);
              setDamages({});
            }}
            value={itemCode}
          >
            <option value="">Select product</option>
            {products.map((item) => (
              <option key={item.itemCode} value={item.itemCode}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cartons produced">
          <input
            className="form-input"
            inputMode="numeric"
            min="0"
            onChange={(event) => setCartons(event.target.value)}
            placeholder="0"
            type="number"
            value={cartons}
          />
        </Field>
      </div>

      {product ? (
        <p className="mt-3 rounded-lg bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-900">
          {formatNumber(validCartons)} cartons × {formatNumber(piecesPerCarton)} per carton ={" "}
          <span className="font-black">{formatNumber(validCartons * piecesPerCarton)} pieces</span>
        </p>
      ) : null}

      {product && plan.length === 0 ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          No raw materials are linked to {product.name}, so only finished stock will change. To deduct preforms, caps,
          stickers or cartons automatically, an admin sets that up under Raw Material Setup.
        </p>
      ) : null}

      {lines.length > 0 ? (
        <div className="mt-4">
          <p className="text-sm font-bold text-slate-950">Raw materials this will use</p>
          <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {lines.map((line) => {
              const material = materials.find((item) => item.materialCode === line.materialCode);
              const packsLeft = formatPacks(line.stockAfter, material);

              return (
                <li className="grid gap-3 p-3 sm:grid-cols-[1fr_auto] sm:items-center" key={line.materialCode}>
                  <div>
                    <p className="font-bold text-slate-950">{line.materialName}</p>
                    <p className="text-sm text-slate-600">
                      Uses {formatNumber(line.used)} {line.unit}
                      {line.damaged > 0 ? ` + ${formatNumber(line.damaged)} damaged` : ""}
                    </p>
                    <p className={`text-sm font-semibold ${line.stockAfter < 0 ? "text-red-700" : "text-slate-600"}`}>
                      {line.stockAfter < 0
                        ? `Not enough in store: ${formatNumber(line.stock)} ${line.unit} available`
                        : `Left after this: ${formatNumber(line.stockAfter)} ${line.unit}${packsLeft ? ` (${packsLeft})` : ""}`}
                    </p>
                  </div>
                  <label className="block sm:w-36">
                    <span className="mb-1 block text-xs font-semibold text-slate-600">Damaged ({line.unit})</span>
                    <input
                      className="form-input"
                      inputMode="numeric"
                      min="0"
                      onChange={(event) =>
                        setDamages((current) => ({ ...current, [line.materialCode]: event.target.value }))
                      }
                      placeholder="0"
                      type="number"
                      value={damages[line.materialCode] ?? ""}
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <label className="mt-4 block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">Notes (optional)</span>
        <input className="form-input" onChange={(event) => setNotes(event.target.value)} value={notes} />
      </label>

      <button className="primary-button mt-4 min-h-11 w-full sm:w-auto" type="submit">
        Save production
      </button>
    </form>
  );
}

function UtilitiesForm({
  companyId,
  onSaved,
  records,
  user
}: {
  companyId: string;
  onSaved: (text: string) => void;
  records: UtilityRecord[];
  user: SessionUser;
}) {
  const [date, setDate] = useState(today());
  const [water, setWater] = useState("");
  const [electricity, setElectricity] = useState("");
  const [notes, setNotes] = useState("");
  const [localError, setLocalError] = useState("");

  // Show what is already saved for the chosen day, so it can be corrected.
  useEffect(() => {
    const existing = records.find((record) => record.date === date);
    setWater(existing ? String(existing.waterM3) : "");
    setElectricity(existing ? String(existing.electricityKwh) : "");
    setNotes(existing?.notes ?? "");
    setLocalError("");
  }, [date, records]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const waterM3 = Number(water || 0);
    const electricityKwh = Number(electricity || 0);

    if (!Number.isFinite(waterM3) || !Number.isFinite(electricityKwh) || waterM3 < 0 || electricityKwh < 0) {
      setLocalError("Water and electricity must be zero or more.");
      return;
    }

    if (waterM3 === 0 && electricityKwh === 0) {
      setLocalError("Enter the water or electricity used.");
      return;
    }

    saveUtilityRecord({ companyId, date, electricityKwh, notes: notes.trim(), user, waterM3 });
    onSaved(
      `Saved. ${formatDate(date)}: water ${formatNumber(waterM3)} m³, electricity ${formatNumber(electricityKwh)} kWh.`
    );
  }

  return (
    <form className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm" onSubmit={submit}>
      <div className="flex items-center gap-2">
        <Droplets className="h-5 w-5 text-brand-700" />
        <h3 className="text-lg font-bold text-slate-950">Water and electricity</h3>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Field label="Date">
          <input className="form-input" onChange={(event) => setDate(event.target.value)} type="date" value={date} />
        </Field>
        <Field label="Water used (m³)">
          <input
            className="form-input"
            inputMode="decimal"
            min="0"
            onChange={(event) => setWater(event.target.value)}
            placeholder="0"
            step="any"
            type="number"
            value={water}
          />
        </Field>
        <Field label="Electricity used (kWh)">
          <input
            className="form-input"
            inputMode="decimal"
            min="0"
            onChange={(event) => setElectricity(event.target.value)}
            placeholder="0"
            step="any"
            type="number"
            value={electricity}
          />
        </Field>
      </div>
      <label className="mt-3 block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">Notes (optional)</span>
        <input className="form-input" onChange={(event) => setNotes(event.target.value)} value={notes} />
      </label>
      {localError ? <p className="mt-3 text-sm font-semibold text-red-700">{localError}</p> : null}
      <button className="secondary-button mt-4 min-h-11 w-full sm:w-auto" type="submit">
        Save water and electricity
      </button>
    </form>
  );
}

function ProductionHistory({
  canCancel,
  onCancelled,
  records,
  user,
  utilities
}: {
  canCancel: boolean;
  onCancelled: (text: string) => void;
  records: ProductionRecord[];
  user: SessionUser;
  utilities: UtilityRecord[];
}) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [cancellingId, setCancellingId] = useState("");
  const [reason, setReason] = useState("");

  const monthRecords = useMemo(
    () =>
      records
        .filter((record) => record.date.startsWith(month))
        .sort((first, second) => (first.date === second.date ? second.createdAt.localeCompare(first.createdAt) : second.date.localeCompare(first.date))),
    [month, records]
  );
  const activeRecords = monthRecords.filter((record) => !record.voidedAt);
  const monthUtilities = utilities.filter((record) => record.date.startsWith(month));
  const byProduct = useMemo(() => {
    const totals = new Map<string, { cartons: number; name: string; pieces: number }>();
    activeRecords.forEach((record) => {
      const current = totals.get(record.itemCode) ?? { cartons: 0, name: record.productName, pieces: 0 };
      totals.set(record.itemCode, {
        cartons: current.cartons + record.cartonsProduced,
        name: record.productName,
        pieces: current.pieces + record.piecesProduced
      });
    });
    return Array.from(totals.values());
  }, [activeRecords]);
  const waterTotal = monthUtilities.reduce((total, record) => total + record.waterM3, 0);
  const electricityTotal = monthUtilities.reduce((total, record) => total + record.electricityKwh, 0);

  function confirmCancel(record: ProductionRecord) {
    if (!reason.trim()) {
      return;
    }

    voidProductionRecord(record.id, reason.trim(), user);
    setCancellingId("");
    setReason("");
    onCancelled(
      `Cancelled. ${formatNumber(record.cartonsProduced)} cartons of ${record.productName} removed from stock and the raw materials returned to the store.`
    );
  }

  return (
    <section className="rounded-lg border border-brand-100 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-brand-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-brand-700" />
          <h3 className="text-lg font-bold text-slate-950">Production this month</h3>
        </div>
        <label className="block sm:w-48">
          <span className="sr-only">Month</span>
          <input className="form-input" onChange={(event) => setMonth(event.target.value)} type="month" value={month} />
        </label>
      </div>

      {byProduct.length > 0 || monthUtilities.length > 0 ? (
        <div className="grid gap-3 border-b border-brand-100 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {byProduct.map((total) => (
            <Total key={total.name} label={total.name} value={`${formatNumber(total.cartons)} cartons`} detail={`${formatNumber(total.pieces)} pieces`} />
          ))}
          {monthUtilities.length > 0 ? (
            <>
              <Total label="Water" value={`${formatNumber(waterTotal)} m³`} detail={`${monthUtilities.length} day${monthUtilities.length === 1 ? "" : "s"} recorded`} />
              <Total label="Electricity" value={`${formatNumber(electricityTotal)} kWh`} detail={`${monthUtilities.length} day${monthUtilities.length === 1 ? "" : "s"} recorded`} />
            </>
          ) : null}
        </div>
      ) : null}

      {monthRecords.length === 0 ? (
        <div className="p-8 text-center text-sm font-semibold text-slate-500">No production recorded for this month.</div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {monthRecords.map((record) => {
            const damaged = record.usage.filter((line) => line.damaged > 0);

            return (
              <li className="p-4 sm:p-5" key={record.id}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-bold text-slate-950">
                      {record.productName}
                      {record.voidedAt ? (
                        <span className="ml-2 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">
                          Cancelled
                        </span>
                      ) : null}
                    </p>
                    <p className={`text-sm ${record.voidedAt ? "text-slate-400 line-through" : "text-slate-700"}`}>
                      {formatNumber(record.cartonsProduced)} cartons = {formatNumber(record.piecesProduced)} pieces
                    </p>
                    <p className="text-sm text-slate-500">
                      {formatDate(record.date)} · {record.user}
                    </p>
                    {damaged.length > 0 ? (
                      <p className="text-sm text-amber-700">
                        Damaged: {damaged.map((line) => `${formatNumber(line.damaged)} ${line.materialName}`).join(", ")}
                      </p>
                    ) : null}
                    {record.notes ? <p className="text-sm text-slate-500">{record.notes}</p> : null}
                    {record.voidedAt ? (
                      <p className="text-sm text-red-700">
                        Cancelled by {record.voidedBy}: {record.voidReason}
                      </p>
                    ) : null}
                  </div>
                  {canCancel && !record.voidedAt && cancellingId !== record.id ? (
                    <button
                      className="secondary-button min-h-11 shrink-0"
                      onClick={() => {
                        setCancellingId(record.id);
                        setReason("");
                      }}
                      type="button"
                    >
                      Cancel entry
                    </button>
                  ) : null}
                </div>
                {cancellingId === record.id ? (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-red-800">
                        Why is this entry wrong? Stock will be put back.
                      </span>
                      <input className="form-input" onChange={(event) => setReason(event.target.value)} value={reason} />
                    </label>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <button
                        className="danger-button min-h-11"
                        disabled={!reason.trim()}
                        onClick={() => confirmCancel(record)}
                        type="button"
                      >
                        Cancel this entry
                      </button>
                      <button className="secondary-button min-h-11" onClick={() => setCancellingId("")} type="button">
                        Keep it
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function Total({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
      <p className="text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
      {children}
    </div>
  );
}
