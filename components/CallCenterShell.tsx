"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  Box,
  CalendarClock,
  ChevronDown,
  ClipboardList,
  CreditCard,
  Home,
  MessageSquareWarning,
  PhoneCall,
  PhoneIncoming,
  Search,
  UserRound,
  UsersRound
} from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { getAgents, getQueueCalls } from "@/lib/call-center-data";
import { canAccessPage } from "@/lib/permissions";
import { getSession } from "@/lib/storage";

type CallCenterShellProps = {
  children: ReactNode | ((user: SessionUser) => ReactNode);
  subtitle?: string;
  title?: string;
};

const menuItems = [
  { label: "Dashboard", href: "/call-center", icon: Home, badge: "" },
  { label: "Incoming Calls", href: "/call-center/queue", icon: PhoneIncoming, badge: "2" },
  { label: "Clients", href: "/call-center#clients", icon: UsersRound, badge: "" },
  { label: "Orders", href: "/call-center#orders", icon: ClipboardList, badge: "" },
  { label: "Follow Ups", href: "/call-center/callbacks", icon: CalendarClock, badge: "" },
  { label: "Complaints", href: "/call-center#complaints", icon: MessageSquareWarning, badge: "" },
  { label: "Payments", href: "/call-center#payments", icon: CreditCard, badge: "" },
  { label: "Reports", href: "/reports", icon: BookOpen, badge: "" }
];

const toolItems = [
  { label: "Client Search", href: "/call-center#clients", icon: Search },
  { label: "Order Quick Entry", href: "/call-center#current-order", icon: Box },
  { label: "Callback List", href: "/call-center/callbacks", icon: PhoneCall },
  { label: "Reminders", href: "/call-center#reminders", icon: CalendarClock }
];

export function CallCenterShell({
  children,
  subtitle = "Client Calls Team",
  title = "Call Center Office"
}: CallCenterShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [callsInQueue, setCallsInQueue] = useState(0);
  const [agentsOnline, setAgentsOnline] = useState(0);

  useEffect(() => {
    const session = getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    if (!canAccessPage(pathname, session.role)) {
      window.sessionStorage.setItem(
        "kingapp.permissionMessage",
        "You do not have permission to access this page."
      );
      router.push("/dashboard");
      return;
    }

    setUser(session);
    setCallsInQueue(
      getQueueCalls().filter(
        (call) => call.status === "Waiting" || call.status === "Incoming"
      ).length
    );
    setAgentsOnline(getAgents().filter((agent) => agent.status !== "Offline").length);
  }, [pathname, router]);

  if (!user) {
    return <main className="min-h-screen bg-[#061b33]" />;
  }

  return (
    <main className="min-h-screen bg-[#f3f6fb] text-slate-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 flex-col bg-[#061b33] text-white shadow-2xl lg:flex">
          <div className="border-b border-white/10 p-7">
            <div className="flex items-center gap-3">
              <div className="text-4xl leading-none text-amber-300">♛</div>
              <div>
                <h1 className="text-2xl font-black tracking-wide">KINGAPP</h1>
                <p className="text-xs font-semibold text-blue-200">
                  Powering Distribution
                </p>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-8 overflow-y-auto p-5">
            <SidebarGroup title="Main">
              {menuItems.map((item) => (
                <SidebarLink
                  active={pathname === item.href}
                  badge={item.badge}
                  href={item.href}
                  icon={item.icon}
                  key={item.label}
                  label={item.label}
                />
              ))}
            </SidebarGroup>
            <SidebarGroup title="Tools">
              {toolItems.map((item) => (
                <SidebarLink
                  href={item.href}
                  icon={item.icon}
                  key={item.label}
                  label={item.label}
                />
              ))}
            </SidebarGroup>
          </nav>

          <div className="border-t border-white/10 p-6 text-center">
            <div className="mx-auto mb-3 text-5xl text-amber-300">♛</div>
            <p className="text-xl font-black">KINGAPP</p>
            <p className="text-sm font-semibold text-blue-100">Call Center Module</p>
            <p className="mt-8 text-xs font-semibold text-blue-200">Version 1.0.0</p>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur lg:px-7">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950">{title}</h2>
                <p className="text-sm font-black text-blue-700">{subtitle}</p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <TopMetric icon={PhoneCall} label="Connected" tone="green" value="00:03:12" />
                <TopMetric label="Calls in Queue" value={callsInQueue.toLocaleString()} />
                <TopMetric dot label="Agents Online" value={agentsOnline.toLocaleString()} />
                <button className="relative rounded-lg p-2 text-slate-700 hover:bg-slate-100" type="button">
                  <Bell className="h-5 w-5" />
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white">
                    5
                  </span>
                </button>
                <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-sm font-black text-amber-800">
                    {user.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-black text-slate-950">{user.displayName}</p>
                    <p className="text-xs font-semibold text-slate-500">
                      Call Center Agent
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                </div>
              </div>
            </div>
          </header>
          <div className="space-y-6 p-4 lg:p-6">
            {typeof children === "function" ? children(user) : children}
          </div>
        </section>
      </div>
    </main>
  );
}

function SidebarGroup({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div>
      <p className="mb-3 px-3 text-xs font-black uppercase tracking-wide text-blue-200/70">
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function SidebarLink({
  active = false,
  badge,
  href,
  icon: Icon,
  label
}: {
  active?: boolean;
  badge?: string;
  href: string;
  icon: typeof Home;
  label: string;
}) {
  return (
    <Link
      className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm font-black transition ${
        active
          ? "bg-blue-600 text-white"
          : "text-blue-100 hover:bg-white/10 hover:text-white"
      }`}
      href={href}
    >
      <span className="flex items-center gap-3">
        <Icon className="h-5 w-5" />
        {label}
      </span>
      {badge ? (
        <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function TopMetric({
  dot = false,
  icon: Icon,
  label,
  tone,
  value
}: {
  dot?: boolean;
  icon?: typeof PhoneCall;
  label: string;
  tone?: "green";
  value: string;
}) {
  return (
    <div className="min-w-28 rounded-lg bg-slate-50 px-4 py-2">
      <p
        className={`flex items-center gap-2 text-xs font-bold ${
          tone === "green" ? "text-emerald-700" : "text-slate-500"
        }`}
      >
        {Icon ? <Icon className="h-4 w-4" /> : null}
        {dot ? <span className="h-2 w-2 rounded-full bg-emerald-500" /> : null}
        {label}
      </p>
      <p className="mt-1 font-black text-slate-950">{value}</p>
    </div>
  );
}
