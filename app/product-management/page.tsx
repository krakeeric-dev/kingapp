"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PackagePlus, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { SessionUser } from "@/lib/auth";
import {
  getActiveCompanyId,
  getCompanies,
  getCompanyWorkspaceId,
  type Company
} from "@/lib/companies-data";
import {
  formatMoney
} from "@/lib/sales-data";
import { logAuditEvent } from "@/lib/loading-data";
import {
  getProductsForCompany,
  hardDeleteProduct,
  softDeleteProduct,
  upsertProduct,
  type ProductMaster
} from "@/lib/products-data";

type ProductForm = {
  companyId: string;
  companyName: string;
  name: string;
  itemCode: string;
  category: string;
  pricePerCarton: string;
  costPrice: string;
  cartonSize: string;
  status: "Active" | "Inactive";
};

const emptyForm: ProductForm = {
  cartonSize: "",
  category: "",
  companyId: "",
  companyName: "",
  costPrice: "",
  itemCode: "",
  name: "",
  pricePerCarton: "",
  status: "Active"
};

export default function ProductManagementPage() {
  return (
    <AppShell allowedRoles={["admin", "manager", "storekeeper", "marketer", "accountant"]}>
      {(user) => <ProductManagementContent user={user} />}
    </AppShell>
  );
}

