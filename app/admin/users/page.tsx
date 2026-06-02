"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  KeyRound,
  Pencil,
  Plus,
  Power,
  Trash2,
  UserRound
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { SessionUser, UserRole } from "@/lib/auth";
import { roleLabels } from "@/lib/auth";
import { getCompanies, type Company } from "@/lib/companies-data";
import { formatDate } from "@/lib/loading-data";
import {
  createUser,
  getUsers,
  removeUser,
  resetUserPassword,
  updateUser,
  type PlatformUser,
  type UserStatus
} from "@/lib/users-data";

type AddFormState = {
  displayName: string;
  username: string;
  password: string;
  confirmPassword: string;
  role: UserRole | "";
  phone: string;
  email: string;
  companyId: string;
  status: UserStatus;
};

type EditFormState = {
  displayName: string;
  role: UserRole;
  phone: string;
  email: string;
  companyId: string;
  status: UserStatus;
};

const roleOptions: UserRole[] = [
  "admin",
  "manager",
  "supervisor",
  "storekeeper",
  "marketer",
  "accountant",
  "callcenter",
  "supplier",
  "client"
];

const emptyAddForm: AddFormState = {
  displayName: "",
  username: "",
  password: "",
  confirmPassword: "",
  role: "",
  phone: "",
  email: "",
  companyId: "COMP-AGAHOZO",
  status: "active"
};

export default function UsersPage() {
  return (
    <AppShell allowedRoles={["admin"]}>
      {(user) => <UsersContent admin={user} />}
    </AppShell>
  );
}

