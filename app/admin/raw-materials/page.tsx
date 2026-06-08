"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Factory, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { SessionUser } from "@/lib/auth";
import {
  getActiveCompanyId,
  getCompanies,
  getCompanyWorkspaceId,
  type Company
} from "@/lib/companies-data";
import {
  getRawMaterialsForCompany,
  hardDeleteRawMaterialMaster,
  softDeleteRawMaterialMaster,
  upsertRawMaterialMaster,
  type RawMaterialMaster
} from "@/lib/raw-materials-data";

type RawMaterialForm = {
  companyId: string;
  companyName: string;
  materialName: string;
  materialCode: string;
  category: string;
  unit: string;
  openingStock: string;
  minimumLevel: string;
  reorderLevel: string;
  status: "Active" | "Inactive";
};

const emptyForm: RawMaterialForm = {
  category: "",
  companyId: "",
  companyName: "",
  materialCode: "",
  materialName: "",
  minimumLevel: "",
  openingStock: "",
  reorderLevel: "",
  status: "Active",
  unit: ""
};

export default function AdminRawMaterialsPage() {
  return (
    <AppShell allowedRoles={["admin", "manager"]}>
      {(user) => <AdminRawMaterialsContent user={user} />}
    </AppShell>
  );
}

function AdminRawMaterialsContent({ user }: { user: SessionUser }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [materials, setMaterials] = useState<RawMaterialMaster[]>([]);
  const [form, setForm] = useState<RawMaterialForm>(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canManage = user.role === "admin";
  const workspaceCompanyId = selectedCompanyId || getCompanyWorkspaceId(user);

  useEffect(() => {
    const companyList = getCompanies();
    const initialCompanyId =
      user.role === "admin" ? getActiveCompanyId(user) : getCompanyWorkspaceId(user);
    const safeCompanyId =
      initialCompanyId === "all" ? companyList[0]?.id ?? "" : initialCompanyId;
    const company = companyList.find((item) => item.id === safeCompanyId);

    setCompanies(companyList);
    setSelectedCompanyId(safeCompanyId);
    setForm((current) => ({
      ...current,
      companyId: safeCompanyId,
      companyName: company?.name ?? ""
    }));
    setMaterials(getRawMaterialsForCompany(safeCompanyId, true));
  }, [user]);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === workspaceCompanyId),
    [companies, workspaceCompanyId]
  );

  function refreshMaterials(companyId = workspaceCompanyId) {
    setMaterials(getRawMaterialsForCompany(companyId, true));
  }

  function updateCompany(companyId: string) {
    const company = companies.find((item) => item.id === companyId);
    setSelectedCompanyId(companyId);
    setForm((current) => ({
      ...current,
      companyId,
      companyName: company?.name ?? ""
    }));
    setEditingId("");
    refreshMaterials(companyId);
  }

  function updateForm(field: keyof RawMaterialForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm(companyId = workspaceCompanyId) {
    const company = companies.find((item) => item.id === companyId);
    setForm({
      ...emptyForm,
      companyId,
      companyName: company?.name ?? ""
    });
    setEditingId("");
  }

  function editMaterial(material: RawMaterialMaster) {
    setEditingId(material.id ?? material.materialCode);
    setForm({
      category: material.category,
      companyId: material.companyId ?? workspaceCompanyId,
      companyName: material.companyName ?? selectedCompany?.name ?? "",
      materialCode: material.materialCode,
      materialName: material.materialName,
      minimumLevel: String(material.minimumLevel),
      openingStock: String(material.openingStock),
      reorderLevel: String(material.reorderLevel),
      status: material.status,
      unit: material.unit
    });
  }

  function submitMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!canManage) {
      setError("Only Admin can add or edit raw materials.");
      return;
    }

    const openingStock = Number(form.openingStock);
    const minimumLevel = Number(form.minimumLevel);
    const reorderLevel = Number(form.reorderLevel);

    if (!form.companyId || !form.materialName.trim() || !form.materialCode.trim() || !form.unit.trim()) {
      setError("Company, raw material name, code, and unit are required.");
      return;
    }

    if (
      !Number.isFinite(openingStock) ||
      openingStock < 0 ||
      !Number.isFinite(minimumLevel) ||
      minimumLevel < 0 ||
      !Number.isFinite(reorderLevel) ||
      reorderLevel < 0
    ) {
      setError("Opening stock, minimum stock level, and reorder level must be valid numbers.");
      return;
    }

    const company = companies.find((item) => item.id === form.companyId);
    upsertRawMaterialMaster({
      id: editingId || undefined,
      category: form.category.trim() || "Production",
      companyId: form.companyId,
      companyName: company?.name ?? form.companyName,
      materialCode: form.materialCode.trim(),
      materialName: form.materialName.trim(),
      minimumLevel,
      openingStock,
      reorderLevel,
      status: form.status,
      unit: form.unit.trim()
    });
    refreshMaterials(form.companyId);
    setMessage(editingId ? "Raw material updated successfully." : "Raw material added successfully.");
    resetForm(form.companyId);
  }

  function toggleMaterial(material: RawMaterialMaster) {
    if (!canManage) return;
    upsertRawMaterialMaster({
      ...material,
      status: material.status === "Inactive" ? "Active" : "Inactive"
    });
    refreshMaterials(material.companyId);
  }

  function removeMaterial(material: RawMaterialMaster, hardDelete = false) {
    if (!canManage) return;
    const ok = window.confirm(
      hardDelete
        ? "Hard delete this raw material? Historical reports keep saved movement names, but the master row will be removed."
        : "Remove this raw material from new stock movements? Historical reports stay unchanged."
    );
    if (!ok) return;

    if (hardDelete) {
      hardDeleteRawMaterialMaster(material);
    } else {
      softDeleteRawMaterialMaster(material);
    }

    refreshMaterials(material.companyId);
    setMessage(hardDelete ? "Raw material deleted." : "Raw material removed from active use.");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Factory className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-950">Raw Material Master</h2>
              <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-600">
                Manage company-specific factory inputs, reorder levels, and active status. Removed materials are hidden from new stock movements while history remains intact.
              </p>
            </div>
          </div>
          <span className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-black uppercase text-brand-800">
            {canManage ? "Admin control" : "View only"}
          </span>
        </div>
      </section>

      {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}

      <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
        <label className="block max-w-sm">
          <span className="mb-2 block text-sm font-bold text-slate-700">Company</span>
          <select
            className="form-input"
            disabled={user.role !== "admin"}
            onChange={(event) => updateCompany(event.target.value)}
            value={workspaceCompanyId}
          >
            {companies.map((company) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
        </label>
      </section>

      {canManage ? (
        <form className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm" onSubmit={submitMaterial}>
          <h3 className="text-lg font-black text-slate-950">{editingId ? "Edit Raw Material" : "Add Raw Material"}</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <Input label="Raw Material Name" onChange={(value) => updateForm("materialName", value)} value={form.materialName} />
            <Input label="Raw Material Code" onChange={(value) => updateForm("materialCode", value)} value={form.materialCode} />
            <Input label="Category" onChange={(value) => updateForm("category", value)} value={form.category} />
            <Input label="Unit of Measure" onChange={(value) => updateForm("unit", value)} value={form.unit} />
            <Input label="Opening Stock" onChange={(value) => updateForm("openingStock", value)} type="number" value={form.openingStock} />
            <Input label="Minimum Stock Level" onChange={(value) => updateForm("minimumLevel", value)} type="number" value={form.minimumLevel} />
            <Input label="Reorder Level" onChange={(value) => updateForm("reorderLevel", value)} type="number" value={form.reorderLevel} />
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Status</span>
              <select className="form-input" onChange={(event) => updateForm("status", event.target.value)} value={form.status}>
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button className="primary-button" type="submit">{editingId ? "Save Changes" : "Add Raw Material"}</button>
            {editingId ? <button className="secondary-button" onClick={() => resetForm()} type="button">Cancel Edit</button> : null}
          </div>
        </form>
      ) : null}

      <section className="rounded-lg border border-brand-100 bg-white shadow-sm">
        <div className="border-b border-brand-100 p-5">
          <h3 className="text-lg font-black text-slate-950">Company Raw Materials</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[1100px]">
            <thead>
              <tr>
                <th>Company</th>
                <th>Raw Material</th>
                <th>Code</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Opening</th>
                <th>Minimum</th>
                <th>Reorder</th>
                <th>Status</th>
                <th>Edit</th>
                <th>Remove</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((material) => (
                <tr key={material.id ?? material.materialCode}>
                  <td>{material.companyName ?? selectedCompany?.name}</td>
                  <td className="font-black text-slate-950">{material.materialName}</td>
                  <td>{material.materialCode}</td>
                  <td>{material.category}</td>
                  <td>{material.unit}</td>
                  <td>{formatNumber(material.openingStock)}</td>
                  <td>{formatNumber(material.minimumLevel)}</td>
                  <td>{formatNumber(material.reorderLevel)}</td>
                  <td><StatusBadge status={material.deletedAt ? "Removed" : material.status} /></td>
                  <td>
                    {canManage ? (
                      <button className="secondary-button !px-3" onClick={() => editMaterial(material)} type="button">
                        <Pencil className="h-4 w-4" /> Edit
                      </button>
                    ) : <span className="text-xs font-bold text-slate-500">View</span>}
                  </td>
                  <td>
                    {canManage ? (
                      <div className="flex flex-wrap gap-2">
                        <button className="secondary-button !px-3" onClick={() => toggleMaterial(material)} type="button">
                          {material.status === "Inactive" ? "Activate" : "Deactivate"}
                        </button>
                        <button className="rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-50" onClick={() => removeMaterial(material)} type="button">
                          Remove
                        </button>
                        <button className="rounded-lg bg-red-700 px-3 py-2 text-xs font-black text-white hover:bg-red-800" onClick={() => removeMaterial(material, true)} type="button">
                          <Trash2 className="inline h-3 w-3" /> Delete
                        </button>
                      </div>
                    ) : <span className="text-xs font-bold text-slate-500">No access</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Input({ label, onChange, type = "text", value }: { label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      <input className="form-input" onChange={(event) => onChange(event.target.value)} type={type} value={value} />
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "Active"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "Removed"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-amber-200 bg-amber-50 text-amber-700";

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${className}`}>{status}</span>;
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString();
}
