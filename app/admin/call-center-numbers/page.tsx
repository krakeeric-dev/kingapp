"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PhoneCall, Plus, Save, Send } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { SessionUser } from "@/lib/auth";
import { getCompanies, type Company } from "@/lib/companies-data";
import { getUsers, type PlatformUser } from "@/lib/users-data";
import {
  addCompanyMessageLog,
  addManualCallLog,
  getCallCenterNumbers,
  getCompanyMessageLogs,
  getManualCallLogs,
  saveCallCenterNumber,
  type CallCenterNumber,
  type CallCenterNumberPurpose,
  type CallCenterNumberStatus,
  type CompanyMessageLog,
  type ManualCallLog,
  type ManualCallLogStatus
} from "@/lib/call-center-numbers";
import type { CallType } from "@/lib/call-center-data";

type NumberForm = {
  companyId: string;
  phoneNumber: string;
  label: string;
  purpose: CallCenterNumberPurpose;
  status: CallCenterNumberStatus;
  assignedAgentUsernames: string[];
};

type CallForm = {
  clientName: string;
  clientPhone: string;
  companyId: string;
  callType: CallType;
  summary: string;
  followUp: string;
  status: ManualCallLogStatus;
};

type MessageForm = {
  clientName: string;
  clientPhone: string;
  companyId: string;
  message: string;
  status: CompanyMessageLog["status"];
};

const defaultCompanyId = "COMP-AGAHOZO";
const emptyNumberForm: NumberForm = {
  companyId: defaultCompanyId,
  phoneNumber: "",
  label: "",
  purpose: "Sales Calls",
  status: "Active",
  assignedAgentUsernames: []
};
const emptyCallForm: CallForm = {
  clientName: "",
  clientPhone: "",
  companyId: defaultCompanyId,
  callType: "Customer Care",
  summary: "",
  followUp: "",
  status: "Open"
};
const emptyMessageForm: MessageForm = {
  clientName: "",
  clientPhone: "",
  companyId: defaultCompanyId,
  message: "",
  status: "New"
};

export default function CallCenterNumbersPage() {
  return (
    <AppShell allowedRoles={["admin"]}>
      {(user) => <CallCenterNumbersContent admin={user} />}
    </AppShell>
  );
}

