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
  Menu,
  PackageCheck,
  ReceiptText,
  ScrollText,
  ShieldCheck,
  UserRound,
  WalletCards,
  X
} from "lucide-react";
import type { SessionUser, UserRole } from "@/lib/auth";
import { cleanupLegacyDemoProductData } from "@/lib/data-cleanup";
import { syncSupabaseToLocalStorage } from "@/lib/live-data";
import { canAccessPage, getAllowedRoles } from "@/lib/permissions";
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
    roles: getAllowedRoles("/dashboard")
  },
  {
    href: "/loading",
    label: "Loading",
    icon: Boxes,
    roles: getAllowedRoles("/loading")
  },
  {
    href: "/inventory",
    label: "Inventory",
    icon: Boxes,
    roles: getAllowedRoles("/inventory")
  },
  {
    href: "/price-management",
    label: "Prices",
    icon: BadgeDollarSign,
    roles: getAllowedRoles("/price-management")
  },
  {
    href: "/confirm-loading",
    label: "Confirm",
    icon: ClipboardCheck,
    roles: getAllowedRoles("/confirm-loading")
  },
  {
    href: "/sales",
    label: "Sales",
    icon: FileText,
    roles: getAllowedRoles("/sales")
  },
  {
    href: "/returns",
    label: "Returns",
    icon: PackageCheck,
    roles: getAllowedRoles("/returns")
  },
  {
    href: "/cash",
    label: "Cash",
    icon: WalletCards,
    roles: getAllowedRoles("/cash")
  },
  {
    href: "/expenses",
    label: "Expenses",
    icon: ReceiptText,
    roles: getAllowedRoles("/expenses")
  },
  {
    href: "/admin/audit-log",
    label: "Audit Log",
    icon: ShieldCheck,
    roles: getAllowedRoles("/admin/audit-log")
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: UserRound,
    roles: getAllowedRoles("/admin/users")
  },
  {
    href: "/daily-report",
    label: "Daily Report",
    icon: ScrollText,
    roles: getAllowedRoles("/daily-report")
  },
  {
    href: "/reports",
    label: "Reports",
    icon: BarChart3,
    roles: getAllowedRoles("/reports")
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

      const pageAllowedRoles = allowedRoles ?? getAllowedRoles(pathname);

      if (!pageAllowedRoles.includes(session.role) || !canAccessPage(pathname, session.role)) {
        window.sessionStorage.setItem(
          "kingapp.permissionMessage",
          "You do not have permission to access this page."
        );
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
  }, [allowedRoleKey, pathname, router]);

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
    <main className="min-h-screen bg-transparent lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-[280px] border-r border-white/10 bg-gradient-to-b from-brand-950 via-brand-900 to-brand-800 p-5 text-white shadow-executive lg:flex lg:flex-col">
        <BrandBlock />
        <nav className="mt-8 flex-1 space-y-1.5">
          {visibleNav.map((item) => (
            <NavLink
              href={item.href}
              icon={item.icon}
              isActive={pathname === item.href}
              key={item.href}
              label={item.label}
            />
          ))}
        </nav>
        <UserPanel handleLogout={handleLogout} user={user} />
      </aside>

      <div className="lg:col-start-2">
        <header className="no-print sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
          <div className="flex min-h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 lg:hidden">
              <button
                className="secondary-button !px-3"
                onClick={() => setMobileMenuOpen(true)}
                type="button"
              >
                <Menu className="h-5 w-5" />
              </button>
              <BrandMark compact />
            </div>
            <div className="hidden lg:block">
              <p className="text-xs font-bold uppercase tracking-normal text-brand-700">
                KingApp Workspace
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">
                {currentPageTitle(pathname)}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm sm:block">
                <span className="font-bold text-slate-950">{user.displayName}</span>
                <span className="ml-2 text-slate-500">{roleLabels[user.role]}</span>
              </div>
              <button
                className="secondary-button hidden sm:inline-flex"
                onClick={handleLogout}
                type="button"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </header>

        {mobileMenuOpen ? (
          <div className="no-print fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden">
            <div className="flex h-full w-[min(88vw,340px)] flex-col bg-gradient-to-b from-brand-950 via-brand-900 to-brand-800 p-5 text-white shadow-executive">
              <div className="flex items-start justify-between gap-4">
                <BrandBlock />
                <button
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/15"
                  onClick={() => setMobileMenuOpen(false)}
                  type="button"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="mt-8 flex-1 space-y-1.5">
                {visibleNav.map((item) => (
                  <NavLink
                    href={item.href}
                    icon={item.icon}
                    isActive={pathname === item.href}
                    key={item.href}
                    label={item.label}
                    onClick={() => setMobileMenuOpen(false)}
                  />
                ))}
              </nav>
              <UserPanel handleLogout={handleLogout} user={user} />
            </div>
          </div>
        ) : null}

        <section className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          {children(user)}
        </section>
      </div>
    </main>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-700 text-lg font-black text-white shadow-soft">
        K
      </div>
      {!compact ? (
        <div>
          <h1 className="text-xl font-bold text-white">KingApp</h1>
          <p className="text-sm font-medium text-emerald-100">Beverage Pro</p>
        </div>
      ) : (
        <div>
          <h1 className="text-lg font-bold text-brand-900">KingApp</h1>
          <p className="text-xs font-semibold text-brand-700">Beverage Pro</p>
        </div>
      )}
    </div>
  );
}

function BrandBlock() {
  return (
    <div>
      <BrandMark />
      <p className="mt-4 text-sm font-medium leading-6 text-emerald-100">
        Sales & Stock Management
      </p>
    </div>
  );
}

function NavLink({
  href,
  icon: Icon,
  isActive,
  label,
  onClick
}: {
  href: string;
  icon: typeof Home;
  isActive: boolean;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Link
      className={`flex items-center gap-3 rounded-lg px-3.5 py-3 text-sm font-bold transition ${
        isActive
          ? "bg-white text-brand-900 shadow-lg shadow-black/10"
          : "text-emerald-50 hover:bg-white/10 hover:text-white"
      }`}
      href={href}
      onClick={onClick}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}

function UserPanel({
  handleLogout,
  user
}: {
  handleLogout: () => void;
  user: SessionUser;
}) {
  return (
    <div className="mt-6 rounded-lg border border-white/10 bg-white/10 p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-300 text-sm font-black text-brand-950">
          {user.displayName
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{user.displayName}</p>
          <p className="truncate text-xs font-medium text-emerald-100">
            {roleLabels[user.role]} - {user.username}
          </p>
        </div>
      </div>
      <button
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
        onClick={handleLogout}
        type="button"
      >
        <LogOut className="h-4 w-4" />
        Logout
      </button>
    </div>
  );
}

function currentPageTitle(pathname: string) {
  return (
    navItems.find((item) => item.href === pathname)?.label ?? "Dashboard"
  );
}
