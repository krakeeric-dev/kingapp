"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Building2, Pencil, Plus, Power } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { SessionUser } from "@/lib/auth";
import { logAuditEvent } from "@/lib/loading-data";
import {
  createCompany,
  getCompanies,
  setActiveCompanyId,
  updateCompany,
  type Company,
  type CompanyStatus
} from "@/lib/companies-data";
import { getUsers } from "@/lib/users-data";

type CompanyForm = {
  name: string;
  type: string;
  status: CompanyStatus;
};

const emptyForm: CompanyForm = {
  name: "",
  type: "",
  status: "active"
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
  const users = useMemo(() => getUsers(), [companies]);

  useEffect(() => {
    setCompanies(getCompanies());
  }, []);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim() || !form.type.trim()) {
      setMessage("Company name and type are required.");
      return;
    }

    if (editingId) {
      const oldCompany = companies.find((company) => company.id === editingId);
      setCompanies(updateCompany(editingId, form));
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
      name: company.name,
      type: company.type,
      status: company.status
    });
  }

  function toggleStatus(company: Company) {
    setCompanies(
      updateCompany(company.id, {
        name: company.name,
        type: company.type,
        status: company.status === "active" ? "inactive" : "active"
      })
    );
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
              Create companies, control status, view users, and switch the active admin workspace.
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
        <form className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_180px_auto]" onSubmit={save}>
          <Field label="Company Name">
            <input className="form-input" onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} value={form.name} />
          </Field>
          <Field label="Type">
            <input className="form-input" onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} value={form.type} />
          </Field>
          <Field label="Status">
            <select className="form-input" onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as CompanyStatus }))} value={form.status}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
          <div className="flex items-end gap-2">
            <button className="primary-button" type="submit">
              <Plus className="h-4 w-4" />
              {editingId ? "Save" : "Add"}
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
                <th>Type</th>
                <th>Status</th>
                <th>Users</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-black text-slate-950">All Companies</td>
                <td>Super admin workspace</td>
                <td><StatusBadge status="active" /></td>
                <td>{users.length}</td>
                <td>-</td>
                <td><button className="secondary-button !px-3 !py-2 !text-xs" onClick={() => switchCompany("all")} type="button">Switch</button></td>
              </tr>
              {companies.map((company) => (
                <tr key={company.id}>
                  <td className="font-black text-slate-950">{company.name}</td>
                  <td>{company.type}</td>
                  <td><StatusBadge status={company.status} /></td>
                  <td>{users.filter((user) => user.companyId === company.id).length}</td>
                  <td>{company.createdAt.slice(0, 10)}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button className="secondary-button !px-3 !py-2 !text-xs" onClick={() => switchCompany(company.id)} type="button">Switch</button>
                      <button className="secondary-button !px-3 !py-2 !text-xs" onClick={() => startEdit(company)} type="button"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                      <button className="secondary-button !px-3 !py-2 !text-xs" onClick={() => toggleStatus(company)} type="button"><Power className="h-3.5 w-3.5" /> {company.status === "active" ? "Deactivate" : "Activate"}</button>
                    </div>
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

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function StatusBadge({ status }: { status: CompanyStatus }) {
  return (
    <span className={`status-badge ${status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
      {status === "active" ? "Active" : "Inactive"}
    </span>
  );
}
