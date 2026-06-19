"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileText,
  MapPin,
  Send,
  ShieldAlert,
  Timer,
  UserCheck
} from "lucide-react";
import { CallCenterShell } from "@/components/CallCenterShell";
import type { SessionUser } from "@/lib/auth";
import {
  changeIssueStatus,
  closeIssueCase,
  createIssueCase,
  dispatchIssueCase,
  getExecutiveIssueAlerts,
  getIssueCaseById,
  getIssueCasesForUser,
  getIssueStats,
  groupIssues,
  issueCategories,
  issuePriorities,
  issueSourceChannels,
  issueStatuses,
  resolveIssueCase,
  submitInvestigation,
  type CcrmIssueCase,
  type IssueCategory,
  type IssuePriority,
  type IssueSourceChannel,
  type IssueStatus
} from "@/lib/ccrm-issues";
import { getCompanies } from "@/lib/companies-data";

type IssueView = "dashboard" | "new" | "detail" | "dispatch" | "investigations" | "resolution" | "reports";

export function CcrmIssuesWorkspace({ view }: { view: IssueView }) {
  const titles: Record<IssueView, string> = {
    dashboard: "Issue Dispatch & Resolution Center",
    detail: "Case Detail",
    dispatch: "Investigation Dispatch",
    investigations: "Field Investigations",
    new: "Create Structured Issue Case",
    reports: "Issue Reports",
    resolution: "Resolution Center"
  };

  return (
    <CallCenterShell title={titles[view]} subtitle="Structured cases, evidence, investigations, escalation and closure">
      {(user) => <IssueContent user={user} view={view} />}
    </CallCenterShell>
  );
}

