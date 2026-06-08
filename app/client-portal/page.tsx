"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Building2, Clock, LogOut, MessageSquare, PackageCheck, ShoppingCart, Truck, UserRound } from "lucide-react";
import {
  authenticatePortalClient,
  clearPortalSession,
  createClientOrder,
  formatEta,
  getCatalogForClientSupplier,
  getClientOrders,
  getPortalSession,
  getSuppliersForClient,
  savePortalSession,
  type ClientPortalOrder,
  type PortalClient,
  type PortalSupplier
} from "@/lib/client-portal-data";
import { formatMoney } from "@/lib/sales-data";
import {
  getClientMessageStats,
  getClientMessageThreads,
  getLinkedMessageCompaniesForClient,
  getMessagesForPortalClient
} from "@/lib/clientMessageService";
import { getDeliveryForOrder } from "@/lib/delivery-data";
import {
  getCustomerAccounts,
  getCustomerDebts,
  getCustomerPayments,
  getCustomerStatement
} from "@/lib/customer-accounts-data";

export default function ClientPortalPage() {
  const [client, setClient] = useState<PortalClient | null>(null);
  const [username, setUsername] = useState("kigalimart");
  const [password, setPassword] = useState("client123");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [ordersVersion, setOrdersVersion] = useState(0);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");

  useEffect(() => {
    const session = getPortalSession();
    setClient(session);
    if (session) {
      setSelectedSupplierId(getSuppliersForClient(session.id)[0]?.id ?? "");
    }
  }, []);

  const suppliers = useMemo(
    () => (client ? getSuppliersForClient(client.id) : []),
    [client]
  );
  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => supplier.id === selectedSupplierId) ?? suppliers[0],
    [selectedSupplierId, suppliers]
  );
  const catalog = useMemo(
    () => (client && selectedSupplier ? getCatalogForClientSupplier(client, selectedSupplier) : []),
    [client, selectedSupplier]
  );
  const clientOrders = useMemo(
    () =>
      client
        ? getClientOrders().filter((order) => order.clientId === client.id)
        : [],
    [client, ordersVersion]
  );
  const clientMessages = useMemo(
    () => (client ? getMessagesForPortalClient(client) : []),
    [client, ordersVersion]
  );
  const messageStats = getClientMessageStats(clientMessages);
  const messageThreads = getClientMessageThreads(clientMessages);
  const linkedMessageCompanies = client ? getLinkedMessageCompaniesForClient(client) : [];
  const customerAccount = client
    ? getCustomerAccounts().find((account) => account.phone.replace(/\D/g, "") === client.phone.replace(/\D/g, ""))
    : null;
  const customerDebts = customerAccount
    ? getCustomerDebts().filter((debt) => debt.customerId === customerAccount.customerId && debt.balance > 0)
    : [];
  const customerPayments = customerAccount
    ? getCustomerPayments().filter((payment) => payment.customerId === customerAccount.customerId)
    : [];
  const statementLines = customerAccount
    ? getCustomerStatement({ customerId: customerAccount.customerId, companyId: customerAccount.companyId })
    : [];
  const total = catalog.reduce((sum, product) => {
    const quantity = Number(quantities[product.itemCode]) || 0;
    return sum + quantity * product.clientPrice;
  }, 0);

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

  function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!client) return;

    const parsedQuantities = Object.fromEntries(
      Object.entries(quantities).map(([itemCode, value]) => [
        itemCode,
        Number(value) || 0
      ])
    );
    const hasQuantity = Object.values(parsedQuantities).some((value) => value > 0);

    if (!hasQuantity) {
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

  if (!client) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <form
          className="mx-auto mt-12 max-w-md rounded-lg border border-brand-100 bg-white p-6 shadow-executive"
          onSubmit={handleLogin}
        >
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-brand-50 text-brand-800">
              <UserRound className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-black text-slate-950">
              Client Ordering Portal
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Sign in to order from your connected supplier.
            </p>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-slate-700">
              Username
            </span>
            <input
              className="form-input"
              onChange={(event) => setUsername(event.target.value)}
              value={username}
            />
          </label>
          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-bold text-slate-700">
              Password
            </span>
            <input
              className="form-input"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>
          {error ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          ) : null}
          <button className="primary-button mt-5 w-full">Sign in</button>
          <p className="mt-4 text-center text-xs font-semibold text-slate-500">
            Demo: kigalimart / client123
          </p>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="app-card-soft p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-normal text-brand-700">
                Client Ordering Portal
              </p>
              <h1 className="mt-1 text-3xl font-black text-slate-950">
                {client.clientName}
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                {client.ownerName} - {client.phone} - {client.location}
              </p>
            </div>
            <button
              className="secondary-button"
              onClick={() => {
                clearPortalSession();
                setClient(null);
              }}
              type="button"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
            <Link className="primary-button" href="/client-portal/messages">
              <MessageSquare className="h-4 w-4" />
              Messages
            </Link>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <PortalMetric label="Unread Messages" value={clientMessages.filter((item) => !item.readByClient).length} />
          <PortalMetric label="Open Support Requests" value={messageStats.openSupportRequests} />
          <PortalMetric label="Last Reply" value={messageStats.lastReply ? new Date(messageStats.lastReply).toLocaleDateString() : "-"} />
          <PortalMetric label="Pending Replies" value={messageStats.waitingReply} />
          <PortalMetric label="Current Balance" value={`${formatMoney(customerAccount?.currentBalance ?? 0)} RWF`} />
          <PortalMetric label="Unpaid Invoices" value={customerDebts.length} />
        </div>

        <section className="app-card p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-950">Messages</h2>
              <p className="text-sm font-semibold text-slate-500">Send delivery, payment, order, and support messages to your supplier.</p>
            </div>
            <Link className="secondary-button" href="/client-portal/messages">
              <MessageSquare className="h-4 w-4" />
              Open Messages
            </Link>
          </div>
        </section>

        <section className="app-card p-5">
          <h2 className="text-xl font-black text-slate-950">Client Profile</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase text-slate-500">Preferred Supplier</p>
              <p className="mt-2 text-lg font-black text-slate-950">{selectedSupplier?.name ?? "No supplier selected"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase text-slate-500">Linked Suppliers</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {linkedMessageCompanies.map((company) => (
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${company.badgeClass}`} key={company.id}>
                    ✓ {company.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="app-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-brand-700" />
            <h2 className="text-xl font-black text-slate-950">Connected Suppliers</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {suppliers.map((supplier) => (
              <SupplierCard
                key={supplier.id}
                onSelect={() => {
                  setSelectedSupplierId(supplier.id);
                  setQuantities({});
                  setMessage("");
                  setError("");
                }}
                selected={supplier.id === selectedSupplier?.id}
                supplier={supplier}
              />
            ))}
            {suppliers.length === 0 ? (
              <p className="text-sm font-semibold text-slate-500">
                No active suppliers are assigned to this client.
              </p>
            ) : null}
          </div>
        </section>

        <section className="app-card p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-950">Recent Messages</h2>
              <p className="text-sm font-semibold text-slate-500">Unread Messages: {clientMessages.filter((item) => !item.readByClient).length}</p>
            </div>
            <Link className="secondary-button" href="/client-portal/messages">
              <MessageSquare className="h-4 w-4" />
              View All
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {messageThreads.slice(0, 4).map((thread) => (
              <article className="rounded-lg border border-slate-200 bg-white p-4" key={thread.threadId}>
                <p className="font-black text-slate-950">{thread.companyName}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">Last reply: {new Date(thread.createdAt).toLocaleString()}</p>
                <p className="mt-2 text-sm text-slate-600">{thread.subject}</p>
              </article>
            ))}
            {!messageThreads.length ? <p className="text-sm font-semibold text-slate-500">No recent messages yet.</p> : null}
          </div>
        </section>

        {message ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        <form className="app-card p-5" onSubmit={submitOrder}>
          <div className="mb-4 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-brand-700" />
            <h2 className="text-xl font-black text-slate-950">
              {selectedSupplier ? `${selectedSupplier.name} Product Catalog` : "Product Catalog"}
            </h2>
          </div>
          <div className="grid gap-3">
            {catalog.map((product) => {
              const quantity = Number(quantities[product.itemCode]) || 0;
              return (
                <div
                  className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-[1fr_140px_140px_160px] md:items-center"
                  key={product.itemCode}
                >
                  <div>
                    <h3 className="font-black text-slate-950">{product.name}</h3>
                    <p className="text-sm font-semibold text-slate-500">
                      {product.itemCode} - {product.unit}
                    </p>
                  </div>
                  <p className="font-bold text-brand-800">
                    {formatMoney(product.clientPrice)} RWF
                  </p>
                  <input
                    className="form-input"
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
                  <p className="text-right font-black text-slate-950">
                    {formatMoney(quantity * product.clientPrice)} RWF
                  </p>
                </div>
              );
            })}
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-2xl font-black text-brand-800">
              Total: {formatMoney(total)} RWF
            </p>
            <button className="primary-button" disabled={!selectedSupplier || catalog.length === 0}>
              <PackageCheck className="h-4 w-4" />
              Submit Order
            </button>
          </div>
        </form>

        <section className="app-card p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-950">My Account Statement</h2>
              <p className="text-sm font-semibold text-slate-500">View balance, unpaid invoices, and payment history.</p>
            </div>
            <button className="secondary-button" onClick={() => window.print()} type="button">
              Download / Print Statement
            </button>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase text-slate-500">Balance</p>
              <p className="mt-2 text-2xl font-black text-brand-800">{formatMoney(customerAccount?.currentBalance ?? 0)} RWF</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">Credit limit: {formatMoney(customerAccount?.creditLimit ?? 0)} RWF</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase text-slate-500">Unpaid Invoices</p>
              <p className="mt-2 text-2xl font-black text-red-700">{customerDebts.length}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">{formatMoney(customerDebts.reduce((sum, debt) => sum + debt.balance, 0))} RWF outstanding</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase text-slate-500">Last Payment</p>
              <p className="mt-2 text-lg font-black text-slate-950">{customerPayments[0]?.date ?? "No payment yet"}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">{customerPayments[0] ? `${formatMoney(customerPayments[0].amountPaid)} RWF` : "Payment history will appear here"}</p>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Reference</th>
                  <th>Debit</th>
                  <th>Credit</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {statementLines.slice(-8).map((line, index) => (
                  <tr key={`${line.reference}-${index}`}>
                    <td>{line.date}</td>
                    <td>{line.type}</td>
                    <td>{line.reference}</td>
                    <td>{formatMoney(line.debit)} RWF</td>
                    <td>{formatMoney(line.credit)} RWF</td>
                    <td className="font-black text-slate-950">{formatMoney(line.balance)} RWF</td>
                  </tr>
                ))}
                {!statementLines.length ? <tr><td colSpan={6}>No account statement records yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="app-card p-5">
          <h2 className="text-xl font-black text-slate-950">My Orders</h2>
          <div className="mt-4 grid gap-3">
            {clientOrders.map((order) => (
              <article
                className="rounded-lg border border-slate-200 bg-white p-4"
                key={order.id}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-black text-slate-950">{order.id}</h3>
                    <p className="text-sm text-slate-600">
                      {new Date(order.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="status-badge border-brand-100 bg-brand-50 text-brand-800">
                    {order.status}
                  </span>
                </div>
                <p className="mt-3 font-bold text-brand-800">
                  {order.totalQuantity} cartons - {formatMoney(order.totalAmount)} RWF
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Supplier: {order.supplier} - Payment: {order.paymentStatus}
                </p>
                <DeliveryNotice order={order} />
                <div className="mt-4">
                  <Link className="secondary-button" href={`/client-portal/messages?orderId=${order.id}`}>
                    <MessageSquare className="h-4 w-4" />
                    Message about this order
                  </Link>
                </div>
                {(order.notifications ?? []).length > 0 ? (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 flex items-center gap-2 text-sm font-black text-slate-950">
                      <Bell className="h-4 w-4 text-brand-700" />
                      Notifications
                    </div>
                    <div className="space-y-2">
                      {(order.notifications ?? []).slice(-4).reverse().map((notification) => (
                        <p className="text-xs font-semibold text-slate-600" key={notification.id}>
                          {new Date(notification.createdAt).toLocaleString()} - {notification.message}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
            {clientOrders.length === 0 ? (
              <p className="text-sm font-semibold text-slate-500">
                No orders submitted yet.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function PortalMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <article className="app-card p-5">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-black text-brand-800">{value}</p>
    </article>
  );
}

function DeliveryNotice({ order }: { order: ClientPortalOrder }) {
  const delivery = getDeliveryForOrder(order.id);
  const eta = formatEta(order.estimatedArrivalTime, order.estimatedArrivalEndTime);
  const minutesAway = order.driverMinutesAway && order.status === "Out for Delivery"
    ? `Driver is ${order.driverMinutesAway} minutes away.`
    : "";
  const status = delivery?.status ?? order.status;
  const truck = delivery?.truck ?? order.deliveryTruck;
  const driver = delivery?.driver ?? order.deliveryDriver ?? order.deliveryPerson;
  const etaStart = delivery?.etaStart ?? order.estimatedArrivalTime;
  const etaEnd = delivery?.etaEnd ?? order.estimatedArrivalEndTime;
  const deliveryEta = formatEta(etaStart, etaEnd);

  return (
    <div className="mt-4 rounded-lg border border-brand-100 bg-brand-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-black uppercase tracking-normal text-brand-800">
            <Truck className="h-4 w-4" />
            Delivery Notice
          </div>
          <p className="mt-2 text-sm font-bold text-slate-800">
            Order {order.id} - {status}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Delivery date: {order.deliveryDate || "Waiting for supplier schedule"}
          </p>
          <p className="mt-1 text-lg font-black text-brand-900">
            {deliveryEta || eta ? `Expected ${deliveryEta || eta}` : "ETA not assigned yet"}
          </p>
          {delivery?.deliveredAt ? (
            <p className="mt-1 text-sm font-bold text-emerald-700">
              Delivered: {new Date(delivery.deliveredAt).toLocaleString()}
            </p>
          ) : null}
          {minutesAway ? (
            <p className="mt-1 text-sm font-bold text-emerald-700">{minutesAway}</p>
          ) : null}
        </div>
        <div className="rounded-lg bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-brand-700" />
            {truck || "Truck pending"}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Driver: {driver || "Pending"}
          </p>
        </div>
      </div>
    </div>
  );
}

function SupplierCard({
  onSelect,
  selected,
  supplier
}: {
  onSelect: () => void;
  selected: boolean;
  supplier: PortalSupplier;
}) {
  return (
    <button
      className={`rounded-lg border p-4 text-left transition ${
        selected
          ? "border-brand-500 bg-brand-50 shadow-sm"
          : "border-slate-200 bg-white hover:border-brand-200"
      }`}
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand-700 shadow-sm">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-black text-slate-950">{supplier.name}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {supplier.phone} - {supplier.location}
          </p>
          <p className="mt-2 text-xs font-bold uppercase tracking-normal text-brand-700">
            {selected ? "Selected supplier" : "Open supplier"}
          </p>
        </div>
      </div>
    </button>
  );
}
