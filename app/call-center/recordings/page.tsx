"use client";

import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { CallCenterShell } from "@/components/CallCenterShell";
import { getCompanyRecordings } from "@/lib/call-center-operations";

type RecordingRow = ReturnType<typeof getCompanyRecordings>[number];

export default function CallCenterRecordingsPage() {
  return (
    <CallCenterShell title="Call Recording Center" subtitle="Recording Review & Provider Readiness">
      <RecordingsContent />
    </CallCenterShell>
  );
}

function RecordingsContent() {
  const [rows, setRows] = useState<RecordingRow[]>([]);

  useEffect(() => {
    setRows(getCompanyRecordings());
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-3 text-blue-700">
            <Radio className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-950">Call Recording Center</h2>
            <p className="text-sm font-semibold text-slate-500">Mock recordings today, ready for Twilio, 3CX, or Asterisk recording URLs later.</p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500">
              <tr>
                {["Date", "Agent", "Client", "Duration", "Outcome", "Recording Link", "Notes"].map((heading) => (
                  <th className="px-4 py-3" key={heading}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="border-t border-slate-100" key={row.id}>
                  <td className="px-4 py-3">{row.date}</td>
                  <td className="px-4 py-3 font-bold">{row.agent}</td>
                  <td className="px-4 py-3 font-black text-slate-950">{row.client}</td>
                  <td className="px-4 py-3">{row.duration}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{row.outcome}</span>
                  </td>
                  <td className="px-4 py-3">
                    {row.recordingUrl ? (
                      <a className="font-black text-blue-700" href={row.recordingUrl}>Open Recording</a>
                    ) : (
                      <span className="text-slate-500">Provider not connected</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="px-4 py-6 text-sm font-semibold text-slate-500">No recordings available yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
