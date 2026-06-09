"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, RotateCcw, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { SessionUser } from "@/lib/auth";
import { filterByAssignedCompanies } from "@/lib/companies-data";
import {
  getCustomerDebts,
  getDebtApprovals,
  reviewDebtApproval,
  type CustomerDebtApproval,
  type DebtApprovalStatus
} from "@/lib/customer-accounts-data";
import { formatMoney } from "@/lib/sales-data";

export default function DebtApprovalsPage() {
  return (
    <AppShell allowedRoles={["admin", "supervisor", "manager", "marketer"]}>
      {(user) => <DebtApprovalsContent user={user} />}
    </AppShell>
  );
}

function DebtApprovalsContent({ user }: { user: SessionUser }) {
  const [approvals, setApprovals] = useState<CustomerDebtApproval[]>([]);
  const [statusFilter, setStatusFilter] = useState<DebtApprovalStatus | "all">("all");
  const [message, setMessage] = useState("");

  function refresh() {
    const records = filterByAssignedCompanies(getDebtApprovals(), user).filter((approval) => {
      if (user.role === "marketer") return approval.marketerUsername === user.username;
      return true;
    });
    setApprovals(records);
  }

  useEffect(() => {
    refresh();
  }, []);

  const summary = useMemo(() => {
    const approvedDebtIds = new Set(getCustomerDebts(user).map((debt) => debt.id));
    const overdueApproved = getCustomerDebts(user).filter((debt) => debt.paymentStatus === "Overdue").length;
    return {
      pending: approvals.filter((item) => item.status === "Pending Debt Approval" || item.status === "Pending Manager Approval").length,
      approved: approvals.filter((item) => item.status === "Approved Debt" || approvedDebtIds.has(item.debtId)).length,
      supervisorDeclined: approvals.filter((item) => item.status === "Supervisor Declined").length,
      managerDeclined: approvals.filter((item) => item.status === "Manager Declined").length,
      correction: approvals.filter((item) => item.status === "Correction Requested").length,
      overdue: overdueApproved
    };
  }, [approvals, user]);

  const visibleApprovals = approvals.filter((approval) => statusFilter === "all" || approval.status === statusFilter);

  function handleReview(approval: CustomerDebtApproval, action: "supervisor_approve" | "manager_approve" | "supervisor_decline" | "manager_decline" | "request_correction" | "admin_override", reason: string) {
    setApprovals(reviewDebtApproval({ approvalId: approval.id, action, reason, user }));
    setMessage("Debt approval workflow updated.");
    refresh();
  }

  return (
    <div className="space-y-6">
      <section className="app-card-soft p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-brand-50 p-3 text-brand-700">
            <ClipboardCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-normal text-brand-700">Customer Debt Approval</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Supervisor review and Manager final approval</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Unpaid marketer sales remain pending until supervisor and manager approval. Only approved debt affects balances, statements, and accountant collections.
            </p>
          </div>
        </div>
      </section>

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Metric icon={ClipboardCheck} label="Pending Approval" value={summary.pending} />
        <Metric icon={CheckCircle2} label="Approved Debt" value={summary.approved} />
        <Metric danger icon={XCircle} label="Supervisor Declined" value={summary.supervisorDeclined} />
        <Metric danger icon={XCircle} label="Manager Declined" value={summary.managerDeclined} />
        <Metric icon={RotateCcw} label="Correction Requested" value={summary.correction} />
        <Metric danger icon={RotateCcw} label="Overdue Debt" value={summary.overdue} />
      </div>

      <section className="app-card p-4">
        <label className="block max-w-xs">
          <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Status</span>
          <select className="form-input" onChange={(event) => setStatusFilter(event.target.value as DebtApprovalStatus | "all")} value={statusFilter}>
            <option value="all">All Statuses</option>
            {["Pending Debt Approval", "Pending Manager Approval", "Approved Debt", "Supervisor Declined", "Manager Declined", "Correction Requested"].map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
      </section>

      <section className="app-card p-5">
        <h3 className="text-lg font-black text-slate-950">Pending Debt Review</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Marketer</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Location</th>
                <th>Company</th>
                <th>Product Summary</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Debt</th>
                <th>Status</th>
                <th>Reason / Notes</th>
              </tr>
            </thead>
            <tbody>
              {visibleApprovals.map((approval) => (
                <tr key={approval.id}>
                  <td>{approval.date}</td>
                  <td>{approval.marketerName}</td>
                  <td className="font-black text-slate-950">{approval.customerName}</td>
                  <td>{approval.phone}</td>
                  <td>{approval.location}</td>
                  <td>{approval.companyName}</td>
                  <td className="min-w-56">{approval.productSummary}</td>
                  <td>{formatMoney(approval.totalAmount)} RWF</td>
                  <td>{formatMoney(approval.amountPaid)} RWF</td>
                  <td className="font-black text-red-700">{formatMoney(approval.debtAmount)} RWF</td>
                  <td><StatusBadge status={approval.status} /></td>
                  <td>{approval.supervisorReason || approval.managerReason || approval.adminReason || approval.notes}</td>
                </tr>
              ))}
              {!visibleApprovals.length ? <tr><td colSpan={12}>No debt approval records yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4">
        {visibleApprovals.map((approval) => (
          <ApprovalActions approval={approval} key={`actions-${approval.id}`} onReview={handleReview} user={user} />
        ))}
      </div>
    </div>
  );
}

function ApprovalActions({
  approval,
  onReview,
  user
}: {
  approval: CustomerDebtApproval;
  onReview: (approval: CustomerDebtApproval, action: "supervisor_approve" | "manager_approve" | "supervisor_decline" | "manager_decline" | "request_correction" | "admin_override", reason: string) => void;
  user: SessionUser;
}) {
  const [reason, setReason] = useState("");
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declineError, setDeclineError] = useState("");
  const canSupervisorReview = (user.role === "supervisor" || user.role === "admin") && approval.status === "Pending Debt Approval";
  const canManagerReview = (user.role === "manager" || user.role === "admin") && approval.status === "Pending Manager Approval";
  const canAdminOverride = user.role === "admin" && approval.status !== "Approved Debt";
  const marketerNotice = user.role === "marketer" && ["Supervisor Declined", "Manager Declined", "Correction Requested"].includes(approval.status);

  if (!canSupervisorReview && !canManagerReview && !canAdminOverride && !marketerNotice) return null;

  return (
    <section className="app-card p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-black text-slate-950">{approval.customerName} - {formatMoney(approval.debtAmount)} RWF</h3>
          <p className="text-sm font-semibold text-slate-500">{approval.status} - {approval.salesId}</p>
        </div>
        {marketerNotice ? (
          <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm font-bold text-amber-800">
            {approval.status}. Open Sales, correct the client sale, and submit again.
          </p>
        ) : null}
      </div>
      {(canSupervisorReview || canManagerReview || canAdminOverride) ? (
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <input className="form-input" onChange={(event) => setReason(event.target.value)} placeholder="Reason / notes" value={reason} />
          {canSupervisorReview ? (
            <button className="primary-button !bg-emerald-700" onClick={() => onReview(approval, "supervisor_approve", reason)} type="button">Approve</button>
          ) : null}
          {canManagerReview ? (
            <button className="primary-button !bg-emerald-700" onClick={() => onReview(approval, "manager_approve", reason)} type="button">Approve</button>
          ) : null}
          {canAdminOverride ? (
            <button className="primary-button" onClick={() => onReview(approval, "admin_override", reason)} type="button">Admin Override</button>
          ) : null}
          {(canSupervisorReview || canManagerReview) ? (
            <>
              <button className="danger-button" onClick={() => setDeclineOpen(true)} type="button">Decline</button>
              <button className="secondary-button !border-amber-200 !bg-amber-50 !text-amber-800" onClick={() => onReview(approval, "request_correction", reason)} type="button">Request Correction</button>
            </>
          ) : null}
        </div>
      ) : null}
      {declineOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-executive">
            <h4 className="text-lg font-black text-slate-950">Decline Debt Request</h4>
            <p className="mt-2 text-sm font-semibold text-slate-600">A decline reason is required and will be saved in the audit log.</p>
            <label className="mt-4 block">
              <span className="mb-1 block text-xs font-black uppercase text-slate-500">Decline Reason</span>
              <select className="form-input" onChange={(event) => setDeclineReason(event.target.value)} value={declineReason}>
                <option value="">Select reason</option>
                <option>Customer exceeded credit limit</option>
                <option>Customer has overdue balance</option>
                <option>Wrong amount entered</option>
                <option>Wrong client selected</option>
                <option>Manager decision</option>
                <option>Other</option>
              </select>
            </label>
            <textarea
              className="form-input mt-3 min-h-24"
              onChange={(event) => setReason(event.target.value)}
              placeholder="Additional notes"
              value={reason}
            />
            {declineError ? <p className="mt-3 text-sm font-bold text-red-700">{declineError}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button className="secondary-button" onClick={() => setDeclineOpen(false)} type="button">Cancel</button>
              <button
                className="danger-button"
                onClick={() => {
                  if (!declineReason) {
                    setDeclineError("Decline reason is required.");
                    return;
                  }
                  onReview(
                    approval,
                    canSupervisorReview ? "supervisor_decline" : "manager_decline",
                    `${declineReason}${reason ? ` - ${reason}` : ""}`
                  );
                  setDeclineOpen(false);
                }}
                type="button"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Metric({ danger = false, icon: Icon, label, value }: { danger?: boolean; icon: typeof ClipboardCheck; label: string; value: number }) {
  return (
    <article className="app-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-500">{label}</p>
          <p className={`mt-3 text-3xl font-black ${danger ? "text-red-700" : "text-brand-800"}`}>{value}</p>
        </div>
        <div className={`rounded-lg p-2 ${danger ? "bg-red-50 text-red-700" : "bg-brand-50 text-brand-700"}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: DebtApprovalStatus }) {
  const tone =
    status === "Approved Debt"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "Supervisor Declined" || status === "Manager Declined"
        ? "border-red-200 bg-red-50 text-red-700"
        : status === "Correction Requested"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-blue-200 bg-blue-50 text-blue-700";

  return <span className={`status-badge ${tone}`}>{status}</span>;
}
