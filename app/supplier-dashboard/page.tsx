"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Building2, ClipboardCheck, LogOut, PackageCheck, UsersRound, WalletCards } from "lucide-react";
import {
  authenticateSupplier,
  clearSupplierSession,
  formatEta,
  getClientOrders,
  getClientsForSupplier,
  getSupplierClientLinks,
  getSupplierSession,
  saveSupplierSession,
  updateClientOrderDelivery,
  updateClientOrderStatus,
  updateLinkPrices,
  type ClientPortalOrder,
  type PortalClient,
  type PortalSupplier,
  type SupplierClientLink
} from "@/lib/client-portal-data";
import { getProducts } from "@/lib/products-data";
import { formatMoney } from "@/lib/sales-data";

export default function SupplierDashboardPage() {
  const [supplier, setSupplier] = useState<PortalSupplier | null>(null);
  const [username, setUsername] = useState("supplier1");
  const [password, setPassword] = useState("supplier123");
  const [error, setError] = useState("");

  useEffect(() => {
    setSupplier(getSupplierSession());
  }, []);

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const authenticatedSupplier = authenticateSupplier(username, password);

    if (!authenticatedSupplier) {
      setError("Invalid supplier login or inactive supplier.");
      return;
    }

    saveSupplierSession(authenticatedSupplier);
    setSupplier(authenticatedSupplier);
  }

  if (!supplier) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <form
          className="mx-auto mt-12 max-w-md rounded-lg border border-brand-100 bg-white p-6 shadow-executive"
          onSubmit={handleLogin}
        >
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-brand-50 text-brand-800">
              <Building2 className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-black text-slate-950">Supplier Dashboard</h1>
            <p className="mt-2 text-sm text-slate-600">
              Sign in to manage connected clients and incoming orders.
            </p>
          </div>
          <Input label="Username" onChange={setUsername} value={username} />
          <Input label="Password" onChange={setPassword} type="password" value={password} />
          {error ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          ) : null}
          <button className="primary-button mt-5 w-full">Sign in</button>
          <p className="mt-4 text-center text-xs font-semibold text-slate-500">
            Demo: supplier1 / supplier123
          </p>
        </form>
      </main>
    );
  }

  return <SupplierDashboard supplier={supplier} onLogout={() => setSupplier(null)} />;
}

