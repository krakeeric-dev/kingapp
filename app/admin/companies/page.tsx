"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { Archive, Building2, Pencil, Plus, Power, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { SessionUser } from "@/lib/auth";
import { logAuditEvent } from "@/lib/loading-data";
import {
  archiveCompany,
  createCompany,
  getCompanies,
  getCompanyLinkedRecordSummary,
  removeCompany,
  setActiveCompanyId,
  updateCompany,
  type Company,
  type CompanyStatus
} from "@/lib/companies-data";
import { getUsers } from "@/lib/users-data";

type CompanyForm = {
  address: string;
  code: string;
  email: string;
  logo: string;
  name: string;
  phone: string;
  status: CompanyStatus;
  type: string;
};

type RemoveMode = "archive" | "permanent";

const emptyForm: CompanyForm = {
  address: "",
  code: "",
  email: "",
  logo: "",
  name: "",
  phone: "",
  status: "active",
  type: ""
};

export default function CompaniesPage() {
  return (
    <AppShell allowedRoles={["admin"]}>
      {(user) => <CompaniesContent user={user} />}
    </AppShell>
  );
}

function CompaniesContent({ user }: { user: SessionUser }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [form, setForm] = useState<CompanyForm>(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");
  const [removeTarget, setRemoveTarget] = useState<Company | null>(null);
  const [removeMode, setRemoveMode] = useState<RemoveMode>("archive");
  const users = useMemo(() => getUsers(), [companies]);
  const linkedSummary = removeTarget ? getCompanyLinkedRecordSummary(removeTarget.id) : { total: 0, byKey: [] };

  useEffect(() => {
    refreshCompanies();
  }, []);

  function refreshCompanies() {
    setCompanies(getCompanies({ includeArchived: true }));
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim() || !form.code.trim() || !form.type.trim()) {
      setMessage("Company name, company code, and business type are required.");
      return;
    }

    if (editingId) {
      const oldCompany = companies.find((company) => company.id === editingId);
      const updatedCompanies = updateCompany(editingId, form);
      setCompanies(updatedCompanies);
      logAuditEvent({
        action: "company_edited",
        companyId: editingId,
        companyName: form.name,
        module: "Companies",
        newValue: form,
        oldValue: oldCompany,
        recordId: editingId,
        reason: "Company edited",
        status: "success",
        user
      });
      setEditingId("");
      setMessage("Company updated.");
    } else {
      const updatedCompanies = createCompany(form);
      const createdCompany = updatedCompanies[0];
      setCompanies(updatedCompanies);
      logAuditEvent({
        action: "company_created",
        companyId: createdCompany.id,
        companyName: createdCompany.name,
        module: "Companies",
        newValue: createdCompany,
        recordId: createdCompany.id,
        reason: "Company created",
        status: "success",
        user
      });
      setMessage("Company created.");
    }
    setForm(emptyForm);
  }

  function startEdit(company: Company) {
    setEditingId(company.id);
    setForm({
      address: company.address,
      code: company.code,
      email: company.email,
      logo: company.logo,
      name: company.name,
      phone: company.phone,
      status: company.status,
      type: company.type
    });
  }

  function toggleStatus(company: Company) {
    const nextStatus: CompanyStatus = company.status === "active" ? "inactive" : "active";
    const updatedCompanies = updateCompany(company.id, { ...company, status: nextStatus });
    setCompanies(updatedCompanies);
    logAuditEvent({
      action: nextStatus === "inactive" ? "company_deactivated" : "company_activated",
      companyId: company.id,
      companyName: company.name,
      module: "Companies",
      newValue: { status: nextStatus },
      oldValue: { status: company.status },
      recordId: company.id,
      reason: nextStatus === "inactive" ? "Company deactivated" : "Company activated",
      status: "success",
      user
    });
    setMessage(nextStatus === "inactive" ? "Company deactivated. Linked users can no longer login." : "Company activated.");
  }

  function archive(company: Company) {
    const updatedCompanies = archiveCompany(company.id);
    setCompanies(updatedCompanies);
    logAuditEvent({
      action: "company_archived",
      companyId: company.id,
      companyName: company.name,
      module: "Companies",
      newValue: { status: "archived" },
      oldValue: company,
      recordId: company.id,
      reason: "Company archived",
      status: "success",
      user
    });
    setMessage("Company archived. It is hidden from normal users, but remains available to Admin.");
  }

  function confirmRemove() {
    if (!removeTarget) return;
    const result = removeCompany(removeTarget.id, removeMode);
    setCompanies(result.companies);
    logAuditEvent({
      action: removeMode === "archive" ? "company_archived" : "company_removed",
      companyId: removeTarget.id,
      companyName: removeTarget.name,
      module: "Companies",
      newValue: { mode: removeMode, removedStores: result.removedKeys },
      oldValue: removeTarget,
      recordId: removeTarget.id,
      reason:
        removeMode === "archive"
          ? "Company archived from removal workflow"
          : "Company removed permanently with linked records",
      status: "success",
      user
    });
    setMessage(removeMode === "archive" ? "Company archived." : "Company and linked records removed.");
    setRemoveTarget(null);
    setRemoveMode("archive");
  }

  function switchCompany(companyId: string) {
    setActiveCompanyId(companyId);
    setMessage(companyId === "all" ? "Active workspace switched to all companies." : "Active company switched.");
    window.dispatchEvent(new Event("kingapp:company-switched"));
  }

  return (
    <div className="space-y-6">
      <section className="app-card-soft p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-950">Company Management</h2>
            <p className="mt-1 text-sm text-slate-600">
              Create companies, manage contacts, control status, archive records, and switch the active admin workspace.
            </p>
          </div>
        </div>
      </section>

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </div>
      ) : null}

      <section className="app-card p-5">
        <h3 className="text-lg font-black text-slate-950">{editingId ? "Edit Company" : "Add Company"}</h3>
        <form className="mt-4 grid gap-4 lg:grid-cols-3" onSubmit={save}>
          <Field label="Company Name">
            <input className="form-input" onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} value={form.name} />
          </Field>
          <Field label="Company Code">
            <input className="form-input" onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} value={form.code} />
          </Field>
          <Field label="Business Type">
            <input className="form-input" onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} value={form.type} />
          </Field>
          <Field label="Phone">
            <input className="form-input" onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} value={form.phone} />
          </Field>
          <Field label="Email">
            <input className="form-input" onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} type="email" value={form.email} />
          </Field>
          <Field label="Logo">
            <input className="form-input" onChange={(event) => setForm((current) => ({ ...current, logo: event.target.value }))} value={form.logo} />
          </Field>
          <Field label="Address">
            <input className="form-input" onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} value={form.address} />
          </Field>
          <Field label="Status">
            <select className="form-input" onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as CompanyStatus }))} value={form.status}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
          <div className="flex items-end gap-2">
            <button className="primary-button" type="submit">
              <Plus className="h-4 w-4" />
              {editingId ? "Save Changes" : "Add Company"}
            </button>
            {editingId ? (
              <button className="secondary-button" onClick={() => { setEditingId(""); setForm(emptyForm); }} type="button">
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="app-card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-black text-slate-950">Companies</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Code</th>
                <th>Business Type</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Users</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-black text-slate-950">All Companies</td>
                <td>-</td>
                <td>Admin workspace</td>
                <td>-</td>
                <td><StatusBadge status="active" /></td>
                <td>{users.length}</td>
                <td>-</td>
                <td><button className="secondary-button !px-3 !py-2 !text-xs" onClick={() => switchCompany("all")} type="button">Switch</button></td>
              </tr>
              {companies.map((company) => (
                <tr key={company.id}>
                  <td>
                    <div className="font-black text-slate-950">{company.name}</div>
                    <div className="text-xs font-semibold text-slate-500">{company.address || "No address recorded"}</div>
                  </td>
                  <td>{company.code || "-"}</td>
                  <td>{company.type || "-"}</td>
                  <td>
                    <div className="text-sm font-semibold text-slate-700">{company.phone || "-"}</div>
                    <div className="text-xs font-semibold text-slate-500">{company.email || "-"}</div>
                  </td>
                  <td><StatusBadge status={company.status} /></td>
                  <td>{users.filter((item) => item.companyId === company.id || item.assignedCompanies?.includes(company.id)).length}</td>
                  <td>{company.createdAt.slice(0, 10)}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {company.status !== "archived" ? (
                        <button className="secondary-button !px-3 !py-2 !text-xs" onClick={() => switchCompany(company.id)} type="button">Switch</button>
                      ) : null}
                      <button className="secondary-button !px-3 !py-2 !text-xs" onClick={() => startEdit(company)} type="button"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                      {company.status !== "archived" ? (
                        <button className="secondary-button !px-3 !py-2 !text-xs" onClick={() => toggleStatus(company)} type="button"><Power className="h-3.5 w-3.5" /> {company.status === "active" ? "Deactivate" : "Activate"}</button>
                      ) : null}
                      {company.status !== "archived" ? (
                        <button className="secondary-button !px-3 !py-2 !text-xs" onClick={() => archive(company)} type="button"><Archive className="h-3.5 w-3.5" /> Archive</button>
                      ) : null}
                      <button className="danger-button !px-3 !py-2 !text-xs" onClick={() => setRemoveTarget(company)} type="button"><Trash2 className="h-3.5 w-3.5" /> Remove Company</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!companies.length ? (
                <tr>
                  <td className="text-center text-sm font-semibold text-slate-500" colSpan={8}>
                    No companies yet. Add your first company to begin setup.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {removeTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <section className="w-full max-w-xl rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-950">Remove Company</h3>
                <p className="mt-2 text-sm font-bold text-red-700">
                  Removing a company will also remove all linked records.
                </p>
              </div>
              <button className="secondary-button !px-3 !py-2" onClick={() => setRemoveTarget(null)} type="button">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
              {linkedSummary.total > 0
                ? `${removeTarget.name} has ${linkedSummary.total} linked records. Choose how to handle them.`
                : `${removeTarget.name} has no linked records found.`}
            </div>

            {linkedSummary.byKey.length ? (
              <div className="mt-4 max-h-40 overflow-auto rounded-lg border border-slate-200">
                {linkedSummary.byKey.map((item) => (
                  <div className="flex justify-between border-b border-slate-100 px-3 py-2 text-sm last:border-b-0" key={item.key}>
                    <span className="font-semibold text-slate-600">{item.key}</span>
                    <span className="font-black text-slate-950">{item.count}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-5 grid gap-3">
              <label className="flex gap-3 rounded-lg border border-brand-200 bg-brand-50 p-4">
                <input checked={removeMode === "archive"} onChange={() => setRemoveMode("archive")} type="radio" />
                <span>
                  <span className="block font-black text-brand-900">Archive company</span>
                  <span className="block text-sm font-semibold text-brand-700">Recommended. Hidden from normal users, available to Admin, reports remain available.</span>
                </span>
              </label>
              <label className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                <input checked={removeMode === "permanent"} onChange={() => setRemoveMode("permanent")} type="radio" />
                <span>
                  <span className="block font-black text-red-900">Remove everything permanently</span>
                  <span className="block text-sm font-semibold text-red-700">Deletes the company and linked local records. This cannot be undone.</span>
                </span>
              </label>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button className="secondary-button" onClick={() => setRemoveTarget(null)} type="button">Cancel</button>
              <button className={removeMode === "archive" ? "primary-button" : "danger-button"} onClick={confirmRemove} type="button">
                {removeMode === "archive" ? "Archive Company" : "Remove"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function StatusBadge({ status }: { status: CompanyStatus }) {
  const classes =
    status === "active"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "archived"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-50 text-slate-600";

  return <span className={`status-badge ${classes}`}>{status === "active" ? "Active" : status === "archived" ? "Archived" : "Inactive"}</span>;
}
