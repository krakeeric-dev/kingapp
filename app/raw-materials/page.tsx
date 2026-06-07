"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { Factory, History, PackageMinus, PackagePlus, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { SessionUser } from "@/lib/auth";
import { formatDate } from "@/lib/loading-data";
import { hasPermission } from "@/lib/permissions";
import {
  addRawMaterialMovement,
  getRawMaterialMinimums,
  getRawMaterialMovements,
  getRawMaterialRows,
  getRawMaterialTotals,
  saveRawMaterialMinimum,
  type RawMaterialMinimum,
  type RawMaterialMovement,
  type RawMaterialMovementType,
  type RawMaterialRow
} from "@/lib/raw-materials-data";

type MovementForm = {
  date: string;
  materialName: string;
  unit: string;
  movementType: RawMaterialMovementType;
  quantity: string;
  reference: string;
  notes: string;
};

type MinimumForm = {
  materialName: string;
  unit: string;
  minimumLevel: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyMovementForm: MovementForm = {
  date: today(),
  materialName: "",
  unit: "",
  movementType: "Raw Material In",
  quantity: "",
  reference: "",
  notes: ""
};

const emptyMinimumForm: MinimumForm = {
  materialName: "",
  unit: "",
  minimumLevel: ""
};

export default function RawMaterialsPage() {
  return (
    <AppShell allowedRoles={["admin", "manager", "storekeeper"]}>
      {(user) => <RawMaterialsContent user={user} />}
    </AppShell>
  );
}

function RawMaterialsContent({ user }: { user: SessionUser }) {
  const [movements, setMovements] = useState<RawMaterialMovement[]>([]);
  const [minimums, setMinimums] = useState<RawMaterialMinimum[]>([]);
  const [movementForm, setMovementForm] = useState<MovementForm>(emptyMovementForm);
  const [minimumForm, setMinimumForm] = useState<MinimumForm>(emptyMinimumForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setMovements(getRawMaterialMovements());
    setMinimums(getRawMaterialMinimums());
  }, []);

  const rows = useMemo(
    () => getRawMaterialRows({ minimums, movements }),
    [minimums, movements]
  );

  const totals = useMemo(() => getRawMaterialTotals(rows), [rows]);
  const todayDate = today();
  const dailyUsage = useMemo(
    () =>
      movements
        .filter((movement) => movement.date === todayDate && movement.movementType === "Raw Material Out")
        .reduce((total, movement) => total + movement.quantity, 0),
    [movements, todayDate]
  );
  const totalMinimumLevel = useMemo(
    () => rows.reduce((total, row) => total + row.minimumLevel, 0),
    [rows]
  );
  const reorderAlertCount = totals.lowStockAlerts + totals.reorderRequired;
  const daysRemaining =
    dailyUsage > 0
      ? Math.floor(totals.remainingStock / dailyUsage)
      : totals.remainingStock > 0
        ? 999
        : 0;
  const canRecordMovement = hasPermission(user, "rawmaterials.update");
  const canSetMinimums = hasPermission(user, "rawmaterials.edit");

  function updateMovement(field: keyof MovementForm, value: string) {
    setMovementForm((current) => ({ ...current, [field]: value }));
  }

  function selectMaterial(materialName: string) {
    const row = rows.find((item) => item.materialName === materialName);

    setMovementForm((current) => ({
      ...current,
      materialName,
      unit: row?.unit ?? current.unit
    }));
  }

  function submitMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const quantity = Number(movementForm.quantity);

    if (!movementForm.materialName.trim()) {
      setError("Raw material name is required.");
      return;
    }

    if (!movementForm.unit.trim()) {
      setError("Unit is required.");
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Quantity must be greater than zero.");
      return;
    }

    setMovements(
      addRawMaterialMovement({
        date: movementForm.date,
        materialName: movementForm.materialName.trim(),
        unit: movementForm.unit.trim(),
        movementType: movementForm.movementType,
        quantity,
        reference: movementForm.reference.trim() || movementForm.movementType,
        user: user.displayName,
        notes: movementForm.notes.trim(),
        companyId: user.companyId
      })
    );
    setMovementForm({ ...emptyMovementForm, date: today() });
    setMessage("Raw material movement saved.");
  }

  function submitMinimum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const minimumLevel = Number(minimumForm.minimumLevel);

    if (!minimumForm.materialName.trim() || !minimumForm.unit.trim()) {
      setError("Raw material name and unit are required.");
      return;
    }

    if (!Number.isFinite(minimumLevel) || minimumLevel < 0) {
      setError("Minimum level cannot be negative.");
      return;
    }

    setMinimums(
      saveRawMaterialMinimum({
        materialName: minimumForm.materialName.trim(),
        unit: minimumForm.unit.trim(),
        minimumLevel
      })
    );
    setMinimumForm(emptyMinimumForm);
    setMessage("Minimum level saved.");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Factory className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-950">
                Raw Materials Management
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Plan production inputs, monitor usage, and trigger reorder decisions.
              </p>
            </div>
          </div>
          <span className="w-fit rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-black uppercase tracking-normal text-brand-800">
            Storekeeper updates, Manager monitors, Admin controls
          </span>
        </div>
      </section>

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

      {reorderAlertCount > 0 ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-black uppercase tracking-normal text-red-700">
          LOW STOCK ALERT: {reorderAlertCount.toLocaleString()} raw material item{reorderAlertCount === 1 ? "" : "s"} need attention.
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <SummaryCard label="Raw Material In" value={totals.rawMaterialIn} />
        <SummaryCard label="Raw Material Out" value={totals.rawMaterialOut} tone="amber" />
        <SummaryCard label="Remaining Stock" value={totals.remainingStock} tone="green" />
        <SummaryCard label="Minimum Stock Level" value={totalMinimumLevel} tone="blue" />
        <SummaryCard label="Reorder Alert" value={reorderAlertCount} tone={reorderAlertCount > 0 ? "red" : "green"} />
        <SummaryCard label="Days Remaining" value={daysRemaining >= 999 ? "Stable" : daysRemaining} tone={daysRemaining <= 3 ? "red" : daysRemaining <= 7 ? "amber" : "green"} />
        <SummaryCard label="Daily Usage" value={dailyUsage} tone="purple" />
        <SummaryCard label="Low Stock Alerts" value={totals.lowStockAlerts} tone={totals.lowStockAlerts > 0 ? "red" : "green"} />
      </section>

      {(canRecordMovement || canSetMinimums) ? (
        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          {canRecordMovement ? (
            <MovementFormCard
              form={movementForm}
              materials={rows}
              onChange={updateMovement}
              onSelectMaterial={selectMaterial}
              onSubmit={submitMovement}
              user={user}
            />
          ) : null}

          {canSetMinimums ? (
            <MinimumFormCard
              form={minimumForm}
              materials={rows}
              onChange={(field, value) =>
                setMinimumForm((current) => ({ ...current, [field]: value }))
              }
              onSubmit={submitMinimum}
            />
          ) : null}
        </section>
      ) : null}

      <section className="rounded-lg border border-brand-100 bg-white shadow-sm">
        <div className="border-b border-brand-100 p-5">
          <h3 className="text-lg font-bold text-slate-950">Raw Materials Stock Table</h3>
          <p className="mt-1 text-sm text-slate-600">
            Remaining = Opening Stock + Raw Material In - Raw Material Out.
          </p>
        </div>
        <RawMaterialsTable rows={rows} />
      </section>

      <section className="rounded-lg border border-brand-100 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-brand-100 p-5">
          <History className="h-5 w-5 text-brand-700" />
          <h3 className="text-lg font-bold text-slate-950">Raw Material Movement History</h3>
        </div>
        <MovementHistory records={movements} />
      </section>
    </div>
  );
}

