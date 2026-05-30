"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  BadgeDollarSign,
  Boxes,
  ClipboardCheck,
  FileText,
  Home,
  LogOut,
  PackageCheck,
  ReceiptText,
  ScrollText,
  ShieldCheck,
  WalletCards
} from "lucide-react";
import type { SessionUser, UserRole } from "@/lib/auth";
import { cleanupLegacyDemoProductData } from "@/lib/data-cleanup";
import { syncSupabaseToLocalStorage } from "@/lib/live-data";
import { roleLabels } from "@/lib/auth";
import { clearSession, getSession } from "@/lib/storage";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  roles: UserRole[];
};

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: Home,
    roles: ["admin", "supervisor", "storekeeper", "accountant", "manager", "marketer"]
  },
  {
    href: "/loading",
    label: "Loading",
    icon: Boxes,
    roles: ["admin", "storekeeper"]
  },
  {
    href: "/inventory",
    label: "Inventory",
    icon: Boxes,
    roles: ["admin", "storekeeper", "manager", "supervisor"]
  },
  {
    href: "/price-management",
    label: "Prices",
    icon: BadgeDollarSign,
    roles: ["admin"]
  },
  {
    href: "/confirm-loading",
    label: "Confirm",
    icon: ClipboardCheck,
    roles: ["admin", "marketer"]
  },
  {
    href: "/sales",
    label: "Sales",
    icon: FileText,
    roles: ["admin", "marketer"]
  },
  {
    href: "/returns",
    label: "Returns",
    icon: PackageCheck,
    roles: ["admin", "storekeeper"]
  },
  {
    href: "/cash",
    label: "Cash",
    icon: WalletCards,
    roles: ["admin", "accountant"]
  },
  {
    href: "/expenses",
    label: "Expenses",
    icon: ReceiptText,
    roles: ["admin", "accountant"]
  },
  {
    href: "/admin/audit-log",
    label: "Audit Log",
    icon: ShieldCheck,
    roles: ["admin"]
  },
  {
    href: "/daily-report",
    label: "Daily Report",
    icon: ScrollText,
    roles: ["admin", "manager", "supervisor"]
  },
  {
    href: "/reports",
    label: "Reports",
    icon: BarChart3,
    roles: ["admin", "supervisor", "manager"]
  }
];

type AppShellProps = {
  allowedRoles?: UserRole[];
  children: (user: SessionUser) => ReactNode;
};

export function AppShell({ allowedRoles, children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const allowedRoleKey = allowedRoles?.join(",");

  useEffect(() => {
    let isMounted = true;

    async function openApp() {
      cleanupLegacyDemoProductData();
      await syncSupabaseToLocalStorage();
      const session = getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      if (allowedRoles && !allowedRoles.includes(session.role)) {
        router.replace("/dashboard");
        return;
      }

      if (isMounted) {
        setUser(session);
        setIsReady(true);
      }
    }

    void openApp();

    return () => {
      isMounted = false;
    };
  }, [allowedRoleKey, router]);

  function handleLogout() {
    clearSession();
    router.replace("/login");
  }

  if (!isReady || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="rounded-lg border border-brand-100 bg-white px-5 py-4 text-sm font-semibold text-brand-800 shadow-sm">
          Opening KingApp...
        </div>
      </main>
    );
  }

  const visibleNav = navItems.filter((item) => item.roles.includes(user.role));

  return (
    <main className="min-h-screen bg-[#f6faf7]">
      <header className="border-b border-brand-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-700 text-lg font-bold text-white">
              K
            </div>
            <div>
              <h1 className="text-xl font-bold text-brand-900">KingApp</h1>
              <p className="text-sm font-medium text-brand-700">
                Sales & Stock Management
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-lg bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-900">
              {roleLabels[user.role]}: {user.displayName}
            </div>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-200 hover:bg-brand-50"
              onClick={handleLogout}
              type="button"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-4 sm:px-6">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-brand-700 text-white"
                    : "bg-white text-slate-700 hover:bg-brand-50 hover:text-brand-800"
                }`}
                href={item.href}
                key={item.href}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        {children(user)}
      </section>
    </main>
  );
}