function IssueContent({ user, view }: { user: SessionUser; view: IssueView }) {
  const params = useParams<{ id?: string }>();
  const [cases, setCases] = useState<CcrmIssueCase[]>([]);

  function refresh() {
    setCases(safeLoadCases(user));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const selectedCase = params?.id ? getIssueCaseById(params.id, user) : cases[0] ?? null;

  if (view === "new") return <NewIssueForm user={user} onCreated={refresh} />;
  if (view === "detail") return <CaseDetail issue={selectedCase} user={user} onChanged={refresh} />;
  if (view === "dispatch") return <DispatchView cases={cases} user={user} onChanged={refresh} />;
  if (view === "investigations") return <InvestigationsView cases={cases} user={user} onChanged={refresh} />;
  if (view === "resolution") return <ResolutionView cases={cases} user={user} onChanged={refresh} />;
  if (view === "reports") return <ReportsView cases={cases} />;
  return <DashboardView cases={cases} />;
}

function DashboardView({ cases }: { cases: CcrmIssueCase[] }) {
  const stats = getIssueStats(cases);
  const alerts = getExecutiveIssueAlerts(cases);
  return (
    <div className="space-y-6">
      <IssueActions />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={ClipboardList} label="Open Cases" value={stats.openCases} />
        <Kpi icon={CheckCircle2} label="Resolved Cases" value={stats.resolvedCases} />
        <Kpi icon={ShieldAlert} label="Critical Cases" value={stats.criticalCases} danger />
        <Kpi icon={Timer} label="Overdue Cases" value={stats.overdueCases} danger={stats.overdueCases > 0} />
        <Kpi icon={UserCheck} label="Active Investigations" value={stats.activeInvestigations} />
        <Kpi icon={AlertTriangle} label="Escalated Cases" value={stats.escalatedCases} danger={stats.escalatedCases > 0} />
        <Kpi icon={BarChart3} label="Avg. Resolution Time" value={stats.averageResolutionTime} />
        <Kpi icon={FileText} label="Cases Today" value={stats.casesToday} />
      </div>

      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <CaseQueue cases={cases} />
        <AlertPanel alerts={alerts} />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <MiniChart title="Cases by Product" rows={groupIssues(cases, "productName")} />
        <MiniChart title="Cases by Region" rows={groupIssues(cases, "region")} />
        <MiniChart title="Cases by Department" rows={groupIssues(cases, "assignedDepartment")} />
        <MiniChart title="Cases by Category" rows={groupIssues(cases, "category")} />
        <MiniChart title="Cases by Priority" rows={groupIssues(cases, "priority")} />
        <MiniChart title="Cases by Status" rows={groupIssues(cases, "status")} />
      </section>
    </div>
  );
}

function NewIssueForm({ onCreated, user }: { onCreated: () => void; user: SessionUser }) {
  const router = useRouter();
  const companies = useMemo(() => safeCompanies(), []);
  const [form, setForm] = useState({
    batchNumber: "",
    category: "Customer Complaint" as IssueCategory,
    companyId: user.companyId === "all" ? "" : user.companyId,
    customerId: "",
    customerName: "",
    customerPhone: "",
    description: "",
    evidence: "",
    gpsLocation: "",
    priority: "" as "" | IssuePriority,
    productId: "",
    productName: "",
    region: "",
    sourceChannel: "CCRM Messages" as IssueSourceChannel
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const company = companies.find((item) => item.id === form.companyId);
    const { issue } = createIssueCase({
      ...form,
      companyName: company?.name ?? user.companyName,
      priority: form.priority || undefined
    }, user);
    onCreated();
    router.push(`/ccrm/issues/${issue.id}`);
  }

  return (
    <form className="grid gap-5 xl:grid-cols-[1fr_340px]" onSubmit={submit}>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-xl font-black text-slate-950">New Issue Case</h3>
        <p className="mt-1 text-sm font-semibold text-slate-500">Convert a call, message, complaint, email, or field report into a structured case.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Customer Name" required value={form.customerName} onChange={(value) => setForm({ ...form, customerName: value })} />
          <Field label="Customer Phone" value={form.customerPhone} onChange={(value) => setForm({ ...form, customerPhone: value })} />
          <Field label="Customer ID" value={form.customerId} onChange={(value) => setForm({ ...form, customerId: value })} />
          <Field label="Region" value={form.region} onChange={(value) => setForm({ ...form, region: value })} />
          <SelectField label="Category" value={form.category} options={issueCategories} onChange={(value) => setForm({ ...form, category: value as IssueCategory })} />
          <SelectField label="Source Channel" value={form.sourceChannel} options={issueSourceChannels} onChange={(value) => setForm({ ...form, sourceChannel: value as IssueSourceChannel })} />
          <SelectField label="Priority Override" value={form.priority} options={["", ...issuePriorities]} onChange={(value) => setForm({ ...form, priority: value as "" | IssuePriority })} />
          <SelectField label="Company" value={form.companyId} options={["", ...companies.map((company) => company.id)]} optionLabels={{ "": "Current company", ...Object.fromEntries(companies.map((company) => [company.id, company.name])) }} onChange={(value) => setForm({ ...form, companyId: value })} />
          <Field label="Product ID" value={form.productId} onChange={(value) => setForm({ ...form, productId: value })} />
          <Field label="Product Name" value={form.productName} onChange={(value) => setForm({ ...form, productName: value })} />
          <Field label="Batch Number" value={form.batchNumber} onChange={(value) => setForm({ ...form, batchNumber: value })} />
          <Field label="GPS Location" value={form.gpsLocation} onChange={(value) => setForm({ ...form, gpsLocation: value })} />
          <label className="md:col-span-2">
            <span className="text-sm font-black text-slate-700">Description</span>
            <textarea className="form-input mt-2 min-h-28" required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>
          <label className="md:col-span-2">
            <span className="text-sm font-black text-slate-700">Evidence Notes</span>
            <textarea className="form-input mt-2 min-h-24" value={form.evidence} onChange={(event) => setForm({ ...form, evidence: event.target.value })} placeholder="Photos, videos, voice notes, documents, GPS notes, or links can be referenced here." />
          </label>
        </div>
      </section>
      <aside className="rounded-xl border border-blue-100 bg-blue-50 p-5">
        <h3 className="font-black text-blue-950">Automatic Routing</h3>
        <p className="mt-3 text-sm font-semibold text-blue-800">Priority and department are assigned automatically from issue category, batch history, and risk indicators.</p>
        <button className="primary-button mt-6 w-full" type="submit"><Send className="h-4 w-4" /> Create Case</button>
      </aside>
    </form>
  );
}

function CaseDetail({ issue, onChanged, user }: { issue: CcrmIssueCase | null; onChanged: () => void; user: SessionUser }) {
  if (!issue) return <EmptyState title="No cases yet." body="Create the first issue case when a customer message, call, complaint, or report arrives." />;
  return (
    <div className="grid gap-5 xl:grid-cols-[320px_1fr_340px]">
      <CaseSummary issue={issue} />
      <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-black uppercase text-slate-400">Description</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{issue.description || "No description recorded."}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Info label="Product" value={issue.productName || "Not recorded"} />
          <Info label="Batch Number" value={issue.batchNumber || "Not recorded"} />
          <Info label="GPS Location" value={issue.gpsLocation || "Not recorded"} />
          <Info label="Resolution Deadline" value={issue.resolutionDeadline || "Not set"} />
        </div>
        <div>
          <p className="text-xs font-black uppercase text-slate-400">Status Timeline</p>
          <div className="mt-3 space-y-3">
            {issue.timeline.map((item) => (
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3" key={item.id}>
                <p className="font-black text-slate-950">{item.status}</p>
                <p className="text-sm font-semibold text-slate-600">{item.note}</p>
                <p className="mt-1 text-xs font-bold text-slate-400">{item.by} - {new Date(item.at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <aside className="space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-black text-slate-950">Actions</h3>
          <div className="mt-4 space-y-2">
            {issueStatuses.map((status) => (
              <button className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-black text-slate-700 hover:bg-slate-50" key={status} onClick={() => { changeIssueStatus(issue.id, status, user); onChanged(); }} type="button">
                Mark {status}
              </button>
            ))}
            <button className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-black text-white" onClick={() => { closeIssueCase(issue.id, user); onChanged(); }} type="button">Close Case</button>
          </div>
        </section>
        <AlertPanel alerts={getExecutiveIssueAlerts([issue])} />
      </aside>
    </div>
  );
}

function DispatchView({ cases, onChanged, user }: { cases: CcrmIssueCase[]; onChanged: () => void; user: SessionUser }) {
  const candidates = cases.filter((issue) => issue.status === "Open" || issue.status === "Assigned");
  const [caseId, setCaseId] = useState("");
  const [form, setForm] = useState({ assignedPerson: "", department: "Customer Care Department", dueDate: "", instructions: "", location: "", priority: "Medium" as IssuePriority });
  const selected = candidates.find((issue) => issue.id === caseId) ?? candidates[0] ?? null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    dispatchIssueCase(selected.id, {
      assignedPerson: form.assignedPerson,
      department: form.department,
      dueDate: form.dueDate,
      investigationInstructions: form.instructions,
      location: form.location,
      priority: form.priority
    }, user);
    onChanged();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
      <CaseQueue cases={candidates} empty="No cases waiting for dispatch." />
      <form className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={submit}>
        <h3 className="text-xl font-black text-slate-950">Dispatch Investigation</h3>
        <div className="mt-5 space-y-4">
          <SelectField label="Case" value={selected?.id ?? ""} options={candidates.map((issue) => issue.id)} optionLabels={Object.fromEntries(candidates.map((issue) => [issue.id, `${issue.caseNumber} - ${issue.customerName}`]))} onChange={setCaseId} />
          <Field label="Assigned Person" required value={form.assignedPerson} onChange={(value) => setForm({ ...form, assignedPerson: value })} />
          <Field label="Department" value={form.department} onChange={(value) => setForm({ ...form, department: value })} />
          <Field label="Due Date" type="date" required value={form.dueDate} onChange={(value) => setForm({ ...form, dueDate: value })} />
          <Field label="Location" value={form.location} onChange={(value) => setForm({ ...form, location: value })} />
          <SelectField label="Priority" value={form.priority} options={issuePriorities} onChange={(value) => setForm({ ...form, priority: value as IssuePriority })} />
          <label>
            <span className="text-sm font-black text-slate-700">Investigation Instructions</span>
            <textarea className="form-input mt-2 min-h-28" required value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} />
          </label>
          <button className="primary-button w-full" disabled={!selected} type="submit">Dispatch Investigation</button>
        </div>
      </form>
    </div>
  );
}

function InvestigationsView({ cases, onChanged, user }: { cases: CcrmIssueCase[]; onChanged: () => void; user: SessionUser }) {
  const investigations = cases.flatMap((issue) => issue.investigations.map((investigation) => ({ investigation, issue })));
  return (
    <div className="space-y-5">
      {investigations.map(({ investigation, issue }) => (
        <InvestigationCard investigationId={investigation.id} issue={issue} key={investigation.id} onChanged={onChanged} user={user} />
      ))}
      {!investigations.length ? <EmptyState title="No investigations yet." body="Dispatched investigations will appear here for field follow-up and evidence submission." /> : null}
    </div>
  );
}

function InvestigationCard({ investigationId, issue, onChanged, user }: { investigationId: string; issue: CcrmIssueCase; onChanged: () => void; user: SessionUser }) {
  const investigation = issue.investigations.find((item) => item.id === investigationId);
  const [form, setForm] = useState({ findings: "", gpsLocation: investigation?.gpsLocation ?? "", recommendation: "" });
  if (!investigation) return null;
  return (
    <form className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={(event) => {
      event.preventDefault();
      submitInvestigation(issue.id, investigation.id, form, user);
      onChanged();
    }}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-950">{issue.caseNumber} - {issue.customerName}</h3>
          <p className="text-sm font-semibold text-slate-500">{investigation.department} - Assigned to {investigation.assignedPerson}</p>
        </div>
        <PriorityBadge priority={issue.priority} />
      </div>
      <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-600">{investigation.investigationInstructions}</p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Field label="Findings" value={form.findings} onChange={(value) => setForm({ ...form, findings: value })} />
        <Field label="GPS Location" value={form.gpsLocation} onChange={(value) => setForm({ ...form, gpsLocation: value })} />
        <Field label="Recommendation" value={form.recommendation} onChange={(value) => setForm({ ...form, recommendation: value })} />
      </div>
      <button className="primary-button mt-4" type="submit">Submit Investigation Report</button>
    </form>
  );
}

function ResolutionView({ cases, onChanged, user }: { cases: CcrmIssueCase[]; onChanged: () => void; user: SessionUser }) {
  const active = cases.filter((issue) => issue.status !== "Closed");
  const [caseId, setCaseId] = useState("");
  const selected = active.find((issue) => issue.id === caseId) ?? active[0] ?? null;
  const [form, setForm] = useState({ customerFeedback: "", responsibleDepartment: "", solution: "" });
  return (
    <form className="grid gap-5 xl:grid-cols-[1fr_420px]" onSubmit={(event) => {
      event.preventDefault();
      if (!selected) return;
      resolveIssueCase(selected.id, form, user);
      onChanged();
    }}>
      <CaseQueue cases={active} empty="No open cases to resolve." />
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-xl font-black text-slate-950">Resolve Case</h3>
        <div className="mt-5 space-y-4">
          <SelectField label="Case" value={selected?.id ?? ""} options={active.map((issue) => issue.id)} optionLabels={Object.fromEntries(active.map((issue) => [issue.id, `${issue.caseNumber} - ${issue.customerName}`]))} onChange={setCaseId} />
          <Field label="Responsible Department" required value={form.responsibleDepartment} onChange={(value) => setForm({ ...form, responsibleDepartment: value })} />
          <label>
            <span className="text-sm font-black text-slate-700">Solution</span>
            <textarea className="form-input mt-2 min-h-28" required value={form.solution} onChange={(event) => setForm({ ...form, solution: event.target.value })} />
          </label>
          <label>
            <span className="text-sm font-black text-slate-700">Customer Feedback</span>
            <textarea className="form-input mt-2 min-h-24" value={form.customerFeedback} onChange={(event) => setForm({ ...form, customerFeedback: event.target.value })} />
          </label>
          <button className="primary-button w-full" disabled={!selected} type="submit">Mark Resolved</button>
        </div>
      </section>
    </form>
  );
}

function ReportsView({ cases }: { cases: CcrmIssueCase[] }) {
  return (
    <div className="space-y-6">
      <DashboardView cases={cases} />
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-xl font-black text-slate-950">Issue Report Table</h3>
        <CaseTable cases={cases} />
      </section>
    </div>
  );
}

function IssueActions() {
  const links = [
    ["/ccrm/issues/new", "Create Case"],
    ["/ccrm/issues/dispatch", "Dispatch"],
    ["/ccrm/issues/investigations", "Investigations"],
    ["/ccrm/issues/resolution", "Resolution"],
    ["/ccrm/issues/reports", "Reports"]
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {links.map(([href, label]) => (
        <Link className="rounded-lg border border-blue-100 bg-white px-4 py-2 text-sm font-black text-blue-700 shadow-sm hover:bg-blue-50" href={href} key={href}>{label}</Link>
      ))}
    </div>
  );
}

function CaseQueue({ cases, empty = "No cases yet." }: { cases: CcrmIssueCase[]; empty?: string }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-xl font-black text-slate-950">Case Queue</h3>
        <Link className="text-sm font-black text-blue-700" href="/ccrm/issues/new">New Case</Link>
      </div>
      <CaseTable cases={cases} />
      {!cases.length ? <EmptyState compact title={empty} body="No cases match this workspace or company filter." /> : null}
    </section>
  );
}

function CaseTable({ cases }: { cases: CcrmIssueCase[] }) {
  if (!cases.length) return null;
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Case</th><th>Customer</th><th>Company</th><th>Product</th><th>Category</th><th>Priority</th><th>Department</th><th>Status</th><th>Due</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((issue) => (
            <tr key={issue.id}>
              <td><Link className="font-black text-blue-700" href={`/ccrm/issues/${issue.id}`}>{issue.caseNumber}</Link></td>
              <td>{issue.customerName || "Not recorded"}</td>
              <td>{issue.companyName || "Not recorded"}</td>
              <td>{issue.productName || "Not recorded"}</td>
              <td>{issue.category}</td>
              <td><PriorityBadge priority={issue.priority} /></td>
              <td>{issue.assignedDepartment}</td>
              <td><StatusBadge status={issue.status} /></td>
              <td>{issue.resolutionDeadline || "Not set"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CaseSummary({ issue }: { issue: CcrmIssueCase }) {
  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase text-slate-400">Case Number</p>
      <h3 className="mt-1 text-2xl font-black text-slate-950">{issue.caseNumber}</h3>
      <div className="mt-4 flex flex-wrap gap-2">
        <PriorityBadge priority={issue.priority} />
        <StatusBadge status={issue.status} />
      </div>
      <div className="mt-5 space-y-3">
        <Info label="Customer" value={issue.customerName || "Not recorded"} />
        <Info label="Phone" value={issue.customerPhone || "Not recorded"} />
        <Info label="Company" value={issue.companyName || "Not recorded"} />
        <Info label="Region" value={issue.region || "Not recorded"} />
        <Info label="Source" value={issue.sourceChannel} />
        <Info label="Department" value={issue.assignedDepartment} />
      </div>
    </aside>
  );
}

function AlertPanel({ alerts }: { alerts: Array<{ action: string; company: string; issue: string; severity: string }> }) {
  return (
    <aside className="rounded-xl border border-red-100 bg-white p-5 shadow-sm">
      <h3 className="font-black text-slate-950">Executive Alert Center</h3>
      <div className="mt-4 space-y-3">
        {alerts.map((alert) => (
          <div className="rounded-lg border border-red-100 bg-red-50 p-3" key={`${alert.company}-${alert.issue}`}>
            <p className="text-xs font-black uppercase text-red-500">{alert.severity} - {alert.company}</p>
            <p className="mt-1 font-black text-red-900">{alert.issue}</p>
            <p className="mt-1 text-sm font-semibold text-red-700">{alert.action}</p>
          </div>
        ))}
        {!alerts.length ? <p className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-500">No executive alerts yet.</p> : null}
      </div>
    </aside>
  );
}

function MiniChart({ rows, title }: { rows: Array<{ label: string; value: number }>; title: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-black text-slate-950">{title}</h3>
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex justify-between text-sm font-bold"><span>{row.label}</span><span>{row.value}</span></div>
            <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${(row.value / max) * 100}%` }} /></div>
          </div>
        ))}
        {!rows.length ? <p className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-500">No cases yet.</p> : null}
      </div>
    </section>
  );
}

function Kpi({ danger = false, icon: Icon, label, value }: { danger?: boolean; icon: typeof ClipboardList; label: string; value: number | string }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-500">{label}</p>
          <p className={`mt-3 text-2xl font-black ${danger ? "text-red-600" : "text-blue-700"}`}>{value}</p>
        </div>
        <div className={`rounded-lg p-2 ${danger ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}><Icon className="h-5 w-5" /></div>
      </div>
    </article>
  );
}

function EmptyState({ body, compact = false, title }: { body: string; compact?: boolean; title: string }) {
  return (
    <div className={`rounded-xl border border-dashed border-slate-200 bg-white text-center ${compact ? "p-6" : "p-12"}`}>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><MapPin className="h-6 w-6" /></div>
      <h3 className="mt-4 text-lg font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm font-semibold text-slate-500">{body}</p>
    </div>
  );
}

function Field({ label, onChange, required = false, type = "text", value }: { label: string; onChange: (value: string) => void; required?: boolean; type?: string; value: string }) {
  return (
    <label>
      <span className="text-sm font-black text-slate-700">{label}</span>
      <input className="form-input mt-2" onChange={(event) => onChange(event.target.value)} required={required} type={type} value={value} />
    </label>
  );
}

function SelectField({ label, onChange, optionLabels = {}, options, value }: { label: string; onChange: (value: string) => void; optionLabels?: Record<string, string>; options: string[]; value: string }) {
  return (
    <label>
      <span className="text-sm font-black text-slate-700">{label}</span>
      <select className="form-input mt-2" onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => <option key={option} value={option}>{optionLabels[option] ?? option}</option>)}
      </select>
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-black uppercase text-slate-400">{label}</p><p className="mt-1 font-bold text-slate-800">{value}</p></div>;
}

function PriorityBadge({ priority }: { priority: IssuePriority }) {
  const classes: Record<IssuePriority, string> = {
    Critical: "bg-red-600 text-white",
    High: "bg-orange-100 text-orange-700",
    Low: "bg-slate-100 text-slate-600",
    Medium: "bg-blue-100 text-blue-700"
  };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${classes[priority]}`}>{priority}</span>;
}

function StatusBadge({ status }: { status: IssueStatus }) {
  return <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{status}</span>;
}

function safeLoadCases(user: SessionUser) {
  try {
    return getIssueCasesForUser(user);
  } catch (error) {
    console.error("[KingApp] CCRM issues failed to load", error);
    return [];
  }
}

function safeCompanies() {
  try {
    return getCompanies();
  } catch {
    return [];
  }
}
