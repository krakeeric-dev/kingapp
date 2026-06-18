"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  BadgeDollarSign,
  Bell,
  Boxes,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Download,
  Factory,
  FileText,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  PackageCheck,
  PackagePlus,
  PhoneCall,
  Plus,
  ReceiptText,
  RotateCcw,
  SlidersHorizontal,
  RefreshCw,
  Search,
  ScrollText,
  ShieldCheck,
  Truck,
  UserRound,
  UsersRound as UsersIcon,
  WalletCards,
  X
} from "lucide-react";
import type { SessionUser, UserRole } from "@/lib/auth";
import { KingAppLogo } from "@/components/KingAppLogo";
import { cleanupLegacyDemoProductData } from "@/lib/data-cleanup";
import { logAuditEvent } from "@/lib/loading-data";
import { syncSupabaseToLocalStorage } from "@/lib/live-data";
import { canAccessRoute, getAllowedRoles } from "@/lib/permissions";
import { roleLabels } from "@/lib/auth";
import { clearSession, getSession } from "@/lib/storage";
import { syncPendingQueue } from "@/lib/supabase";
import {
  getActiveCompanyId,
  getCompanies,
  getCompanyName,
  setActiveCompanyId
} from "@/lib/companies-data";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  roles: UserRole[];
};