function MovementFormCard({
  form,
  materials,
  onChange,
  onSelectMaterial,
  onSubmit,
  user
}: {
  form: MovementForm;
  materials: RawMaterialRow[];
  onChange: (field: keyof MovementForm, value: string) => void;
  onSelectMaterial: (materialName: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  user: SessionUser;
}) {
  return (
    <form className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm" onSubmit={onSubmit}>
      <div className="flex items-center gap-2">
        {form.movementType === "Raw Material Out" ? (
          <PackageMinus className="h-5 w-5 text-brand-700" />
        ) : (
          <PackagePlus className="h-5 w-5 text-brand-700" />
        )}
        <h3 className="font-bold text-slate-950">Record Raw Material Movement</h3>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Input label="Date" onChange={(value) => onChange("date", value)} type="date" value={form.date} />
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Movement Type</span>
          <select
            className="form-input"
            onChange={(event) => onChange("movementType", event.target.value)}
            value={form.movementType}
          >
            <option>Raw Material In</option>
            <option>Raw Material Out</option>
            {user.role === "admin" ? <option>Opening Stock</option> : null}
            {user.role === "admin" ? <option>Adjustment</option> : null}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Raw Material</span>
          <select
            className="form-input"
            onChange={(event) => onSelectMaterial(event.target.value)}
            value={form.materialName}
          >
            <option value="">Select raw material</option>
            {materials.map((material) => (
              <option key={material.materialName} value={material.materialName}>
                {material.materialName}
              </option>
            ))}
          </select>
        </label>
        <Input label="Unit" onChange={(value) => onChange("unit", value)} value={form.unit} />
        <Input label="Quantity" onChange={(value) => onChange("quantity", value)} type="number" value={form.quantity} />
        <Input label="Reference / Supplier / Batch" onChange={(value) => onChange("reference", value)} value={form.reference} />
        <label className="block md:col-span-2">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Notes</span>
          <textarea
            className="min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
            onChange={(event) => onChange("notes", event.target.value)}
            value={form.notes}
          />
        </label>
      </div>
      <button className="mt-4 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-800">
        Save movement
      </button>
    </form>
  );
}

function MinimumFormCard({
  form,
  materials,
  onChange,
  onSubmit
}: {
  form: MinimumForm;
  materials: RawMaterialRow[];
  onChange: (field: keyof MinimumForm, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  function selectMaterial(materialName: string) {
    const material = materials.find((item) => item.materialName === materialName);
    onChange("materialName", materialName);
    onChange("unit", material?.unit ?? "");
    onChange("minimumLevel", material ? String(material.minimumLevel) : "");
  }

  return (
    <form className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm" onSubmit={onSubmit}>
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-5 w-5 text-brand-700" />
        <h3 className="font-bold text-slate-950">Minimum Level Alert</h3>
      </div>
      <div className="mt-4 grid gap-3">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Raw Material</span>
          <select
            className="form-input"
            onChange={(event) => selectMaterial(event.target.value)}
            value={form.materialName}
          >
            <option value="">Select raw material</option>
            {materials.map((material) => (
              <option key={material.materialName} value={material.materialName}>
                {material.materialName}
              </option>
            ))}
          </select>
        </label>
        <Input label="Unit" onChange={(value) => onChange("unit", value)} value={form.unit} />
        <Input label="Minimum Level" onChange={(value) => onChange("minimumLevel", value)} type="number" value={form.minimumLevel} />
      </div>
      <button className="mt-4 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-800">
        Save minimum level
      </button>
    </form>
  );
}

function RawMaterialsTable({ rows }: { rows: RawMaterialRow[] }) {
  if (rows.length === 0) {
    return <EmptyState>No raw material records yet.</EmptyState>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table min-w-[860px]">
        <thead>
          <tr>
            <th>Raw Material</th>
            <th>Opening Stock</th>
            <th>Raw Material In</th>
            <th>Raw Material Out</th>
            <th>Remaining Stock</th>
            <th>Minimum Level</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.materialName}>
              <td>
                <p className="font-bold text-slate-950">{row.materialName}</p>
                <p className="text-xs font-semibold text-slate-500">{row.unit}</p>
              </td>
              <td>{formatNumber(row.openingStock)}</td>
              <td>{formatNumber(row.rawMaterialIn)}</td>
              <td>{formatNumber(row.rawMaterialOut)}</td>
              <td className="font-black text-brand-800">{formatNumber(row.remainingStock)}</td>
              <td>{formatNumber(row.minimumLevel)}</td>
              <td><StatusBadge status={row.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MovementHistory({ records }: { records: RawMaterialMovement[] }) {
  if (records.length === 0) {
    return <EmptyState>No raw material movement history yet.</EmptyState>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table min-w-[900px]">
        <thead>
          <tr>
            <th>Date</th>
            <th>Raw Material</th>
            <th>Movement Type</th>
            <th>Quantity</th>
            <th>Reference</th>
            <th>User</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>{formatDate(record.date)}</td>
              <td>
                <p className="font-bold text-slate-950">{record.materialName}</p>
                <p className="text-xs font-semibold text-slate-500">{record.unit}</p>
              </td>
              <td>{record.movementType}</td>
              <td>{formatNumber(record.quantity)}</td>
              <td>{record.reference}</td>
              <td>{record.user}</td>
              <td>{record.notes || "None"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SummaryCard({
  label,
  tone = "blue",
  value
}: {
  label: string;
  tone?: "blue" | "green" | "amber" | "red" | "purple";
  value: number | string;
}) {
  const toneClass = {
    amber: "bg-amber-50 text-amber-800",
    blue: "bg-blue-50 text-blue-800",
    green: "bg-brand-50 text-brand-800",
    purple: "bg-purple-50 text-purple-800",
    red: "bg-red-50 text-red-800"
  }[tone];

  return (
    <article className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-normal text-slate-500">{label}</p>
      <p className={`mt-3 rounded-lg px-3 py-2 text-2xl font-black ${toneClass}`}>
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
    </article>
  );
}

function StatusBadge({ status }: { status: RawMaterialRow["status"] }) {
  const className =
    status === "Reorder Required"
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

function Input({
  disabled = false,
  label,
  onChange,
  type = "text",
  value
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <input
        className="form-input"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="p-8 text-center text-sm font-semibold text-slate-500">
      {children}
    </div>
  );
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString();
}
