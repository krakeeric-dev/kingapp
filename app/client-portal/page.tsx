"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  Building2,
  CalendarClock,
  ChevronDown,
  ClipboardList,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Headphones,
  Home,
  LogOut,
  MapPin,
  MessageSquare,
  PackageCheck,
  PhoneCall,
  ReceiptText,
  ShoppingCart,
  Truck,
  UserRound,
  WalletCards
} from "lucide-react";
import { KingAppLogo } from "@/components/KingAppLogo";
import {
  authenticatePortalClient,
  clearPortalSession,
  createClientOrder,
  formatEta,
  getCatalogForClientSupplier,
  getClientOrders,
  getPortalClients,
  getPortalSession,
  getSuppliersForClient,
  savePortalSession,
  type ClientOrderStatus,
  type ClientPortalOrder,
  type PortalClient,
  type PortalSupplier
} from "@/lib/client-portal-data";
import {
  getClientMessageCompanyDisplay,
  getClientMessageStats,
  getClientMessageThreads,
  getLinkedMessageCompaniesForClient,
  getMessagesForPortalClient
} from "@/lib/clientMessageService";
import {
  getCustomerAccounts,
  getCustomerDebts,
  getCustomerPayments,
  getCustomerStatement
} from "@/lib/customer-accounts-data";
import { getDeliveryForOrder } from "@/lib/delivery-data";
import { logAuditEvent } from "@/lib/loading-data";
import { formatMoney } from "@/lib/sales-data";
import { getSession } from "@/lib/storage";
import type { SessionUser } from "@/lib/auth";

const ADMIN_CLIENT_VIEW_KEY = "kingapp.clientPortal.adminViewClientId";

const orderStatuses: ClientOrderStatus[] = [
  "Pending",
  "Approved",
  "Loaded",
  "Dispatched",
  "Out for Delivery",
  "Delivered"
];