function CallCenterNumbersContent({ admin }: { admin: SessionUser }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [numbers, setNumbers] = useState<CallCenterNumber[]>([]);
  const [callLogs, setCallLogs] = useState<ManualCallLog[]>([]);
  const [messageLogs, setMessageLogs] = useState<CompanyMessageLog[]>([]);
  const [numberForm, setNumberForm] = useState<NumberForm>(emptyNumberForm);
  const [callForm, setCallForm] = useState<CallForm>(emptyCallForm);
  const [messageForm, setMessageForm] = useState<MessageForm>(emptyMessageForm);
  const [editingNumberId, setEditingNumberId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setCompanies(getCompanies().filter((company) => company.id !== "all"));
    setUsers(getUsers());
    setNumbers(getCallCenterNumbers());
    setCallLogs(getManualCallLogs());
    setMessageLogs(getCompanyMessageLogs());
  }, []);

  const agents = useMemo(
    () => users.filter((user) => user.role === "callcenter" || user.role === "manager" || user.role === "admin"),
    [users]
  );

  function toggleAgent(username: string) {
    setNumberForm((current) => ({
      ...current,
      assignedAgentUsernames: current.assignedAgentUsernames.includes(username)
        ? current.assignedAgentUsernames.filter((item) => item !== username)
        : [...current.assignedAgentUsernames, username]
    }));
  }

  function submitNumber(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!numberForm.phoneNumber.trim() || !numberForm.label.trim()) {
      setMessage("Phone number and label are required.");
      return;
    }
    setNumbers(saveCallCenterNumber({ ...numberForm, id: editingNumberId || undefined }));
    setNumberForm(emptyNumberForm);
    setEditingNumberId("");
    setMessage("CCRM number saved.");
  }

  function editNumber(number: CallCenterNumber) {
    setEditingNumberId(number.id);
    setNumberForm({
      companyId: number.companyId,
      phoneNumber: number.phoneNumber,
      label: number.label,
      purpose: number.purpose,
      status: number.status,
      assignedAgentUsernames: number.assignedAgentUsernames
    });
  }

  function submitCallLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!callForm.clientName.trim() || !callForm.clientPhone.trim() || !callForm.summary.trim()) {
      setMessage("Client name, phone, and call summary are required.");
      return;
    }
    setCallLogs(addManualCallLog(callForm, admin));
    setCallForm(emptyCallForm);
    setMessage("Manual call logged.");
  }

  function submitMessageLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!messageForm.clientName.trim() || !messageForm.clientPhone.trim() || !messageForm.message.trim()) {
      setMessage("Client name, phone, and message are required.");
      return;
    }
    setMessageLogs(addCompanyMessageLog(messageForm, admin));
    setMessageForm(emptyMessageForm);
    setMessage("Message logged.");
  }

  return (
    <div className="space-y-6">
      <section className="app-card-soft p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <PhoneCall className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-950">Customer Care & Relationship Management (CCRM) Numbers</h2>
            <p className="mt-1 text-sm text-slate-600">
              Manage company phone lines, agent assignment, manual call logs, and company message logs.
            </p>
          </div>
        </div>
      </section>

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
        <form className="app-card p-5" onSubmit={submitNumber}>
          <h3 className="text-lg font-black text-slate-950">{editingNumberId ? "Edit Number" : "Add Number"}</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Company">
              <select className="form-input" onChange={(event) => setNumberForm((current) => ({ ...current, companyId: event.target.value }))} value={numberForm.companyId}>
                {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </Field>
            <Field label="Phone Number">
              <input className="form-input" onChange={(event) => setNumberForm((current) => ({ ...current, phoneNumber: event.target.value }))} value={numberForm.phoneNumber} />
            </Field>
            <Field label="Label">
              <input className="form-input" onChange={(event) => setNumberForm((current) => ({ ...current, label: event.target.value }))} value={numberForm.label} />
            </Field>
            <Field label="Purpose">
              <select className="form-input" onChange={(event) => setNumberForm((current) => ({ ...current, purpose: event.target.value as CallCenterNumberPurpose }))} value={numberForm.purpose}>
                {["Sales Calls", "Customer Support", "Payment Follow-up", "Complaints", "Delivery Support"].map((purpose) => <option key={purpose} value={purpose}>{purpose}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className="form-input" onChange={(event) => setNumberForm((current) => ({ ...current, status: event.target.value as CallCenterNumberStatus }))} value={numberForm.status}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </Field>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-sm font-bold text-slate-700">Assigned Agents</p>
            <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
              {agents.map((agent) => (
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700" key={agent.username}>
                  <input checked={numberForm.assignedAgentUsernames.includes(agent.username)} className="h-4 w-4 rounded border-slate-300 text-brand-700" onChange={() => toggleAgent(agent.username)} type="checkbox" />
                  {agent.displayName}
                </label>
              ))}
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button className="primary-button" type="submit"><Save className="h-4 w-4" /> Save number</button>
            {editingNumberId ? <button className="secondary-button" onClick={() => { setEditingNumberId(""); setNumberForm(emptyNumberForm); }} type="button">Cancel</button> : null}
          </div>
        </form>

        <section className="app-card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-lg font-black text-slate-950">Company Numbers</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Company</th><th>Number</th><th>Label</th><th>Purpose</th><th>Status</th><th>Agents</th><th>Action</th></tr></thead>
              <tbody>
                {numbers.map((number) => (
                  <tr key={number.id}>
                    <td>{number.companyName}</td>
                    <td className="font-black text-slate-950">{number.phoneNumber}</td>
                    <td>{number.label}</td>
                    <td>{number.purpose}</td>
                    <td><Status status={number.status} /></td>
                    <td>{number.assignedAgentUsernames.join(", ") || "-"}</td>
                    <td><button className="secondary-button !px-3 !py-2 !text-xs" onClick={() => editNumber(number)} type="button">Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <form className="app-card p-5" onSubmit={submitCallLog}>
          <h3 className="text-lg font-black text-slate-950">Manual Call Log</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Client Name"><input className="form-input" onChange={(event) => setCallForm((current) => ({ ...current, clientName: event.target.value }))} value={callForm.clientName} /></Field>
            <Field label="Client Phone"><input className="form-input" onChange={(event) => setCallForm((current) => ({ ...current, clientPhone: event.target.value }))} value={callForm.clientPhone} /></Field>
            <Field label="Company"><CompanySelect companies={companies} onChange={(companyId) => setCallForm((current) => ({ ...current, companyId }))} value={callForm.companyId} /></Field>
            <Field label="Call Type"><select className="form-input" onChange={(event) => setCallForm((current) => ({ ...current, callType: event.target.value as CallType }))} value={callForm.callType}>{["New Order", "Reorder", "Complaint", "Payment Follow-up", "Customer Care", "New Client Prospect"].map((type) => <option key={type} value={type}>{type}</option>)}</select></Field>
            <Field label="Status"><select className="form-input" onChange={(event) => setCallForm((current) => ({ ...current, status: event.target.value as ManualCallLogStatus }))} value={callForm.status}><option value="Open">Open</option><option value="Closed">Closed</option><option value="Pending Follow-up">Pending Follow-up</option></select></Field>
            <Field label="Follow-up"><input className="form-input" onChange={(event) => setCallForm((current) => ({ ...current, followUp: event.target.value }))} value={callForm.followUp} /></Field>
            <label className="block sm:col-span-2"><span className="mb-2 block text-sm font-bold text-slate-700">Summary</span><textarea className="form-input min-h-24" onChange={(event) => setCallForm((current) => ({ ...current, summary: event.target.value }))} value={callForm.summary} /></label>
          </div>
          <button className="primary-button mt-4" type="submit"><Plus className="h-4 w-4" /> Log call</button>
        </form>

        <form className="app-card p-5" onSubmit={submitMessageLog}>
          <h3 className="text-lg font-black text-slate-950">Message Log</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Client Name"><input className="form-input" onChange={(event) => setMessageForm((current) => ({ ...current, clientName: event.target.value }))} value={messageForm.clientName} /></Field>
            <Field label="Client Phone"><input className="form-input" onChange={(event) => setMessageForm((current) => ({ ...current, clientPhone: event.target.value }))} value={messageForm.clientPhone} /></Field>
            <Field label="Company"><CompanySelect companies={companies} onChange={(companyId) => setMessageForm((current) => ({ ...current, companyId }))} value={messageForm.companyId} /></Field>
            <Field label="Status"><select className="form-input" onChange={(event) => setMessageForm((current) => ({ ...current, status: event.target.value as CompanyMessageLog["status"] }))} value={messageForm.status}><option value="New">New</option><option value="Read">Read</option><option value="Replied">Replied</option><option value="Closed">Closed</option></select></Field>
            <label className="block sm:col-span-2"><span className="mb-2 block text-sm font-bold text-slate-700">Message</span><textarea className="form-input min-h-24" onChange={(event) => setMessageForm((current) => ({ ...current, message: event.target.value }))} value={messageForm.message} /></label>
          </div>
          <button className="primary-button mt-4" type="submit"><Send className="h-4 w-4" /> Log message</button>
        </form>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <LogTable title="Recent Manual Calls" rows={callLogs.map((log) => [log.companyName, log.clientName, log.clientPhone, log.callType, log.status])} />
        <LogTable title="Recent Message Logs" rows={messageLogs.map((log) => [log.companyName, log.clientName, log.clientPhone, log.status, log.message])} />
      </section>
    </div>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>{children}</label>;
}

function CompanySelect({ companies, onChange, value }: { companies: Company[]; onChange: (companyId: string) => void; value: string }) {
  return (
    <select className="form-input" onChange={(event) => onChange(event.target.value)} value={value}>
      {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
    </select>
  );
}

function Status({ status }: { status: string }) {
  return <span className={`status-badge ${status === "Active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{status}</span>;
}

function LogTable({ rows, title }: { rows: string[][]; title: string }) {
  return (
    <section className="app-card overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4"><h3 className="text-lg font-black text-slate-950">{title}</h3></div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <tbody>
            {rows.slice(0, 8).map((row, index) => (
              <tr key={`${title}-${index}`}>{row.map((cell, cellIndex) => <td key={`${title}-${index}-${cellIndex}`}>{cell || "-"}</td>)}</tr>
            ))}
            {!rows.length ? <tr><td className="text-slate-500">No records yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