function UsersContent({ admin }: { admin: SessionUser }) {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [addForm, setAddForm] = useState<AddFormState>(emptyAddForm);
  const [editingUsername, setEditingUsername] = useState("");
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [resetUsername, setResetUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setUsers(getUsers());
    setCompanies(getCompanies());
  }, []);

  const sortedUsers = useMemo(() => {
    return [...users].sort((first, second) =>
      first.displayName.localeCompare(second.displayName)
    );
  }, [users]);

  function updateAddForm(field: keyof AddFormState, value: string) {
    setAddForm((current) => ({ ...current, [field]: value }));
  }

  function validateAddForm() {
    if (!addForm.displayName.trim()) {
      return "Full name is required.";
    }

    if (!addForm.username.trim()) {
      return "Username is required.";
    }

    if (
      users.some(
        (user) =>
          user.username.toLowerCase() === addForm.username.trim().toLowerCase()
      )
    ) {
      return "Username must be unique.";
    }

    if (!addForm.role) {
      return "Role is required.";
    }

    if (!addForm.password) {
      return "Password is required.";
    }

    if (addForm.password !== addForm.confirmPassword) {
      return "Password and confirm password must match.";
    }

    return "";
  }

  function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const validationError = validateAddForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    const updatedUsers = createUser(
      {
        displayName: addForm.displayName,
        username: addForm.username,
        password: addForm.password,
        role: addForm.role as UserRole,
        name: addForm.displayName,
        companyId: addForm.companyId,
        companyName: companies.find((company) => company.id === addForm.companyId)?.name ?? "",
        phone: addForm.phone,
        email: addForm.email,
        status: addForm.status
      },
      admin
    );
    setUsers(updatedUsers);
    setAddForm(emptyAddForm);
    setMessage("User created successfully.");
  }

  function startEdit(user: PlatformUser) {
    setError("");
    setMessage("");
    setEditingUsername(user.username);
    setEditForm({
      displayName: user.displayName,
      role: user.role,
      phone: user.phone,
      email: user.email,
      companyId: user.companyId,
      status: user.status
    });
  }

  function handleEditUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!editForm) {
      return;
    }

    if (!editForm.displayName.trim()) {
      setError("Full name is required.");
      return;
    }

    const updatedUsers = updateUser(editingUsername, editForm, admin);
    setUsers(updatedUsers);
    setEditingUsername("");
    setEditForm(null);
    setMessage("User updated successfully.");
  }

  function handleDeactivate(user: PlatformUser) {
    const updatedUsers = updateUser(
      user.username,
      {
        displayName: user.displayName,
        role: user.role,
        phone: user.phone,
        email: user.email,
        companyId: user.companyId,
        status: user.status === "active" ? "inactive" : "active"
      },
      admin
    );
    setUsers(updatedUsers);
    setMessage(
      user.status === "active" ? "User deactivated." : "User activated."
    );
  }

  function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!newPassword.trim()) {
      setError("Enter a new password.");
      return;
    }

    const updatedUsers = resetUserPassword(resetUsername, newPassword, admin);
    setUsers(updatedUsers);
    setResetUsername("");
    setNewPassword("");
    setMessage("Password reset successfully.");
  }

  function handleRemove(user: PlatformUser) {
    if (!window.confirm("Are you sure you want to remove this user?")) {
      return;
    }

    const updatedUsers = removeUser(user.username, admin);
    setUsers(updatedUsers);
    setMessage("User removed.");
  }

  return (
    <div className="space-y-6">
      <div className="app-card-soft p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <UserRound className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-950">
              User Management
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Add, edit, deactivate, reset, and remove KingApp platform users.
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </div>
      ) : null}

      <section className="app-card p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Plus className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-950">Add User</h3>
            <p className="text-sm font-semibold text-slate-500">
              New active users can log in immediately.
            </p>
          </div>
        </div>
        <form className="grid gap-4 lg:grid-cols-4" onSubmit={handleCreateUser}>
          <Field label="Full name">
            <input
              className="form-input"
              onChange={(event) => updateAddForm("displayName", event.target.value)}
              value={addForm.displayName}
            />
          </Field>
          <Field label="Username">
            <input
              className="form-input"
              onChange={(event) => updateAddForm("username", event.target.value)}
              value={addForm.username}
            />
          </Field>
          <Field label="Password">
            <input
              className="form-input"
              onChange={(event) => updateAddForm("password", event.target.value)}
              type="password"
              value={addForm.password}
            />
          </Field>
          <Field label="Confirm password">
            <input
              className="form-input"
              onChange={(event) =>
                updateAddForm("confirmPassword", event.target.value)
              }
              type="password"
              value={addForm.confirmPassword}
            />
          </Field>
          <Field label="Role">
            <select
              className="form-input"
              onChange={(event) => updateAddForm("role", event.target.value)}
              value={addForm.role}
            >
              <option value="">Select role</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Company">
            <select
              className="form-input"
              onChange={(event) => updateAddForm("companyId", event.target.value)}
              value={addForm.companyId}
            >
              <option value="all">All Companies</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Phone">
            <input
              className="form-input"
              onChange={(event) => updateAddForm("phone", event.target.value)}
              value={addForm.phone}
            />
          </Field>
          <Field label="Email">
            <input
              className="form-input"
              onChange={(event) => updateAddForm("email", event.target.value)}
              type="email"
              value={addForm.email}
            />
          </Field>
          <Field label="Status">
            <select
              className="form-input"
              onChange={(event) => updateAddForm("status", event.target.value)}
              value={addForm.status}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
          <div className="lg:col-span-4">
            <button className="primary-button" type="submit">
              <Plus className="h-4 w-4" />
              Add user
            </button>
          </div>
        </form>
      </section>

      <section className="app-card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-black text-slate-950">User List</h3>
        </div>
        <div className="hidden overflow-x-auto xl:block">
          <table className="data-table">
            <thead>
              <tr>
                <th>Full name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Company</th>
                <th>Status</th>
                <th>Created date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((user) => (
                <tr key={user.username}>
                  <td className="font-bold text-slate-950">{user.displayName}</td>
                  <td>{user.username}</td>
                  <td>{roleLabels[user.role]}</td>
                  <td>{user.phone || "-"}</td>
                  <td>{user.email || "-"}</td>
                  <td>{user.companyName || "-"}</td>
                  <td>
                    <StatusBadge status={user.status} />
                  </td>
                  <td>{formatDate(user.createdAt.slice(0, 10))}</td>
                  <td>
                    <ActionButtons
                      onDeactivate={() => handleDeactivate(user)}
                      onEdit={() => startEdit(user)}
                      onRemove={() => handleRemove(user)}
                      onReset={() => setResetUsername(user.username)}
                      status={user.status}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 p-4 xl:hidden">
          {sortedUsers.map((user) => (
            <article className="rounded-lg border border-slate-200 p-4" key={user.username}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-black text-slate-950">{user.displayName}</h4>
                  <p className="text-sm font-semibold text-slate-500">
                    {user.username} - {roleLabels[user.role]}
                  </p>
                </div>
                <StatusBadge status={user.status} />
              </div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <Info label="Phone" value={user.phone || "-"} />
                <Info label="Email" value={user.email || "-"} />
                <Info label="Company" value={user.companyName || "-"} />
                <Info label="Created" value={formatDate(user.createdAt.slice(0, 10))} />
              </div>
              <div className="mt-4">
                <ActionButtons
                  onDeactivate={() => handleDeactivate(user)}
                  onEdit={() => startEdit(user)}
                  onRemove={() => handleRemove(user)}
                  onReset={() => setResetUsername(user.username)}
                  status={user.status}
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      {editingUsername && editForm ? (
        <section className="app-card p-5">
          <h3 className="text-lg font-black text-slate-950">
            Edit user: {editingUsername}
          </h3>
          <form className="mt-4 grid gap-4 lg:grid-cols-6" onSubmit={handleEditUser}>
            <Field label="Full name">
              <input
                className="form-input"
                onChange={(event) =>
                  setEditForm((current) =>
                    current ? { ...current, displayName: event.target.value } : current
                  )
                }
                value={editForm.displayName}
              />
            </Field>
            <Field label="Role">
              <select
                className="form-input"
                onChange={(event) =>
                  setEditForm((current) =>
                    current
                      ? { ...current, role: event.target.value as UserRole }
                      : current
                  )
                }
                value={editForm.role}
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {roleLabels[role]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Phone">
              <input
                className="form-input"
                onChange={(event) =>
                  setEditForm((current) =>
                    current ? { ...current, phone: event.target.value } : current
                  )
                }
                value={editForm.phone}
              />
            </Field>
            <Field label="Company">
              <select
                className="form-input"
                onChange={(event) =>
                  setEditForm((current) =>
                    current ? { ...current, companyId: event.target.value } : current
                  )
                }
                value={editForm.companyId}
              >
                <option value="all">All Companies</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Email">
              <input
                className="form-input"
                onChange={(event) =>
                  setEditForm((current) =>
                    current ? { ...current, email: event.target.value } : current
                  )
                }
                type="email"
                value={editForm.email}
              />
            </Field>
            <Field label="Status">
              <select
                className="form-input"
                onChange={(event) =>
                  setEditForm((current) =>
                    current
                      ? { ...current, status: event.target.value as UserStatus }
                      : current
                  )
                }
                value={editForm.status}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
            <div className="flex flex-col gap-2 sm:flex-row lg:col-span-6">
              <button className="primary-button" type="submit">
                Save changes
              </button>
              <button
                className="secondary-button"
                onClick={() => {
                  setEditingUsername("");
                  setEditForm(null);
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {resetUsername ? (
        <section className="app-card p-5">
          <h3 className="text-lg font-black text-slate-950">
            Reset password: {resetUsername}
          </h3>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]"
            onSubmit={handleResetPassword}
          >
            <input
              className="form-input"
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="New password"
              type="password"
              value={newPassword}
            />
            <div className="flex gap-2">
              <button className="primary-button" type="submit">
                Save password
              </button>
              <button
                className="secondary-button"
                onClick={() => {
                  setResetUsername("");
                  setNewPassword("");
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}

function Field({
  children,
  label
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function StatusBadge({ status }: { status: UserStatus }) {
  return (
    <span
      className={`status-badge ${
        status === "active"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      {status === "active" ? "Active" : "Inactive"}
    </span>
  );
}

function ActionButtons({
  onDeactivate,
  onEdit,
  onRemove,
  onReset,
  status
}: {
  onDeactivate: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onReset: () => void;
  status: UserStatus;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button className="secondary-button !px-3 !py-2 !text-xs" onClick={onEdit} type="button">
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </button>
      <button className="secondary-button !px-3 !py-2 !text-xs" onClick={onReset} type="button">
        <KeyRound className="h-3.5 w-3.5" />
        Reset
      </button>
      <button className="secondary-button !px-3 !py-2 !text-xs" onClick={onDeactivate} type="button">
        <Power className="h-3.5 w-3.5" />
        {status === "active" ? "Deactivate" : "Activate"}
      </button>
      <button
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 shadow-sm transition hover:bg-red-50"
        onClick={onRemove}
        type="button"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Remove
      </button>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-xs font-bold uppercase tracking-normal text-slate-500">
        {label}
      </span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
