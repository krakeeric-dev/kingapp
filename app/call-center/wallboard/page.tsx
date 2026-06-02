"use client";

import { useEffect, useState } from "react";
import { Activity, Headphones, MessageSquareWarning, PhoneOff, ShoppingCart, UsersRound, WalletCards } from "lucide-react";
import { CallCenterShell } from "@/components/CallCenterShell";
import type { SessionUser } from "@/lib/auth";
import { getCallCenterSummary } from "@/lib/call-center-operations";
import { formatMoney } from "@/lib/sales-data";

type Summary = ReturnType<typeof getCallCenterSummary>;

export default function CallCenterWallboardPage() {
  return (
    <CallCenterShell title="Call Center Wallboard" subtitle="Live TV Operations Display">
      {(user) => <WallboardContent user={user} />}
    </CallCenterShell>
  );
}

function WallboardContent({ user }: { user: SessionUser }) {
  const [summary, setSummary] = useState<Summary>(() => ({
    totalCalls: 0,
    totalOrders: 0,
    totalComplaints: 0,
    bestAgent: "No agent yet",
    revenueGenerated: 0,
    openComplaints: 0,
    waiting: 0,
    active: 0,
    agentsOnline: 0,
    missedToday: 0,
    callbacksDue: 0
  }));
  const [updatedAt, setUpdatedAt] = useState("");

  useEffect(() => {
    function refresh() {
      setSummary(getCallCenterSummary(user));
      setUpdatedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }
    refresh();
    const interval = window.setInterval(refresh, 10_000);
    return () => window.clearInterval(interval);
  }, [user]);

  return (
    <div className="min-h-[calc(100vh-150px)] rounded-2xl bg-[#061b33] p-6 text-white shadow-2xl">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase text-blue-200">KINGAPP Outsourcing Center</p>
          <h2 className="mt-2 text-4xl font-black">Live Wallboard</h2>
        </div>
        <div className="rounded-xl bg-white/10 px-5 py-3 text-right">
          <p className="text-xs font-black uppercase text-blue-200">Auto refresh</p>
          <p className="text-2xl font-black">{updatedAt}</p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <WallMetric icon={Headphones} label="Calls Waiting" tone="amber" value={summary.waiting.toLocaleString()} />
        <WallMetric icon={Activity} label="Calls Active" tone="green" value={summary.active.toLocaleString()} />
        <WallMetric icon={UsersRound} label="Agents Online" tone="blue" value={summary.agentsOnline.toLocaleString()} />
        <WallMetric icon={ShoppingCart} label="Orders Today" tone="green" value={summary.totalOrders.toLocaleString()} />
        <WallMetric icon={WalletCards} label="Revenue Today" tone="blue" value={`${formatMoney(summary.revenueGenerated)} RWF`} />
        <WallMetric icon={PhoneOff} label="Missed Calls" tone="red" value={summary.missedToday.toLocaleString()} />
        <WallMetric icon={MessageSquareWarning} label="Complaints Open" tone="red" value={summary.openComplaints.toLocaleString()} />
        <WallMetric icon={Headphones} label="Callbacks Due" tone="amber" value={summary.callbacksDue.toLocaleString()} />
      </div>
    </div>
  );
}

function WallMetric({
  icon: Icon,
  label,
  tone,
  value
}: {
  icon: typeof Headphones;
  label: string;
  tone: "amber" | "blue" | "green" | "red";
  value: string;
}) {
  const colors = {
    amber: "bg-amber-400/15 text-amber-200",
    blue: "bg-blue-400/15 text-blue-200",
    green: "bg-emerald-400/15 text-emerald-200",
    red: "bg-red-400/15 text-red-200"
  };
  return (
    <article className="rounded-2xl border border-white/10 bg-white/10 p-6 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black uppercase text-blue-100">{label}</p>
        <div className={`rounded-xl p-3 ${colors[tone]}`}>
          <Icon className="h-7 w-7" />
        </div>
      </div>
      <p className="mt-8 text-5xl font-black tracking-tight">{value}</p>
    </article>
  );
}