function ProductManagementContent({ user }: { user: SessionUser }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [products, setProducts] = useState<ProductMaster[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [editingProductId, setEditingProductId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canManage = user.role === "admin";
  const workspaceCompanyId = selectedCompanyId || getCompanyWorkspaceId(user);

  useEffect(() => {
    const companyList = getCompanies();
    const initialCompanyId = user.role === "admin" ? getActiveCompanyId(user) : getCompanyWorkspaceId(user);
    const safeCompanyId = initialCompanyId === "all" ? companyList[0]?.id ?? "" : initialCompanyId;
    const company = companyList.find((item) => item.id === safeCompanyId);

    setCompanies(companyList);
    setSelectedCompanyId(safeCompanyId);
    setForm((current) => ({
      ...current,
      companyId: safeCompanyId,
      companyName: company?.name ?? ""
    }));
    setProducts(getProductsForCompany(safeCompanyId, true));
  }, [user]);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === workspaceCompanyId),
    [companies, workspaceCompanyId]
  );

  function refreshProducts(companyId = workspaceCompanyId) {
    setProducts(getProductsForCompany(companyId, true));
  }

  function updateCompany(companyId: string) {
    const company = companies.find((item) => item.id === companyId);
    setSelectedCompanyId(companyId);
    setForm((current) => ({
      ...current,
      companyId,
      companyName: company?.name ?? ""
    }));
    setEditingProductId("");
    refreshProducts(companyId);
  }

  function updateForm(field: keyof ProductForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm(companyId = workspaceCompanyId) {
    const company = companies.find((item) => item.id === companyId);
    setForm({
      ...emptyForm,
      companyId,
      companyName: company?.name ?? ""
    });
    setEditingProductId("");
  }

  function editProduct(product: ProductMaster) {
    setEditingProductId(product.id ?? product.itemCode);
    setForm({
      cartonSize: String(product.cartonSize ?? ""),
      category: product.category,
      companyId: product.companyId ?? workspaceCompanyId,
      companyName: product.companyName ?? selectedCompany?.name ?? "",
      costPrice: String(product.costPrice ?? ""),
      itemCode: product.itemCode,
      name: product.name,
      pricePerCarton: String(product.pricePerCarton),
      status: product.status ?? "Active"
    });
  }

  function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!canManage) {
      setError("Only Admin can add or edit products.");
      return;
    }

    const price = Number(form.pricePerCarton);
    const cost = Number(form.costPrice);
    const cartonSize = Number(form.cartonSize);

    if (!form.companyId || !form.name.trim() || !form.itemCode.trim()) {
      setError("Company, product name, and product code are required.");
      return;
    }

    if (!Number.isFinite(price) || price < 0 || !Number.isFinite(cost) || cost < 0 || !Number.isFinite(cartonSize) || cartonSize <= 0) {
      setError("Price, cost, and carton size must be valid numbers.");
      return;
    }

    const company = companies.find((item) => item.id === form.companyId);
    const productPayload = {
      id: editingProductId || undefined,
      cartonSize,
      category: form.category.trim() || "Beverage",
      companyId: form.companyId,
      companyName: company?.name ?? form.companyName,
      costPrice: cost,
      itemCode: form.itemCode.trim(),
      minimumStock: 0,
      name: form.name.trim(),
      openingStock: 0,
      pricePerCarton: price,
      status: form.status,
      unit: "Cartons"
    };
    const oldProduct = products.find((product) => (product.id ?? product.itemCode) === editingProductId);
    upsertProduct(productPayload);
    logAuditEvent({
      action: editingProductId ? "product_edited" : "product_created",
      companyId: form.companyId,
      companyName: company?.name ?? form.companyName,
      module: "Products",
      newValue: productPayload,
      oldValue: oldProduct,
      recordId: productPayload.itemCode,
      reason: editingProductId ? "Product edited" : "Product created",
      status: "success",
      user
    });
    refreshProducts(form.companyId);
    setMessage(editingProductId ? "Product updated successfully." : "Product added successfully.");
    resetForm(form.companyId);
  }

  function deactivateProduct(product: ProductMaster) {
    if (!canManage) return;
    upsertProduct({ ...product, status: product.status === "Inactive" ? "Active" : "Inactive" });
    refreshProducts(product.companyId);
  }

  function removeProduct(product: ProductMaster, hardDelete = false) {
    if (!canManage) return;
    const ok = window.confirm(
      hardDelete
        ? "Hard delete this product? Historical reports keep saved transaction names, but the product master row will be removed."
        : "Remove this product from users? It will be hidden but historical reports stay unchanged."
    );
    if (!ok) return;

    if (hardDelete) {
      hardDeleteProduct(product);
    } else {
      softDeleteProduct(product);
    }
    refreshProducts(product.companyId);
    setMessage(hardDelete ? "Product deleted." : "Product removed from active use.");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <PackagePlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-950">Product Management</h2>
              <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-600">
                Manage company-specific products. Inactive or removed products are hidden from new loading and sales, while historical records remain unchanged.
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
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block">
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
        </div>
      </section>

      {canManage ? (
        <form className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm" onSubmit={submitProduct}>
          <h3 className="text-lg font-black text-slate-950">{editingProductId ? "Edit Product" : "Add Product"}</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <Input label="Product Name" onChange={(value) => updateForm("name", value)} value={form.name} />
            <Input label="Product Code" onChange={(value) => updateForm("itemCode", value)} value={form.itemCode} />
            <Input label="Category" onChange={(value) => updateForm("category", value)} value={form.category} />
            <Input label="Unit Price" onChange={(value) => updateForm("pricePerCarton", value)} type="number" value={form.pricePerCarton} />
            <Input label="Cost Price" onChange={(value) => updateForm("costPrice", value)} type="number" value={form.costPrice} />
            <Input label="Carton Size" onChange={(value) => updateForm("cartonSize", value)} type="number" value={form.cartonSize} />
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Status</span>
              <select className="form-input" onChange={(event) => updateForm("status", event.target.value)} value={form.status}>
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button className="primary-button" type="submit">{editingProductId ? "Save Changes" : "Add Product"}</button>
            {editingProductId ? <button className="secondary-button" onClick={() => resetForm()} type="button">Cancel Edit</button> : null}
          </div>
        </form>
      ) : null}

      <section className="rounded-lg border border-brand-100 bg-white shadow-sm">
        <div className="border-b border-brand-100 p-5">
          <h3 className="text-lg font-black text-slate-950">Company Product Management</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[980px]">
            <thead>
              <tr>
                <th>Company</th>
                <th>Product</th>
                <th>Code</th>
                <th>Category</th>
                <th>Price</th>
                <th>Cost</th>
                <th>Carton Size</th>
                <th>Status</th>
                <th>Edit</th>
                <th>Remove</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id ?? product.itemCode}>
                  <td>{product.companyName ?? selectedCompany?.name}</td>
                  <td className="font-black text-slate-950">{product.name}</td>
                  <td>{product.itemCode}</td>
                  <td>{product.category}</td>
                  <td>{formatMoney(product.pricePerCarton)} RWF</td>
                  <td>{formatMoney(product.costPrice ?? 0)} RWF</td>
                  <td>{product.cartonSize ?? 1}</td>
                  <td><StatusBadge status={product.deletedAt ? "Removed" : product.status ?? "Active"} /></td>
                  <td>
                    {canManage ? (
                      <button className="secondary-button !px-3" onClick={() => editProduct(product)} type="button">
                        <Pencil className="h-4 w-4" /> Edit
                      </button>
                    ) : <span className="text-xs font-bold text-slate-500">View</span>}
                  </td>
                  <td>
                    {canManage ? (
                      <div className="flex flex-wrap gap-2">
                        <button className="secondary-button !px-3" onClick={() => deactivateProduct(product)} type="button">
                          {product.status === "Inactive" ? "Activate" : "Deactivate"}
                        </button>
                        <button className="rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-50" onClick={() => removeProduct(product)} type="button">
                          Remove
                        </button>
                        <button className="rounded-lg bg-red-700 px-3 py-2 text-xs font-black text-white hover:bg-red-800" onClick={() => removeProduct(product, true)} type="button">
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
