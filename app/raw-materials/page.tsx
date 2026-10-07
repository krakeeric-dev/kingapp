"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Factory, History, PackageMinus, PackagePlus, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { SessionUser } from "@/lib/auth";
import { formatDate } from "@/lib/loading-data";
import { getCompanyWorkspaceId } from "@/lib/companies-data";
import { hasPermission } from "@/lib/permissions";
import {
  addRawMaterialMovement,
  formatPacks,
  getRawMaterialMinimums,
  getRawMaterialMovements,
  getRawMaterialsForCompany,
  getRawMaterialRows,
  getRawMaterialTotals,
  saveRawMaterialMinimum,
  type RawMaterialMaster,
  type RawMaterialMinimum,
  type RawMaterialMovement,
  type RawMaterialMovementType,
  type RawMaterialRow
} from "@/lib/raw-materials-data";

type MovementForm = {
  date: string;
  materialCode: string;
  materialName: string;
  unit: string;
  movementType: RawMaterialMovementType;
  quantity: string;
  // Bags or bundles, for materials that are delivered in packs.
  packs: string;
  reference: string;
  notes: string;
};

type MinimumForm = {
  materialCode: string;
  materialName: string;
  unit: string;
  minimumLevel: string;
  reorderLevel: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyMovementForm: MovementForm = {
  date: today(),
  materialCode: "",
  materialName: "",
  unit: "",
  movementType: "Raw Material In",
  quantity: "",
  packs: "",
  reference: "",
  notes: ""
};

const emptyMinimumForm: MinimumForm = {
  materialCode: "",
  materialName: "",
  minimumLevel: "",
  reorderLevel: "",
  unit: ""
};

export default function RawMaterialsPage() {
  return (
    <AppShell allowedRoles={["admin", "manager", "storekeeper", "accountant"]}>
      {(user) => <RawMaterialsContent user={user} />}
    </AppShell>
  );
}

function RawMaterialsContent({ user }: { user: SessionUser }) {
  const [movements, setMovements] = useState<RawMaterialMovement[]>([]);
  const [minimums, setMinimums] = useState<RawMaterialMinimum[]>([]);
  const [materials, setMaterials] = useState<RawMaterialMaster[]>([]);
  const [movementForm, setMovementForm] = useState<MovementForm>(emptyMovementForm);
  const [minimumForm, setMinimumForm] = useState<MinimumForm>(emptyMinimumForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  // One form at a time, so the page is not three forms stacked on a phone.
  const [activeForm, setActiveForm] = useState<"movement" | "count" | "minimum">("movement");

  useEffect(() => {
    setMaterials(getRawMaterialsForCompany(getCompanyWorkspaceId(user)));
    setMovements(getRawMaterialMovements());
    setMinimums(getRawMaterialMinimums());
  }, [user]);

  const workspaceCompanyId = getCompanyWorkspaceId(user);
  const companyMovements = useMemo(
    () =>
      movements.filter(
        (movement) => workspaceCompanyId === "all" || movement.companyId === workspaceCompanyId
      ),
    [movements, workspaceCompanyId]
  );
  const companyMinimums = useMemo(
    () =>
      minimums.filter(
        (minimum) => workspaceCompanyId === "all" || minimum.companyId === workspaceCompanyId
      ),
    [minimums, workspaceCompanyId]
  );

  const rows = useMemo(
    () =>
      getRawMaterialRows({
        companyId: workspaceCompanyId,
        materials,
        minimums: companyMinimums,
        movements: companyMovements
      }),
    [companyMinimums, companyMovements, materials, workspaceCompanyId]
  );

  const totals = useMemo(() => getRawMaterialTotals(rows), [rows]);
  const todayDate = today();
  const dailyUsage = useMemo(
    () =>
      companyMovements
        .filter((movement) => movement.date === todayDate && movement.movementType === "Raw Material Out")
        .reduce((total, movement) => total + movement.quantity, 0),
    [companyMovements, todayDate]
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

  const selectedMaterial = materials.find(
    (material) => material.materialName === movementForm.materialName
  );

  function updateMovement(field: keyof MovementForm, value: string) {
    setMovementForm((current) => {
      const next = { ...current, [field]: value };

      // Typing the number of bags fills in the pieces.
      if (field === "packs" && selectedMaterial?.piecesPerPack) {
        const packs = Number(value);
        next.quantity = value && Number.isFinite(packs) ? String(packs * selectedMaterial.piecesPerPack) : "";
      }

      if (field === "quantity") {
        next.packs = "";
      }

      return next;
    });
  }

  function selectMaterial(materialName: string) {
    const row = rows.find((item) => item.materialName === materialName);

    setMovementForm((current) => ({
      ...current,
      materialCode: row?.materialCode ?? "",
      materialName,
      packs: "",
      quantity: "",
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
        // In the "All Companies" view the movement belongs to the company that owns the material.
        companyId:
          workspaceCompanyId === "all" ? selectedMaterial?.companyId ?? user.companyId : workspaceCompanyId,
        materialCode: movementForm.materialCode,
        materialName: movementForm.materialName.trim(),
        unit: movementForm.unit.trim(),
        movementType: movementForm.movementType,
        quantity,
        packs: Number(movementForm.packs) > 0 ? Number(movementForm.packs) : undefined,
        reference: movementForm.reference.trim() || movementForm.movementType,
        user: user.displayName,
        notes: movementForm.notes.trim()
      })
    );
    const isIn = movementForm.movementType !== "Raw Material Out" && quantity > 0;
    const stockBefore = rows.find((row) => row.materialName === movementForm.materialName.trim())?.remainingStock ?? 0;
    const stockAfter = movementForm.movementType === "Raw Material Out" ? stockBefore - quantity : stockBefore + quantity;
    const packsAfter = formatPacks(stockAfter, selectedMaterial);

    setMovementForm({ ...emptyMovementForm, date: today() });
    setMessage(
      `Saved. ${movementForm.materialName.trim()} ${isIn ? "in" : "out"}: ${formatNumber(quantity)} ${movementForm.unit.trim()}. Stock now ${formatNumber(stockAfter)} ${movementForm.unit.trim()}${packsAfter ? ` (${packsAfter})` : ""}.`
    );
  }

  function saveStockCount(material: RawMaterialMaster, counted: number, note: string) {
    setMessage("");
    setError("");

    const row = rows.find((item) => item.materialCode === material.materialCode);
    const expected = row?.remainingStock ?? 0;
    const difference = counted - expected;

    if (difference === 0) {
      setMessage(`Count matches. ${material.materialName} is ${formatNumber(counted)} ${material.unit}, as recorded. Nothing changed.`);
      return;
    }

    setMovements(
      addRawMaterialMovement({
        date: today(),
        companyId: material.companyId ?? (workspaceCompanyId === "all" ? user.companyId : workspaceCompanyId),
        materialCode: material.materialCode,
        materialName: material.materialName,
        unit: material.unit,
        movementType: "Adjustment",
        quantity: difference,
        reference: "Stock count",
        user: user.displayName,
        source: "stock-count",
        notes: `Counted ${formatNumber(counted)}, records showed ${formatNumber(expected)}.${note ? ` ${note}` : ""}`
      })
    );
    setMessage(
      `Saved. ${material.materialName} counted at ${formatNumber(counted)} ${material.unit}. Stock corrected by ${difference > 0 ? "+" : "−"}${formatNumber(Math.abs(difference))} ${material.unit}.`
    );
  }

  function submitMinimum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const minimumLevel = Number(minimumForm.minimumLevel);
    const reorderLevel = Number(minimumForm.reorderLevel);

    if (!minimumForm.materialName.trim() || !minimumForm.unit.trim()) {
      setError("Raw material name and unit are required.");
      return;
    }

    if (!Number.isFinite(minimumLevel) || minimumLevel < 0) {
      setError("Minimum level cannot be negative.");
      return;
    }

    if (!Number.isFinite(reorderLevel) || reorderLevel < 0) {
      setError("Reorder level cannot be negative.");
      return;
    }

    if (reorderLevel > minimumLevel) {
      setError("Reorder level should be less than or equal to minimum stock level.");
      return;
    }

    setMinimums(
      saveRawMaterialMinimum({
        materialName: minimumForm.materialName.trim(),
        companyId: workspaceCompanyId === "all" ? user.companyId : workspaceCompanyId,
        materialCode: minimumForm.materialCode,
        minimumLevel,
        reorderLevel,
        unit: minimumForm.unit.trim()
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
                Raw Materials Store
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Separate production-material inventory for planning inputs, monitoring usage, and triggering reorder decisions.
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

      {canRecordMovement && canSetMinimums ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              ["movement", "Receive or issue stock"],
              ["count", "Stock count"],
              ["minimum", "Minimum levels"]
            ] as const
          ).map(([key, label]) => (
            <button
              aria-pressed={activeForm === key}
              className={`min-h-11 rounded-lg border px-4 text-sm font-bold transition ${
                activeForm === key
                  ? "border-brand-700 bg-brand-700 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:bg-brand-50"
              }`}
              key={key}
              onClick={() => setActiveForm(key)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {(canRecordMovement || canSetMinimums) ? (
        <section className="grid gap-4">
          {canRecordMovement && (activeForm === "movement" || !canSetMinimums) ? (
            <MovementFormCard
              form={movementForm}
              material={selectedMaterial}
              materials={rows}
              onChange={updateMovement}
              onSelectMaterial={selectMaterial}
              onSubmit={submitMovement}
              user={user}
            />
          ) : null}

          {canSetMinimums && (activeForm === "count" || !canRecordMovement) ? (
            <StockCountCard materials={materials} onSave={saveStockCount} rows={rows} />
          ) : null}

          {canSetMinimums && activeForm === "minimum" ? (
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

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <SummaryCard label="Raw Material In" value={totals.rawMaterialIn} />
        <SummaryCard label="Raw Material Out" value={totals.rawMaterialOut} tone="amber" />
        <SummaryCard label="Remaining Stock" value={totals.remainingStock} tone="green" />
        <SummaryCard label="Minimum Stock Level" value={totalMinimumLevel} tone="blue" />
        <SummaryCard label="Reorder Alert" value={reorderAlertCount} tone={reorderAlertCount > 0 ? "red" : "green"} />
        <SummaryCard label="Days Remaining" value={daysRemaining >= 999 ? "Stable" : daysRemaining} tone={daysRemaining <= 3 ? "red" : daysRemaining <= 7 ? "amber" : "green"} />
        <SummaryCard label="Daily Usage" value={dailyUsage} tone="purple" />
        <SummaryCard label="Low Stock Alerts" value={totals.lowStockAlerts} tone={totals.lowStockAlerts > 0 ? "red" : "green"} />
      </section>

      <section className="rounded-lg border border-brand-100 bg-white shadow-sm">
        <div className="border-b border-brand-100 p-5">
          <h3 className="text-lg font-bold text-slate-950">Raw Materials Stock Table</h3>
          <p className="mt-1 text-sm text-slate-600">
            Remaining Stock = Opening Stock + Raw Material In - Raw Material Out.
          </p>
        </div>
        <RawMaterialsTable materials={materials} rows={rows} />
      </section>

      <section className="rounded-lg border border-brand-100 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-brand-100 p-5">
          <History className="h-5 w-5 text-brand-700" />
          <h3 className="text-lg font-bold text-slate-950">Raw Material Movement History</h3>
        </div>
        <MovementHistory records={companyMovements} />
      </section>
    </div>
  );
}

function MovementFormCard({
  form,
  material,
  materials,
  onChange,
  onSelectMaterial,
  onSubmit,
  user
}: {
  form: MovementForm;
  material?: RawMaterialMaster;
  materials: RawMaterialRow[];
  onChange: (field: keyof MovementForm, value: string) => void;
  onSelectMaterial: (materialName: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  user: SessionUser;
}) {
  const packName = (material?.packName || "pack").toLowerCase();
  const comesInPacks = Boolean(material?.piecesPerPack && material.piecesPerPack > 1);

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
        {comesInPacks ? (
          <Input
            label={`Number of ${packName}s (${formatNumber(material?.piecesPerPack ?? 0)} ${form.unit || "pcs"} each)`}
            onChange={(value) => onChange("packs", value)}
            type="number"
            value={form.packs}
          />
        ) : null}
        <Input
          label={comesInPacks ? `Quantity in ${form.unit || "pcs"} (filled in from ${packName}s)` : "Quantity"}
          onChange={(value) => onChange("quantity", value)}
          type="number"
          value={form.quantity}
        />
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

function StockCountCard({
  materials,
  onSave,
  rows
}: {
  materials: RawMaterialMaster[];
  onSave: (material: RawMaterialMaster, counted: number, note: string) => void;
  rows: RawMaterialRow[];
}) {
  const [materialCode, setMaterialCode] = useState("");
  const [packs, setPacks] = useState("");
  const [loose, setLoose] = useState("");
  const [note, setNote] = useState("");
  const [localError, setLocalError] = useState("");

  const material = materials.find((item) => item.materialCode === materialCode);
  const perPack = material?.piecesPerPack && material.piecesPerPack > 1 ? material.piecesPerPack : 0;
  const packName = (material?.packName || "pack").toLowerCase();
  const expected = rows.find((row) => row.materialCode === materialCode)?.remainingStock ?? 0;
  const hasCount = packs !== "" || loose !== "";
  const counted = (perPack ? (Number(packs) || 0) * perPack : 0) + (Number(loose) || 0);
  const difference = counted - expected;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!material) {
      setLocalError("Choose the raw material that was counted.");
      return;
    }

    if (!hasCount || counted < 0 || !Number.isFinite(counted)) {
      setLocalError("Enter what was counted. Type 0 if there is none.");
      return;
    }

    setLocalError("");
    onSave(material, counted, note.trim());
    setPacks("");
    setLoose("");
    setNote("");
  }

  return (
    <form className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm" onSubmit={submit}>
      <div className="flex items-center gap-2">
        <ClipboardCheck className="h-5 w-5 text-brand-700" />
        <h3 className="font-bold text-slate-950">Stock count</h3>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Count what is really in the store. If it differs from the records, the stock is corrected and the difference is kept in the history.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Raw material counted</span>
          <select
            className="form-input"
            onChange={(event) => {
              setMaterialCode(event.target.value);
              setPacks("");
              setLoose("");
            }}
            value={materialCode}
          >
            <option value="">Select raw material</option>
            {materials.map((item) => (
              <option key={item.materialCode} value={item.materialCode}>
                {item.materialName}
              </option>
            ))}
          </select>
        </label>
        {perPack ? (
          <Input label={`Full ${packName}s counted`} onChange={setPacks} type="number" value={packs} />
        ) : null}
        <Input
          label={perPack ? `Loose ${material?.unit || "pcs"} counted` : `Counted (${material?.unit || "pcs"})`}
          onChange={setLoose}
          type="number"
          value={loose}
        />
      </div>

      {material ? (
        <p className="mt-3 rounded-lg bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
          Records show {formatNumber(expected)} {material.unit}
          {formatPacks(expected, material) ? ` (${formatPacks(expected, material)})` : ""}.
          {hasCount ? (
            <span className={`block ${difference === 0 ? "text-emerald-700" : "text-amber-700"}`}>
              You counted {formatNumber(counted)} {material.unit}:{" "}
              {difference === 0
                ? "it matches."
                : `${formatNumber(Math.abs(difference))} ${material.unit} ${difference < 0 ? "missing" : "more than recorded"}.`}
            </span>
          ) : null}
        </p>
      ) : null}

      <label className="mt-3 block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">Note (optional)</span>
        <input className="form-input" onChange={(event) => setNote(event.target.value)} value={note} />
      </label>
      {localError ? <p className="mt-3 text-sm font-semibold text-red-700">{localError}</p> : null}
      <button className="primary-button mt-4 min-h-11 w-full sm:w-auto" type="submit">
        Save stock count
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
    onChange("materialCode", material?.materialCode ?? "");
    onChange("unit", material?.unit ?? "");
    onChange("minimumLevel", material ? String(material.minimumLevel) : "");
    onChange("reorderLevel", material ? String(material.reorderLevel) : "");
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
        <Input label="Minimum Stock Level" onChange={(value) => onChange("minimumLevel", value)} type="number" value={form.minimumLevel} />
        <Input label="Reorder Level" onChange={(value) => onChange("reorderLevel", value)} type="number" value={form.reorderLevel} />
      </div>
      <button className="mt-4 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-800">
        Save minimum level
      </button>
    </form>
  );
}

function RawMaterialsTable({ materials, rows }: { materials: RawMaterialMaster[]; rows: RawMaterialRow[] }) {
  if (rows.length === 0) {
    return <EmptyState>No raw material records yet.</EmptyState>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table min-w-[980px]">
        <thead>
          <tr>
            <th>Raw Material</th>
            <th>Opening Stock</th>
            <th>Raw Material In</th>
            <th>Raw Material Out</th>
            <th>Remaining Stock</th>
            <th>Minimum Stock Level</th>
            <th>Reorder Level</th>
            <th>Status</th>
            <th>Last Updated</th>
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
              <td className="font-black text-brand-800">
                {formatNumber(row.remainingStock)}
                <PackCount material={materials.find((material) => material.materialCode === row.materialCode)} quantity={row.remainingStock} />
              </td>
              <td>{formatNumber(row.minimumLevel)}</td>
              <td>{formatNumber(row.reorderLevel)}</td>
              <td><StatusBadge status={row.status} /></td>
              <td>{row.lastUpdated ? formatDate(row.lastUpdated) : "Not updated"}</td>
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
              <td>
                {record.source === "production"
                  ? "Used in production"
                  : record.source === "damage"
                    ? "Damaged in production"
                    : record.source === "production-void"
                      ? "Production cancelled"
                      : record.source === "stock-count"
                        ? "Stock count"
                        : record.movementType}
              </td>
              <td>
                {formatNumber(record.quantity)}
                {record.packs ? <span className="block text-xs font-semibold text-slate-500">{formatNumber(record.packs)} packs</span> : null}
              </td>
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

function PackCount({ material, quantity }: { material?: RawMaterialMaster; quantity: number }) {
  const packs = formatPacks(quantity, material);

  return packs ? <span className="block text-xs font-semibold text-slate-500">{packs}</span> : null;
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
    status === "Reorder Immediately"
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
