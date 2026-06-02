"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquareWarning } from "lucide-react";
import { CallCenterShell } from "@/components/CallCenterShell";
import type { SessionUser } from "@/lib/auth";
import { getCallCenterSummary, getComplaintCenterRows } from "@/lib/call-center-operations";

type ComplaintRow = ReturnType<typeof getComplaintCenterRows>[number];

const statuses = ["Open", "Investigating", "Resolved", "Closed"];

export default function CallCenterComplaintsPage() {
  return (
    <CallCenterShell title="Complaint Center" subtitle="Client Issue Resolution Desk">
      {(user) => <ComplaintsContent user={user} />}
    </CallCenterShell>
  );
}

function ComplaintsContent({ user }: { user: SessionUser }) {
  const [rows, setRows] = useState<ComplaintRow[]>([]);

  useEffect(() => {
    setRows(getComplaintCenterRows(user));
  }, [user]);

  const summary = useMemo(() => getCallCenterSummary(user), [user]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Open Complaints" value={summary.openComplaints.toLocaleString()} />
        <Kpi label="Total Complaints" value={summary.totalComplaints.toLocaleString()} />
        <Kpi label="Resolved" value={rows.filter((row) => row.status === "Resolved" || row.status === "Closed").length.toLocaleString()} />
        <Kpi label="Urgent Priority" value={rows.filter((row) => row.priority === "Urgent" || row.priority === "High").length.toLocaleString()} />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-lg bg-red-50 p-3 text-red-700">
            <MessageSquareWarning className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-950">Complaint Management Center</h2>
            <p className="text-sm font-semibold text-slate-500">Supervisor and admin can review issues logged by call center agents.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500">
              <tr>
                {["Complaint Number", "Client", "Issue", "Priority", "Assigned To", "Status", "Date"].map((heading) => (
                  <th className="px-4 py-3" key={heading}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="border-t border-slate-100" key={row.id}>
                  <td className="px-4 py-3 font-black text-slate-950">{row.complaintNumber}</td>
                  <td className="px-4 py-3">{row.clientName}</td>
                  <td className="px-4 py-3">{row.complaintType || row.description}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${row.priority === "Urgent" || row.priority === "High" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{row.priority}</span>
                  </td>
                  <td className="px-4 py-3">{row.assignedTo}</td>
                  <td className="px-4 py-3">
                    <select className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black" defaultValue={row.status}>
                      {statuses.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">{row.createdAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="px-4 py-6 text-sm font-semibold text-slate-500">No complaints logged yet.</p> : null}
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
    </article>
  );
}