export default function ClientPortalPage() {
  const [client, setClient] = useState<PortalClient | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [ordersVersion, setOrdersVersion] = useState(0);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [adminUser, setAdminUser] = useState<SessionUser | null>(null);
  const [adminClientSearch, setAdminClientSearch] = useState("");

  useEffect(() => {
    const appSession = getSession();
    if (appSession?.role === "admin") {
      const savedClientId = window.localStorage.getItem(ADMIN_CLIENT_VIEW_KEY) ?? "";
      const adminClient = getPortalClients().find((item) => item.id === savedClientId) ?? null;
      setAdminUser(appSession);
      setClient(adminClient);
      if (adminClient) {
        setSelectedSupplierId(getSuppliersForClient(adminClient.id)[0]?.id ?? "");
      }
      return;
    }

    const session = getPortalSession();
    setClient(session);
    if (session) setSelectedSupplierId(getSuppliersForClient(session.id)[0]?.id ?? "");
  }, []);

  const suppliers = useMemo(() => (client ? getSuppliersForClient(client.id) : []), [client]);
  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => supplier.id === selectedSupplierId) ?? suppliers[0],
    [selectedSupplierId, suppliers]
  );
  const catalog = useMemo(
    () => (client && selectedSupplier ? getCatalogForClientSupplier(client, selectedSupplier) : []),
    [client, selectedSupplier]
  );
  const clientOrders = useMemo(
    () => (client ? getClientOrders().filter((order) => order.clientId === client.id) : []),
    [client, ordersVersion]
  );
  const supplierOrders = useMemo(
    () => selectedSupplier ? clientOrders.filter((order) => order.supplierId === selectedSupplier.id) : clientOrders,
    [clientOrders, selectedSupplier]
  );
  const clientMessages = useMemo(
    () => (client ? getMessagesForPortalClient(client) : []),
    [client, ordersVersion]
  );
  const messageStats = getClientMessageStats(clientMessages);
  const messageThreads = getClientMessageThreads(clientMessages);
  const linkedMessageCompanies = client ? getLinkedMessageCompaniesForClient(client) : [];
  const selectedCompanyDisplay =
    selectedSupplier
      ? linkedMessageCompanies.find((company) => company.supplierId === selectedSupplier.id)
      : linkedMessageCompanies[0];
  const customerAccount = client
    ? getCustomerAccounts().find((account) => account.phone.replace(/\D/g, "") === client.phone.replace(/\D/g, ""))
    : null;
  const customerDebts = customerAccount
    ? getCustomerDebts().filter((debt) => debt.customerId === customerAccount.customerId && debt.balance > 0)
    : [];
  const customerPayments = customerAccount
    ? getCustomerPayments()
        .filter((payment) => payment.customerId === customerAccount.customerId)
        .sort((first, second) => second.date.localeCompare(first.date))
    : [];
  const statementLines = customerAccount
    ? getCustomerStatement({ customerId: customerAccount.customerId, companyId: customerAccount.companyId })
    : [];
  const currentMonth = new Date().toISOString().slice(0, 7);
  const ordersThisMonth = supplierOrders.filter((order) => order.createdAt.slice(0, 7) === currentMonth).length;
  const pendingOrders = supplierOrders.filter((order) => ["Pending", "Approved", "Loaded"].includes(order.status)).length;
  const inTransitOrders = supplierOrders.filter((order) => ["Dispatched", "Out for Delivery"].includes(order.status)).length;
  const unreadMessages = clientMessages.filter((item) => !item.readByClient).length;
  const outstandingBalance = customerAccount?.currentBalance ?? customerDebts.reduce((sum, debt) => sum + debt.balance, 0);
  const creditLimit = customerAccount?.creditLimit ?? 0;
  const availableCredit = Math.max(0, creditLimit - outstandingBalance);
  const lastPayment = customerPayments[0];
  const totalPurchases = statementLines.reduce((sum, line) => sum + line.debit, 0);
  const totalPayments = statementLines.reduce((sum, line) => sum + line.credit, 0);
  const latestDeliveryOrder =
    supplierOrders.find((order) => ["Dispatched", "Out for Delivery", "Loaded"].includes(order.status)) ?? supplierOrders[0];
  const orderTotal = catalog.reduce((sum, product) => {
    const quantity = Number(quantities[product.itemCode]) || 0;
    return sum + quantity * product.clientPrice;
  }, 0);
  const adminClients = useMemo(() => {
    if (!adminUser) return [];
    const term = adminClientSearch.trim().toLowerCase();
    return getPortalClients().filter((portalClient) => {
      const linkedSuppliers = getSuppliersForClient(portalClient.id);
      const searchable = [
        portalClient.clientName,
        portalClient.ownerName,
        portalClient.phone,
        portalClient.location,
        portalClient.supplier,
        ...linkedSuppliers.map((supplier) => `${supplier.name} ${supplier.phone} ${supplier.location}`)
      ].join(" ").toLowerCase();
      return !term || searchable.includes(term);
    });
  }, [adminClientSearch, adminUser]);

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const authenticatedClient = authenticatePortalClient(username, password);
    if (!authenticatedClient) {
      setError("Invalid client login.");
      return;
    }
    savePortalSession(authenticatedClient);
    setClient(authenticatedClient);
    setSelectedSupplierId(getSuppliersForClient(authenticatedClient.id)[0]?.id ?? "");
  }

  function logout() {
    clearPortalSession();
    setClient(null);
    setPassword("");
  }

  function enterAdminClientView(portalClient: PortalClient) {
    if (!adminUser) return;
    window.localStorage.setItem(ADMIN_CLIENT_VIEW_KEY, portalClient.id);
    setClient(portalClient);
    setSelectedSupplierId(getSuppliersForClient(portalClient.id)[0]?.id ?? "");
    setQuantities({});
    setMessage("");
    setError("");
    logAuditEvent({
      action: "admin_entered_client_portal",
      companyId: portalClient.supplier,
      companyName: portalClient.supplier,
      module: "Client Portal",
      newValue: { clientId: portalClient.id, clientName: portalClient.clientName },
      recordId: portalClient.id,
      reason: `Admin entered client portal as ${portalClient.clientName}`,
      status: "success",
      user: adminUser
    });
  }

  function exitAdminClientView() {
    if (adminUser && client) {
      logAuditEvent({
        action: "admin_exited_client_portal",
        companyId: client.supplier,
        companyName: client.supplier,
        module: "Client Portal",
        oldValue: { clientId: client.id, clientName: client.clientName },
        recordId: client.id,
        reason: `Admin exited client view for ${client.clientName}`,
        status: "success",
        user: adminUser
      });
    }
    window.localStorage.removeItem(ADMIN_CLIENT_VIEW_KEY);
    setClient(null);
    setSelectedSupplierId("");
    setQuantities({});
    setMessage("");
    setError("");
  }

  function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;
    if (adminUser) {
      setError("Admin client view is read-only for order submission.");
      return;
    }

    const parsedQuantities = Object.fromEntries(
      Object.entries(quantities).map(([itemCode, value]) => [itemCode, Number(value) || 0])
    );

    if (!Object.values(parsedQuantities).some((value) => value > 0)) {
      setError("Enter at least one quantity before submitting.");
      return;
    }

    if (!selectedSupplier) {
      setError("No active supplier is assigned to this client.");
      return;
    }

    try {
      const { order } = createClientOrder(client, parsedQuantities, selectedSupplier.id);
      setQuantities({});
      setOrdersVersion((version) => version + 1);
      setError("");
      setMessage(`Order ${order.id} submitted. Status: ${order.status}.`);
    } catch (orderError) {
      setError(orderError instanceof Error ? orderError.message : "Order could not be submitted.");
    }
  }

  if (adminUser && !client) {
    return (
      <main className="min-h-screen bg-[#f4f7fb] p-4 sm:p-6">
        <section className="mx-auto max-w-6xl space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <KingAppLogo className="rounded-xl" size={60} />
                <div>
                  <p className="text-sm font-black uppercase text-blue-700">Admin Mode</p>
                  <h1 className="text-3xl font-black text-slate-950">Open Client Portal</h1>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Select a client to view the portal exactly as that customer.
                  </p>
                </div>
              </div>
              <Link className="secondary-button" href="/dashboard">Back to Dashboard</Link>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            Admin client view is read-first. Order submission is disabled to prevent accidental client orders.
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950">Client List</h2>
                <p className="text-sm font-semibold text-slate-500">Search by client name, phone, company, supplier, or location.</p>
              </div>
              <input
                className="form-input sm:max-w-sm"
                onChange={(event) => setAdminClientSearch(event.target.value)}
                placeholder="Search clients..."
                value={adminClientSearch}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {adminClients.map((portalClient) => {
                const clientSuppliers = getSuppliersForClient(portalClient.id);
                return (
                  <button
                    className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
                    key={portalClient.id}
                    onClick={() => enterAdminClientView(portalClient)}
                    type="button"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-black text-blue-700">
                        {getInitials(portalClient.clientName)}
                      </div>
                      <div>
                        <h3 className="font-black text-slate-950">{portalClient.clientName}</h3>
                        <p className="mt-1 text-sm font-semibold text-slate-500">{portalClient.phone} - {portalClient.location}</p>
                        <p className="mt-2 text-xs font-black uppercase text-blue-700">
                          {clientSuppliers.map((supplier) => supplier.name).join(", ") || "No supplier linked"}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
              {!adminClients.length ? <EmptyState text="No clients yet." /> : null}
            </div>
          </section>
        </section>
      </main>
    );
  }

  if (!client) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8">
        <form
          className="mx-auto mt-12 max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-xl"
          onSubmit={handleLogin}
        >
          <div className="mb-7 text-center">
            <KingAppLogo className="mx-auto rounded-2xl" priority size={72} />
            <h1 className="mt-5 text-3xl font-black text-slate-950">KingApp Client Portal</h1>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              Sign in to place orders, track deliveries, and manage your account.
            </p>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-slate-700">Username</span>
            <input className="form-input" onChange={(event) => setUsername(event.target.value)} value={username} />
          </label>
          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-bold text-slate-700">Password</span>
            <input className="form-input" onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
          </label>
          {error ? <Alert tone="red">{error}</Alert> : null}
          <button className="primary-button mt-5 w-full">Sign in</button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[300px_1fr]">
        <ClientPortalSidebar adminMode={!!adminUser} client={client} unreadMessages={unreadMessages} onLogout={adminUser ? exitAdminClientView : logout} />

        <section className="min-w-0">
          {adminUser ? (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 sm:px-6">
              <div className="mx-auto flex max-w-[1560px] flex-col gap-3 text-sm font-bold text-amber-900 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="font-black uppercase">Admin Mode</span>
                  <span className="mx-2">Viewing as:</span>
                  <span className="font-black">{client.clientName}</span>
                </div>
                <button className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-black text-amber-900 hover:bg-amber-100" onClick={exitAdminClientView} type="button">
                  Exit Client View
                </button>
              </div>
            </div>
          ) : null}
          <ClientTopBar
            client={client}
            selectedSupplier={selectedSupplier}
            suppliers={suppliers}
            unreadMessages={unreadMessages}
            onSupplierChange={(supplierId) => {
              setSelectedSupplierId(supplierId);
              setQuantities({});
              setMessage("");
              setError("");
            }}
          />

          <div className="mx-auto max-w-[1560px] space-y-6 p-4 sm:p-6">
            {message ? <Alert tone="green">{message}</Alert> : null}
            {error ? <Alert tone="red">{error}</Alert> : null}

            <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
              <section className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-blue-50 p-6 shadow-sm">
                <div className="grid gap-4 md:grid-cols-[1fr_300px] md:items-center">
                  <div>
                    <p className="text-sm font-bold text-slate-600">Welcome back,</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <h1 className="text-3xl font-black text-slate-950">{client.clientName}</h1>
                      <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-black text-white">Verified</span>
                    </div>
                    <p className="mt-3 max-w-xl text-sm font-semibold text-slate-600">
                      Your account, orders, deliveries, messages, and statements are managed in one secure workspace.
                    </p>
                  </div>
                  <div className="hidden justify-end md:flex">
                    <div className="rounded-2xl border border-blue-100 bg-white/80 p-4 text-right shadow-sm">
                      <p className="text-xs font-black uppercase text-blue-700">Current Supplier</p>
                      <p className="mt-2 text-2xl font-black text-slate-950">{selectedSupplier?.name ?? "No supplier assigned"}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">{selectedSupplier?.phone ?? "Supplier contact unavailable"}</p>
                    </div>
                  </div>
                </div>
              </section>

              <AccountSummary
                availableCredit={availableCredit}
                creditLimit={creditLimit}
                lastPaymentAmount={lastPayment?.amountPaid ?? 0}
                lastPaymentDate={lastPayment?.date ?? "No payment yet"}
                outstandingBalance={outstandingBalance}
              />
            </div>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <PortalKpi icon={WalletCards} label="Outstanding Balance" tone="red" value={`${formatMoney(outstandingBalance)} RWF`} />
              <PortalKpi icon={ClipboardList} label="Pending Orders" linkLabel="View Orders" value={pendingOrders} />
              <PortalKpi icon={ShoppingCart} label="Orders This Month" linkLabel="View Orders" tone="green" value={ordersThisMonth} />
              <PortalKpi icon={Truck} label="Deliveries In Transit" linkLabel="Track Deliveries" value={inTransitOrders} />
              <PortalKpi icon={MessageSquare} label="Unread Messages" link="/client-portal/messages" linkLabel="View Messages" tone="purple" value={unreadMessages} />
            </section>

            <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
              <section className="space-y-6">
                <div className="grid gap-6 2xl:grid-cols-[1fr_420px]">
                  <Panel title="Recent Orders" action={<Link className="text-sm font-black text-blue-700" href="/client-orders">View All Orders</Link>}>
                    <RecentOrdersTable orders={supplierOrders.slice(0, 6)} />
                  </Panel>

                  <Panel title="Delivery Tracking" action={<span className="text-sm font-black text-blue-700">View All</span>}>
                    <DeliveryTrackingCard order={latestDeliveryOrder} />
                  </Panel>
                </div>

                <div className="grid gap-6 2xl:grid-cols-[1fr_1fr]">
                  <AccountStatement
                    closingBalance={statementLines.at(-1)?.balance ?? outstandingBalance}
                    openingBalance={customerAccount?.openingBalance ?? 0}
                    totalPayments={totalPayments}
                    totalPurchases={totalPurchases}
                  />
                  <RecentMessages threads={messageThreads.slice(0, 4)} unreadMessages={unreadMessages} />
                </div>

                <Panel title={selectedSupplier ? `${selectedSupplier.name} Product Catalog` : "Place Order"}>
                  <form onSubmit={submitOrder}>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                          <tr>
                            <th className="px-3 py-3">Product</th>
                            <th className="px-3 py-3">Item Code</th>
                            <th className="px-3 py-3">Unit Price</th>
                            <th className="px-3 py-3">Quantity</th>
                            <th className="px-3 py-3 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {catalog.map((product) => {
                            const quantity = Number(quantities[product.itemCode]) || 0;
                            return (
                              <tr className="border-t border-slate-100" key={product.itemCode}>
                                <td className="px-3 py-3 font-black text-slate-950">{product.name}</td>
                                <td className="px-3 py-3 font-semibold text-slate-500">{product.itemCode}</td>
                                <td className="px-3 py-3 font-black text-slate-800">{formatMoney(product.clientPrice)} RWF</td>
                                <td className="px-3 py-3">
                                  <input
                                    className="form-input max-w-28"
                                    min="0"
                                    onChange={(event) =>
                                      setQuantities((current) => ({
                                        ...current,
                                        [product.itemCode]: event.target.value
                                      }))
                                    }
                                    placeholder="0"
                                    type="number"
                                    value={quantities[product.itemCode] ?? ""}
                                  />
                                </td>
                                <td className="px-3 py-3 text-right font-black text-slate-950">{formatMoney(quantity * product.clientPrice)} RWF</td>
                              </tr>
                            );
                          })}
                          {!catalog.length ? (
                            <tr>
                              <td className="px-3 py-10 text-center font-bold text-slate-500" colSpan={5}>No products available yet.</td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-2xl font-black text-blue-700">Total: {formatMoney(orderTotal)} RWF</p>
                      <button className="primary-button" disabled={!!adminUser || !selectedSupplier || catalog.length === 0}>
                        <PackageCheck className="h-4 w-4" />
                        {adminUser ? "Order Entry Disabled in Admin Mode" : "Submit Order"}
                      </button>
                    </div>
                  </form>
                </Panel>
              </section>

              <aside className="space-y-6">
                <QuickActions />
                <Announcements />
                <Panel title="My Account">
                  <InfoRow label="Customer Name" value={client.clientName} />
                  <InfoRow label="Owner" value={client.ownerName} />
                  <InfoRow label="Phone" value={client.phone} />
                  <InfoRow label="Address" value={client.location} />
                  <InfoRow label="Preferred Supplier" value={selectedSupplier?.name ?? "No supplier selected"} />
                  <div className="mt-4 flex flex-wrap gap-2">
                    {linkedMessageCompanies.map((company) => (
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${company.badgeClass}`} key={company.id}>
                        {company.name}
                      </span>
                    ))}
                    {!linkedMessageCompanies.length ? <span className="text-sm font-bold text-slate-500">No linked suppliers yet.</span> : null}
                  </div>
                </Panel>
              </aside>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function ClientPortalSidebar({
  adminMode = false,
  client,
  onLogout,
  unreadMessages
}: {
  adminMode?: boolean;
  client: PortalClient;
  onLogout: () => void;
  unreadMessages: number;
}) {
  const items = [
    { href: "/client-portal", icon: Home, label: "Dashboard" },
    { href: "#place-order", icon: ShoppingCart, label: "Place Order" },
    { href: "/client-orders", icon: FileText, label: "My Orders" },
    { href: "#delivery", icon: Truck, label: "Delivery Tracking" },
    { href: "#account", icon: WalletCards, label: "My Account" },
    { href: "#statements", icon: ReceiptText, label: "Statements" },
    { href: "/client-portal/messages", icon: MessageSquare, label: "Messages", badge: unreadMessages },
    { href: "#complaints", icon: AlertTriangle, label: "Complaints" },
    { href: "#callbacks", icon: PhoneCall, label: "Callbacks" },
    { href: "#announcements", icon: Bell, label: "Announcements" },
    { href: "#profile", icon: UserRound, label: "My Profile" }
  ];

  return (
    <aside className="border-r border-slate-200 bg-white lg:sticky lg:top-0 lg:h-screen">
      <div className="flex h-full flex-col">
        <div className="bg-gradient-to-br from-blue-700 to-blue-600 p-6 text-white">
          <div className="flex items-center gap-3">
            <KingAppLogo className="rounded-xl" size={50} />
            <div>
              <h2 className="text-2xl font-black">KingApp</h2>
              <p className="text-sm font-semibold text-blue-100">Client Portal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {items.map((item, index) => (
            <Link
              className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm font-black transition ${
                index === 0 ? "bg-blue-600 text-white shadow-sm" : "text-slate-700 hover:bg-slate-100"
              }`}
              href={item.href}
              key={item.label}
            >
              <span className="flex items-center gap-3">
                <item.icon className="h-5 w-5" />
                {item.label}
              </span>
              {item.badge ? <span className="rounded-full bg-blue-600 px-2 py-1 text-xs text-white">{item.badge}</span> : null}
            </Link>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex items-center gap-3">
              <Headphones className="h-8 w-8 text-blue-700" />
              <div>
                <p className="text-sm font-black text-slate-950">Need Support?</p>
                <p className="text-xs font-semibold text-slate-500">We are here to help you.</p>
                <p className="mt-1 text-sm font-black text-blue-700">{client.phone}</p>
              </div>
            </div>
          </div>
          <button className="mt-4 flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-100" onClick={onLogout} type="button">
            <LogOut className="h-5 w-5" />
            {adminMode ? "Exit Client View" : "Logout"}
          </button>
        </div>
      </div>
    </aside>
  );
}

function ClientTopBar({
  client,
  onSupplierChange,
  selectedSupplier,
  suppliers,
  unreadMessages
}: {
  client: PortalClient;
  onSupplierChange: (supplierId: string) => void;
  selectedSupplier?: PortalSupplier;
  suppliers: PortalSupplier[];
  unreadMessages: number;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-[1560px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block sm:min-w-80">
          <Building2 className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-blue-700" />
          <select
            className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-4 pl-12 pr-10 text-sm font-black text-slate-900 shadow-sm outline-none focus:border-blue-300"
            onChange={(event) => onSupplierChange(event.target.value)}
            value={selectedSupplier?.id ?? ""}
          >
            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            {!suppliers.length ? <option value="">No supplier assigned</option> : null}
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </label>

        <div className="flex items-center justify-end gap-4">
          <button className="relative rounded-xl p-3 text-slate-700 hover:bg-slate-100" type="button">
            <Bell className="h-5 w-5" />
            {unreadMessages ? <span className="absolute right-1 top-1 rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white">{unreadMessages}</span> : null}
          </button>
          <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-sm font-black text-blue-700">
              {getInitials(client.clientName)}
            </div>
            <div>
              <p className="font-black text-slate-950">{client.clientName}</p>
              <p className="text-xs font-semibold text-slate-500">Premium Customer</p>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </div>
        </div>
      </div>
    </header>
  );
}

function AccountSummary({
  availableCredit,
  creditLimit,
  lastPaymentAmount,
  lastPaymentDate,
  outstandingBalance
}: {
  availableCredit: number;
  creditLimit: number;
  lastPaymentAmount: number;
  lastPaymentDate: string;
  outstandingBalance: number;
}) {
  return (
    <Panel title="Account Summary" action={<button className="text-sm font-black text-blue-700" onClick={() => window.print()} type="button">View Statement</button>}>
      <InfoRow label="Credit Limit" value={`${formatMoney(creditLimit)} RWF`} />
      <InfoRow danger label="Outstanding Balance" value={`${formatMoney(outstandingBalance)} RWF`} />
      <InfoRow good label="Available Credit" value={`${formatMoney(availableCredit)} RWF`} />
      <InfoRow label="Last Payment" value={`${formatMoney(lastPaymentAmount)} RWF`} />
      <InfoRow label="Last Payment Date" value={lastPaymentDate} />
    </Panel>
  );
}

function PortalKpi({
  icon: Icon,
  label,
  link = "#",
  linkLabel,
  tone = "blue",
  value
}: {
  icon: typeof ShoppingCart;
  label: string;
  link?: string;
  linkLabel?: string;
  tone?: "blue" | "green" | "purple" | "red";
  value: number | string;
}) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    purple: "bg-violet-50 text-violet-700",
    red: "bg-red-50 text-red-600"
  }[tone];
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-500">{label}</p>
          <p className={`mt-3 text-2xl font-black ${tone === "red" ? "text-red-600" : "text-slate-950"}`}>{value}</p>
        </div>
        <div className={`rounded-xl p-3 ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {linkLabel ? <Link className="mt-4 inline-block text-sm font-black text-blue-700" href={link}>{linkLabel}</Link> : null}
    </article>
  );
}

function RecentOrdersTable({ orders }: { orders: ClientPortalOrder[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-3">Order No</th>
            <th className="px-3 py-3">Date</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3">Amount</th>
            <th className="px-3 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr className="border-t border-slate-100" key={order.id}>
              <td className="px-3 py-3 font-black text-slate-950">{order.id}</td>
              <td className="px-3 py-3 font-semibold text-slate-600">{new Date(order.createdAt).toLocaleDateString()}</td>
              <td className="px-3 py-3"><StatusBadge status={order.status} /></td>
              <td className="px-3 py-3 font-black text-slate-950">{formatMoney(order.totalAmount)} RWF</td>
              <td className="px-3 py-3 text-right">
                <Link className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-50" href={`/client-portal/messages?orderId=${order.id}`}>View</Link>
              </td>
            </tr>
          ))}
          {!orders.length ? (
            <tr><td className="px-3 py-10 text-center font-bold text-slate-500" colSpan={5}>No orders yet.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function DeliveryTrackingCard({ order }: { order?: ClientPortalOrder }) {
  if (!order) return <EmptyState text="No deliveries yet." />;

  const delivery = getDeliveryForOrder(order.id);
  const eta = formatEta(delivery?.etaStart ?? order.estimatedArrivalTime, delivery?.etaEnd ?? order.estimatedArrivalEndTime);
  const status = delivery?.status ?? order.status;
  const driver = delivery?.driver ?? order.deliveryDriver ?? order.deliveryPerson ?? "Pending";
  const truck = delivery?.truck ?? order.deliveryTruck ?? "Pending";

  return (
    <div>
      <InfoRow label="Order No" value={order.id} />
      <InfoRow label="Driver" value={driver} />
      <InfoRow label="Truck" value={truck} />
      <InfoRow label="Phone" value={order.phone} />
      <InfoRow label="ETA" value={eta || "Not assigned yet"} />
      <InfoRow label="Status" value={status} />
      <div className="my-4 flex items-center justify-between gap-2">
        {orderStatuses.map((item) => (
          <span className={`h-2 flex-1 rounded-full ${orderStatuses.indexOf(item) <= orderStatuses.indexOf(order.status === "Paid" ? "Delivered" : order.status as ClientOrderStatus) ? "bg-blue-600" : "bg-slate-200"}`} key={item} title={item} />
        ))}
      </div>
      <button className="primary-button w-full" type="button">
        <MapPin className="h-4 w-4" />
        Track Live
      </button>
    </div>
  );
}

function QuickActions() {
  const actions = [
    { href: "#place-order", icon: ShoppingCart, label: "Place Order" },
    { href: "#payments", icon: CreditCard, label: "Make Payment" },
    { href: "/client-orders", icon: FileText, label: "My Orders" },
    { href: "/client-portal/messages", icon: MessageSquare, label: "Messages" },
    { href: "#complaints", icon: AlertTriangle, label: "Complaints" },
    { href: "#callbacks", icon: CalendarClock, label: "Callbacks" }
  ];
  return (
    <Panel title="Quick Actions">
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <Link className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-center text-xs font-black text-slate-700 hover:bg-blue-50 hover:text-blue-700" href={action.href} key={action.label}>
            <action.icon className="h-6 w-6" />
            {action.label}
          </Link>
        ))}
      </div>
    </Panel>
  );
}

function AccountStatement({
  closingBalance,
  openingBalance,
  totalPayments,
  totalPurchases
}: {
  closingBalance: number;
  openingBalance: number;
  totalPayments: number;
  totalPurchases: number;
}) {
  return (
    <Panel
      title="Account Statement"
      subtitle="This Month"
      action={<button className="text-sm font-black text-blue-700" onClick={() => window.print()} type="button">View Full Statement</button>}
    >
      <InfoRow label="Opening Balance" value={`${formatMoney(openingBalance)} RWF`} />
      <InfoRow label="Total Purchases" value={`${formatMoney(totalPurchases)} RWF`} />
      <InfoRow label="Total Payments" value={`${formatMoney(totalPayments)} RWF`} />
      <InfoRow danger={closingBalance > 0} label="Closing Balance" value={`${formatMoney(closingBalance)} RWF`} />
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button className="secondary-button justify-center" onClick={() => window.print()} type="button">
          <Download className="h-4 w-4 text-red-600" />
          Download PDF
        </button>
        <button className="secondary-button justify-center" onClick={() => window.print()} type="button">
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
          Download Excel
        </button>
      </div>
    </Panel>
  );
}

function RecentMessages({
  threads,
  unreadMessages
}: {
  threads: ReturnType<typeof getClientMessageThreads>;
  unreadMessages: number;
}) {
  return (
    <Panel title="Recent Messages" action={<Link className="text-sm font-black text-blue-700" href="/client-portal/messages">View All</Link>}>
      <div className="space-y-4">
        {threads.map((thread) => {
          const company = getClientMessageCompanyDisplay(thread.companyId, thread.companyName);
          return (
            <Link className="flex items-start gap-3 rounded-lg border border-transparent p-2 hover:border-blue-100 hover:bg-blue-50" href="/client-portal/messages" key={thread.threadId}>
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-sm font-black ${company.badgeClass}`}>{company.logo}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-black text-slate-950">{thread.companyName}</p>
                  <span className="shrink-0 text-xs font-bold text-slate-500">{new Date(thread.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <p className="mt-1 line-clamp-1 text-sm font-semibold text-slate-500">{thread.subject}</p>
              </div>
              {unreadMessages ? <span className="mt-2 h-2.5 w-2.5 rounded-full bg-blue-600" /> : null}
            </Link>
          );
        })}
        {!threads.length ? <EmptyState text="No messages yet." /> : null}
      </div>
    </Panel>
  );
}

function Announcements() {
  return (
    <Panel title="Announcements" action={<span className="text-sm font-black text-blue-700">View All</span>}>
      <EmptyState text="No announcements yet." />
    </Panel>
  );
}

function Panel({
  action,
  children,
  subtitle,
  title
}: {
  action?: ReactNode;
  children: ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-950">{title} {subtitle ? <span className="font-semibold text-slate-500">({subtitle})</span> : null}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function InfoRow({
  danger = false,
  good = false,
  label,
  value
}: {
  danger?: boolean;
  good?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 text-sm last:border-b-0">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className={`text-right font-black ${danger ? "text-red-600" : good ? "text-emerald-600" : "text-slate-950"}`}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "Delivered" || status === "Paid"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "Out for Delivery" || status === "Dispatched"
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : status === "Cancelled" || status === "Rejected"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-amber-200 bg-amber-50 text-amber-700";
  return <span className={`rounded-md border px-2.5 py-1 text-xs font-black ${className}`}>{status}</span>;
}

function Alert({ children, tone }: { children: ReactNode; tone: "green" | "red" }) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm font-bold ${tone === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-500">
      {text}
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "KA";
}