function SupplierDashboard({
  onLogout,
  supplier
}: {
  onLogout: () => void;
  supplier: PortalSupplier;
}) {
  const [orders, setOrders] = useState<ClientPortalOrder[]>([]);
  const [clients, setClients] = useState<PortalClient[]>([]);
  const [links, setLinks] = useState<SupplierClientLink[]>([]);
  const [editingClientId, setEditingClientId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    const supplierOrders = getClientOrders().filter((order) => order.supplierId === supplier.id);
    setOrders(supplierOrders);
    setClients(getClientsForSupplier(supplier.id));
    setLinks(getSupplierClientLinks().filter((link) => link.supplierId === supplier.id && link.active));
  }

  const metrics = useMemo(
    () => ({
      clients: clients.length,
      pending: orders.filter((order) => order.status === "Pending").length,
      delivered: orders.filter((order) => order.status === "Delivered" || order.status === "Paid").length,
      balance: orders
        .filter((order) => order.paymentStatus !== "Paid")
        .reduce((sum, order) => sum + order.totalAmount, 0)
    }),
    [clients.length, orders]
  );

  function setStatus(order: ClientPortalOrder, status: "Approved" | "Rejected") {
    const updates =
      status === "Rejected"
        ? { rejectionReason: window.prompt("Reason for rejecting this order?") ?? "Rejected by supplier" }
        : {};
    setOrders(updateClientOrderStatus(order.id, status, updates).filter((item) => item.supplierId === supplier.id));
  }

  function dispatchOrder(order: ClientPortalOrder) {
    setOrders(updateClientOrderStatus(order.id, "Out for Delivery").filter((item) => item.supplierId === supplier.id));
  }

  function saveDeliveryDetails(event: FormEvent<HTMLFormElement>, order: ClientPortalOrder) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setOrders(
      updateClientOrderDelivery(order.id, {
        deliveryDate: String(form.get("deliveryDate") ?? ""),
        deliveryTruck: String(form.get("deliveryTruck") ?? ""),
        deliveryDriver: String(form.get("deliveryDriver") ?? ""),
        estimatedArrivalTime: String(form.get("estimatedArrivalTime") ?? ""),
        estimatedArrivalEndTime: String(form.get("estimatedArrivalEndTime") ?? ""),
        driverMinutesAway: Number(form.get("driverMinutesAway")) || undefined
      }).filter((item) => item.supplierId === supplier.id)
    );
    setMessage("Delivery notice saved.");
  }

  function savePrices(event: FormEvent<HTMLFormElement>, client: PortalClient) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const prices: Record<string, number> = {};

    getProducts().forEach((product) => {
      const value = Number(form.get(product.itemCode));
      if (Number.isFinite(value) && value > 0) {
        prices[product.itemCode] = value;
      }
    });

    updateLinkPrices(supplier.id, client.id, prices, String(form.get("assignedMarketer") ?? "Marketer 1"));
    setEditingClientId("");
    setMessage("Client prices saved.");
    refresh();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="app-card-soft p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-normal text-brand-700">Private Supplier Access</p>
                <h1 className="text-3xl font-black text-slate-950">{supplier.name}</h1>
                <p className="text-sm font-semibold text-slate-500">
                  {supplier.phone} - {supplier.location}
                </p>
              </div>
            </div>
            <button
              className="secondary-button"
              onClick={() => {
                clearSupplierSession();
                onLogout();
              }}
              type="button"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </section>

        {message ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            {message}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={UsersRound} label="Connected Clients" value={metrics.clients} />
          <Metric icon={ClipboardCheck} label="Pending Orders" value={metrics.pending} />
          <Metric icon={PackageCheck} label="Delivered Orders" value={metrics.delivered} />
          <Metric icon={WalletCards} label="Open Balance" value={`${formatMoney(metrics.balance)} RWF`} />
        </div>

        <section className="app-card p-5">
          <h2 className="text-xl font-black text-slate-950">Incoming Orders</h2>
          <div className="mt-4 grid gap-3">
            {orders.map((order) => (
              <article className="rounded-lg border border-slate-200 bg-white p-4" key={order.id}>
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <h3 className="text-lg font-black text-slate-950">{order.clientName}</h3>
                    <p className="text-sm font-semibold text-slate-500">
                      {order.phone} - {order.location} - {new Date(order.createdAt).toLocaleString()}
                    </p>
                    <p className="mt-2 font-black text-brand-800">
                      {order.totalQuantity} cartons - {formatMoney(order.totalAmount)} RWF
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge label={order.status} />
                    <Badge label={order.paymentStatus} />
                  </div>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.lines.map((line) => (
                        <tr key={`${order.id}-${line.itemCode}`}>
                          <td className="font-bold text-slate-950">{line.productName}</td>
                          <td>{line.quantity}</td>
                          <td>{formatMoney(line.pricePerCarton)} RWF</td>
                          <td>{formatMoney(line.amount)} RWF</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <DeliverySummary order={order} />
                <DeliveryAssignmentForm order={order} onSubmit={saveDeliveryDetails} />
                {order.status === "Pending" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button className="primary-button" onClick={() => setStatus(order, "Approved")} type="button">Approve</button>
                    <button className="danger-button" onClick={() => setStatus(order, "Rejected")} type="button">Reject</button>
                  </div>
                ) : null}
                {order.status === "Approved" || order.status === "Loaded" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button className="primary-button" onClick={() => dispatchOrder(order)} type="button">Dispatch / Out for Delivery</button>
                  </div>
                ) : null}
              </article>
            ))}
            {orders.length === 0 ? (
              <p className="text-sm font-semibold text-slate-500">No orders from connected clients yet.</p>
            ) : null}
          </div>
        </section>

        <section className="app-card p-5">
          <h2 className="text-xl font-black text-slate-950">Connected Clients & Custom Prices</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {clients.map((client) => {
              const link = links.find((item) => item.clientId === client.id);
              return (
                <article className="rounded-lg border border-slate-200 bg-white p-4" key={client.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-black text-slate-950">{client.clientName}</h3>
                      <p className="text-sm font-semibold text-slate-500">
                        {client.ownerName} - {client.phone} - {client.location}
                      </p>
                    </div>
                    <button className="secondary-button" onClick={() => setEditingClientId(editingClientId === client.id ? "" : client.id)} type="button">
                      Set prices
                    </button>
                  </div>
                  {editingClientId === client.id ? (
                    <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={(event) => savePrices(event, client)}>
                      <Field defaultValue={link?.assignedMarketer ?? client.assignedMarketer} label="Assigned Marketer" name="assignedMarketer" />
                      {getProducts().map((product) => (
                        <Field
                          defaultValue={String(link?.productPrices[product.itemCode] ?? client.productPrices[product.itemCode] ?? product.pricePerCarton)}
                          key={product.itemCode}
                          label={`${product.name} Price`}
                          name={product.itemCode}
                          type="number"
                        />
                      ))}
                      <button className="primary-button md:col-span-2">Save prices</button>
                    </form>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value
}: {
  icon: typeof UsersRound;
  label: string;
  value: number | string;
}) {
  return (
    <article className="app-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-black text-brand-800">{value}</p>
        </div>
        <div className="rounded-lg bg-brand-50 p-2 text-brand-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  );
}

function Badge({ label }: { label: string }) {
  return <span className="status-badge border-brand-100 bg-brand-50 text-brand-800">{label}</span>;
}

function DeliverySummary({ order }: { order: ClientPortalOrder }) {
  const eta = formatEta(order.estimatedArrivalTime, order.estimatedArrivalEndTime);
  return (
    <div className="mt-4 rounded-lg border border-brand-100 bg-brand-50 p-4">
      <p className="text-sm font-black text-brand-900">Delivery Time Notice</p>
      <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <p><span className="font-bold text-slate-500">Date:</span> {order.deliveryDate || "Not assigned"}</p>
        <p><span className="font-bold text-slate-500">ETA:</span> {eta || "Not assigned"}</p>
        <p><span className="font-bold text-slate-500">Truck:</span> {order.deliveryTruck || "Pending"}</p>
        <p><span className="font-bold text-slate-500">Driver:</span> {order.deliveryDriver || order.deliveryPerson || "Pending"}</p>
      </div>
      {order.driverMinutesAway && order.status === "Out for Delivery" ? (
        <p className="mt-2 text-sm font-bold text-emerald-700">Driver is {order.driverMinutesAway} minutes away.</p>
      ) : null}
    </div>
  );
}

function DeliveryAssignmentForm({
  onSubmit,
  order
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>, order: ClientPortalOrder) => void;
  order: ClientPortalOrder;
}) {
  return (
    <form className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-3" onSubmit={(event) => onSubmit(event, order)}>
      <Field defaultValue={order.deliveryDate ?? ""} label="Delivery Date" name="deliveryDate" type="date" />
      <Field defaultValue={order.deliveryTruck ?? ""} label="Delivery Truck" name="deliveryTruck" />
      <Field defaultValue={order.deliveryDriver ?? order.deliveryPerson ?? ""} label="Driver / Delivery Person" name="deliveryDriver" />
      <Field defaultValue={order.estimatedArrivalTime ?? ""} label="ETA Start" name="estimatedArrivalTime" type="time" />
      <Field defaultValue={order.estimatedArrivalEndTime ?? ""} label="ETA End" name="estimatedArrivalEndTime" type="time" />
      <Field defaultValue={String(order.driverMinutesAway ?? "")} label="Driver Minutes Away" name="driverMinutesAway" type="number" />
      <button className="secondary-button md:col-span-3">Save delivery notice</button>
    </form>
  );
}

function Input({
  label,
  onChange,
  type = "text",
  value
}: {
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <label className="mt-4 block">
      <span className="mb-1 block text-sm font-bold text-slate-700">{label}</span>
      <input className="form-input" onChange={(event) => onChange(event.target.value)} type={type} value={value} />
    </label>
  );
}

function Field({
  defaultValue,
  label,
  name,
  type = "text"
}: {
  defaultValue: string;
  label: string;
  name: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-normal text-slate-500">{label}</span>
      <input className="form-input" defaultValue={defaultValue} min={type === "number" ? "0" : undefined} name={name} type={type} />
    </label>
  );
}