type NavGroup = {
  items: NavItem[];
  title: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

let hasStartedBackgroundSync = false;

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: Home,
    roles: getAllowedRoles("/dashboard")
  },
  {
    href: "/executive",
    label: "Executive",
    icon: LayoutDashboard,
    roles: getAllowedRoles("/executive")
  },
  {
    href: "/loading",
    label: "Loading",
    icon: Boxes,
    roles: getAllowedRoles("/loading")
  },
  {
    href: "/call-center",
    label: "CCRM",
    icon: PhoneCall,
    roles: getAllowedRoles("/call-center")
  },
  {
    href: "/call-center/queue",
    label: "Call Queue",
    icon: PhoneCall,
    roles: getAllowedRoles("/call-center/queue")
  },
  {
    href: "/call-center/agents",
    label: "Agents",
    icon: UserRound,
    roles: getAllowedRoles("/call-center/agents")
  },
  {
    href: "/call-center/missed-calls",
    label: "Missed Calls",
    icon: PhoneCall,
    roles: getAllowedRoles("/call-center/missed-calls")
  },
  {
    href: "/call-center/callbacks",
    label: "Callbacks",
    icon: ClipboardList,
    roles: getAllowedRoles("/call-center/callbacks")
  },
  {
    href: "/client-orders",
    label: "Client Orders",
    icon: ClipboardList,
    roles: getAllowedRoles("/client-orders")
  },
  {
    href: "/customers",
    label: "Customers",
    icon: UsersIcon,
    roles: getAllowedRoles("/customers")
  },
  {
    href: "/customers/debts",
    label: "Customer Debts",
    icon: WalletCards,
    roles: getAllowedRoles("/customers/debts")
  },
  {
    href: "/customers/debts/approvals",
    label: "Debt Approvals",
    icon: ClipboardCheck,
    roles: getAllowedRoles("/customers/debts/approvals")
  },
  {
    href: "/customers/statements",
    label: "Statements",
    icon: ScrollText,
    roles: getAllowedRoles("/customers/statements")
  },
  {
    href: "/customers/payments",
    label: "Customer Payments",
    icon: BadgeDollarSign,
    roles: getAllowedRoles("/customers/payments")
  },
  {
    href: "/delivery",
    label: "Delivery",
    icon: Truck,
    roles: getAllowedRoles("/delivery")
  },
  {
    href: "/delivery/dispatch",
    label: "Dispatch",
    icon: Truck,
    roles: getAllowedRoles("/delivery/dispatch")
  },
  {
    href: "/delivery/routes",
    label: "Routes",
    icon: ClipboardList,
    roles: getAllowedRoles("/delivery/routes")
  },
  {
    href: "/delivery/drivers",
    label: "Drivers",
    icon: UserRound,
    roles: getAllowedRoles("/delivery/drivers")
  },
  {
    href: "/delivery/reports",
    label: "Delivery Reports",
    icon: BarChart3,
    roles: getAllowedRoles("/delivery/reports")
  },
  {
    href: "/client-portal",
    label: "Open As Client",
    icon: UserRound,
    roles: ["admin"]
  },
  {
    href: "/client-portal/messages",
    label: "Client Messages",
    icon: MessageSquare,
    roles: ["admin"]
  },
  {
    href: "/client-portal/messages",
    label: "Messages",
    icon: MessageSquare,
    roles: getAllowedRoles("/client-portal/messages").filter((role) => role !== "admin")
  },
  {
    href: "/supplier-dashboard",
    label: "Suppliers",
    icon: Building2,
    roles: getAllowedRoles("/supplier-dashboard")
  },
  {
    href: "/inventory",
    label: "Inventory",
    icon: Boxes,
    roles: getAllowedRoles("/inventory")
  },
  {
    href: "/raw-materials",
    label: "Raw Materials",
    icon: Factory,
    roles: getAllowedRoles("/raw-materials")
  },
  {
    href: "/admin/raw-materials",
    label: "Raw Master",
    icon: Factory,
    roles: getAllowedRoles("/admin/raw-materials")
  },
  {
    href: "/product-management",
    label: "Products",
    icon: PackagePlus,
    roles: getAllowedRoles("/product-management")
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
    href: "/admin/call-center-numbers",
    label: "Call Numbers",
    icon: PhoneCall,
    roles: getAllowedRoles("/admin/call-center-numbers")
  },
  {
    href: "/admin/reset-data",
    label: "Historical Data",
    icon: RotateCcw,
    roles: getAllowedRoles("/admin/reset-data")
  },
  {
    href: "/admin/dev-tools",
    label: "Dev Tools",
    icon: SlidersHorizontal,
    roles: getAllowedRoles("/admin/dev-tools")
  },
  {
    href: "/admin/companies",
    label: "Companies",
    icon: Building2,
    roles: getAllowedRoles("/admin/companies")
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
  },
  {
    href: "/sync-status",
    label: "Sync",
    icon: RefreshCw,
    roles: getAllowedRoles("/sync-status")
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
  const [isOnline, setIsOnline] = useState(true);
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [activeCompanyId, setActiveCompany] = useState("all");
  const [companies, setCompanies] = useState<ReturnType<typeof getCompanies>>([]);
  const allowedRoleKey = allowedRoles?.join(",");

  useEffect(() => {
    let isMounted = true;

    async function openApp() {
      cleanupLegacyDemoProductData();
      const session = getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const pageAllowedRoles = allowedRoles ?? getAllowedRoles(pathname);

      if (!pageAllowedRoles.includes(session.role) || !canAccessRoute(session, pathname)) {
        window.sessionStorage.setItem(
          "kingapp.permissionMessage",
          "You do not have permission to access this operation."
        );
        router.replace(session.role === "callcenter" ? "/call-center" : "/dashboard");
        return;
      }

      if (isMounted) {
        setUser(session);
        setActiveCompany(getActiveCompanyId(session));
        setCompanies(getCompanies());
        setIsReady(true);
      }

      if (!hasStartedBackgroundSync) {
        hasStartedBackgroundSync = true;
        window.setTimeout(() => {
          void syncSupabaseToLocalStorage()
            .then(() => window.dispatchEvent(new Event("kingapp:data-synced")))
            .catch((error) => {
              console.warn("[KingApp] Background Supabase sync failed", error);
            });
        }, 1000);
      }
    }

    void openApp();

    return () => {
      isMounted = false;
    };
  }, [allowedRoleKey, pathname, router]);

  useEffect(() => {
    function updateCompany() {
      const session = getSession();
      setActiveCompany(getActiveCompanyId(session));
      setCompanies(getCompanies());
    }

    window.addEventListener("kingapp:company-switched", updateCompany);
    return () => window.removeEventListener("kingapp:company-switched", updateCompany);
  }, []);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    function updateOnlineStatus() {
      const online = navigator.onLine;
      setIsOnline(online);

      if (online) {
        void syncPendingQueue();
      }
    }

    updateOnlineStatus();
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  function handleLogout() {
    if (user) {
      logAuditEvent({
        action: "logout",
        module: "Login",
        recordId: user.id,
        reason: "User logged out",
        status: "success",
        user
      });
    }
    clearSession();
    router.replace("/login");
  }

  async function handleInstall() {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  function handleCompanyChange(companyId: string) {
    setActiveCompanyId(companyId);
    setActiveCompany(companyId);
    window.dispatchEvent(new Event("kingapp:company-switched"));
    window.dispatchEvent(new Event("kingapp:data-synced"));
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

  const visibleNav = navItems.filter((item) => item.roles.includes(user.role) && canAccessRoute(user, item.href));
  const mobileVisibleNav = visibleNav.filter(
    (item) => !item.href.startsWith("/call-center")
  );
  const groupedVisibleNav = groupNavItems(visibleNav);
  const groupedMobileNav = groupNavItems(mobileVisibleNav);

  const workspaceName =
    activeCompanyId === "all" ? "All Companies" : getCompanyName(activeCompanyId, user.companyName);
  const currentDateLabel = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date());

  return (
    <main className="min-h-screen bg-transparent lg:grid lg:grid-cols-[300px_1fr]">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden h-screen w-[300px] border-r border-white/10 bg-gradient-to-b from-brand-950 via-brand-900 to-brand-800 p-5 text-white shadow-executive lg:flex lg:flex-col">
        <BrandBlock companyName={workspaceName} />
        <nav className="mt-8 min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
          {groupedVisibleNav.map((group) => (
            <NavGroupBlock key={group.title} title={group.title}>
              {group.items.map((item) => (
                <NavLink
                  href={item.href}
                  icon={item.icon}
                  isActive={pathname === item.href}
                  key={item.href}
                  label={item.label}
                />
              ))}
            </NavGroupBlock>
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
            <div className="hidden shrink-0 lg:block">
              <p className="text-xs font-bold uppercase tracking-normal text-brand-700">
                KingApp Workspace - {workspaceName}
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">
                {currentPageTitle(pathname)}
              </h1>
            </div>
            <div className="hidden min-w-0 flex-1 items-center justify-center px-4 xl:flex">
              <label className="relative w-full max-w-xl">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-brand-600 focus:bg-white focus:ring-4 focus:ring-brand-100"
                  placeholder="Search sales, clients, calls, stock, reports..."
                  type="search"
                />
              </label>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {user.role === "admin" ? (
                <select
                  className="hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 shadow-sm outline-none lg:block"
                  onChange={(event) => handleCompanyChange(event.target.value)}
                  value={activeCompanyId}
                >
                  <option value="all">All Companies</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              ) : null}
              <div className="hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm xl:block">
                {currentDateLabel}
              </div>
              <button className="hidden h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-brand-50 hover:text-brand-700 sm:inline-flex" type="button">
                <Bell className="h-4 w-4" />
              </button>
              <button className="hidden h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-brand-50 hover:text-brand-700 sm:inline-flex" type="button">
                <MessageSquare className="h-4 w-4" />
              </button>
              <Link className="primary-button hidden xl:inline-flex" href="/loading">
                <Plus className="h-4 w-4" />
                Quick Action
              </Link>
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
              {installPrompt ? (
                <button
                  className="primary-button hidden sm:inline-flex"
                  onClick={handleInstall}
                  type="button"
                >
                  <Download className="h-4 w-4" />
                  Install
                </button>
              ) : null}
            </div>
          </div>
        </header>
        {!isOnline ? (
          <div className="no-print border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-black text-amber-800">
            Offline Mode — data will sync when internet returns
          </div>
        ) : null}

        {mobileMenuOpen ? (
          <div className="no-print fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden">
            <div className="flex h-full w-[min(88vw,340px)] flex-col bg-gradient-to-b from-brand-950 via-brand-900 to-brand-800 p-5 text-white shadow-executive">
              <div className="flex items-start justify-between gap-4">
                <BrandBlock companyName={workspaceName} />
                <button
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/15"
                  onClick={() => setMobileMenuOpen(false)}
                  type="button"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="mt-8 min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
                {groupedMobileNav.map((group) => (
                  <NavGroupBlock key={group.title} title={group.title}>
                    {group.items.map((item) => (
                      <NavLink
                        href={item.href}
                        icon={item.icon}
                        isActive={pathname === item.href}
                        key={item.href}
                        label={item.label}
                        onClick={() => setMobileMenuOpen(false)}
                      />
                    ))}
                  </NavGroupBlock>
                ))}
              </nav>
              {installPrompt ? (
                <button
                  className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-black text-brand-900"
                  onClick={handleInstall}
                  type="button"
                >
                  <Download className="h-4 w-4" />
                  Install KingApp
                </button>
              ) : null}
              <UserPanel
                handleLogout={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                user={user}
              />
            </div>
          </div>
        ) : null}

        <section className="mx-auto max-w-[1600px] px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:py-8">
          <MobileRoleHome
            isOnline={isOnline}
            pathname={pathname}
            user={user}
            visibleNav={mobileVisibleNav}
          />
          {children(user)}
        </section>
        <MobileBottomNav
          onOpenMenu={() => setMobileMenuOpen(true)}
          pathname={pathname}
          visibleNav={mobileVisibleNav}
        />
      </div>
    </main>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <KingAppLogo size={44} />
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

function BrandBlock({ companyName }: { companyName?: string }) {
  return (
    <div>
      <BrandMark />
      <p className="mt-4 text-sm font-medium leading-6 text-emerald-100">
        Enterprise Business Platform
      </p>
      {companyName ? (
        <p className="mt-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-black text-white">
          {companyName}
        </p>
      ) : null}
    </div>
  );
}

function groupNavItems(items: NavItem[]): NavGroup[] {
  const groupOrder = ["Main", "Operations", "Client Network", "CCRM", "Management"];
  const groups = new Map<string, NavItem[]>();

  items.forEach((item) => {
    const title = getNavGroupTitle(item.href);
    groups.set(title, [...(groups.get(title) ?? []), item]);
  });

  return groupOrder
    .map((title) => ({ title, items: groups.get(title) ?? [] }))
    .filter((group) => group.items.length > 0);
}

function getNavGroupTitle(href: string) {
  if (href === "/dashboard" || href === "/executive") return "Main";
  if (href.startsWith("/call-center")) return "CCRM";
  if (href === "/client-orders" || href === "/supplier-dashboard" || href === "/client-portal" || href.startsWith("/customers")) return "Client Network";
  if (href.startsWith("/admin") || href === "/reports" || href === "/daily-report" || href === "/sync-status") return "Management";
  return "Operations";
}

function NavGroupBlock({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div>
      <p className="mb-3 px-3 text-[11px] font-black uppercase tracking-wide text-emerald-100/70">
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
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
    <div className="mt-4 shrink-0 rounded-lg border border-white/10 bg-white/10 p-3">
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

function MobileBottomNav({
  onOpenMenu,
  pathname,
  visibleNav
}: {
  onOpenMenu: () => void;
  pathname: string;
  visibleNav: NavItem[];
}) {
  const mobileItems = getMobileNavItems(visibleNav);

  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-18px_40px_rgba(15,35,24,0.12)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
        {mobileItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-black transition ${
                isActive
                  ? "bg-brand-700 text-white"
                  : "text-slate-500 hover:bg-brand-50 hover:text-brand-800"
              }`}
              href={item.href}
              key={item.href}
            >
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate">{shortMobileLabel(item.label)}</span>
            </Link>
          );
        })}
        <button
          className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-black text-slate-500 transition hover:bg-brand-50 hover:text-brand-800"
          onClick={onOpenMenu}
          type="button"
        >
          <Menu className="h-5 w-5" />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}

function getMobileNavItems(visibleNav: NavItem[]) {
  const dashboard = visibleNav.find((item) => item.href === "/dashboard");
  const priority = [
    "/loading",
    "/confirm-loading",
    "/sales",
    "/cash",
    "/returns",
    "/inventory",
    "/delivery",
    "/product-management",
    "/raw-materials",
    "/expenses",
    "/daily-report",
    "/reports"
  ];
  const prioritized = priority
    .map((href) => visibleNav.find((item) => item.href === href))
    .filter((item): item is NavItem => Boolean(item));
  const items = [dashboard, ...prioritized]
    .filter((item): item is NavItem => Boolean(item))
    .filter(
      (item, index, allItems) =>
        allItems.findIndex((candidate) => candidate.href === item.href) === index
    );

  return items.slice(0, 4);
}

function MobileRoleHome({
  isOnline,
  pathname,
  user,
  visibleNav
}: {
  isOnline: boolean;
  pathname: string;
  user: SessionUser;
  visibleNav: NavItem[];
}) {
  const shortcuts = getMobileRoleShortcuts(user.role, visibleNav);

  if (pathname.startsWith("/call-center") || shortcuts.length === 0) {
    return null;
  }

  return (
    <section className="no-print mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-brand-700">{roleLabels[user.role]} Mobile Home</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">{user.displayName}</h2>
        </div>
        <Link
          className={`rounded-full px-3 py-1 text-xs font-black ${isOnline ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
          href="/sync-status"
        >
          {isOnline ? "Online" : "Offline"}
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {shortcuts.map((item) => (
          <Link
            className="flex min-h-20 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-black text-slate-800 shadow-sm active:scale-[0.99]"
            href={item.href}
            key={`${item.href}-${item.label}`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white">
              <item.icon className="h-5 w-5" />
            </span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function getMobileRoleShortcuts(role: UserRole, visibleNav: NavItem[]) {
  const routeLabels: Partial<Record<string, string>> = {
    "/customers": "Client List",
    "/customers/debts": "Debt Requests",
    "/customers/debts/approvals": "Approvals",
    "/customers/payments": "Payments",
    "/customers/statements": "Statements",
    "/delivery": "Delivery",
    "/loading": "Loading",
    "/inventory": "Inventory",
    "/raw-materials": "Raw Materials",
    "/returns": "Returns",
    "/cash": "Cash",
    "/sales": "Sales",
    "/confirm-loading": "Confirm",
    "/reports": "Reports",
    "/daily-report": "Reports",
    "/client-portal": "Place Order",
    "/client-orders": "My Orders",
    "/sync-status": "Sync"
  };
  const priorityByRole: Record<UserRole, string[]> = {
    admin: ["/dashboard", "/loading", "/sales", "/cash", "/inventory", "/delivery"],
    manager: ["/dashboard", "/customers/debts/approvals", "/reports", "/daily-report", "/inventory", "/delivery"],
    supervisor: ["/dashboard", "/customers/debts/approvals", "/loading", "/sales", "/returns", "/reports"],
    storekeeper: ["/loading", "/inventory", "/raw-materials", "/returns", "/delivery", "/sync-status"],
    marketer: ["/sales", "/customers", "/delivery", "/client-portal/messages", "/customers/debts/approvals", "/sync-status"],
    accountant: ["/cash", "/customers/debts", "/customers/payments", "/customers/statements", "/expenses", "/daily-report"],
    callcenter: [],
    supplier: ["/supplier-dashboard", "/client-orders", "/delivery", "/client-portal/messages", "/reports", "/sync-status"],
    client: ["/client-portal", "/client-orders", "/delivery", "/customers/statements", "/client-portal/messages", "/sync-status"]
  };

  return priorityByRole[role]
    .map((href) => visibleNav.find((item) => item.href === href))
    .filter((item): item is NavItem => Boolean(item))
    .map((item) => ({
      ...item,
      label: routeLabels[item.href] ?? item.label
    }))
    .slice(0, 6);
}

function shortMobileLabel(label: string) {
  if (label === "Confirm Loading") {
    return "Confirm";
  }

  if (label === "Daily Report") {
    return "Daily";
  }

  return label;
}
