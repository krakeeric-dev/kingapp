"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, ClipboardList, Link2, MessageSquare, PackageCheck, Truck, UserPlus, WalletCards } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { SessionUser } from "@/lib/auth";
import { formatMoney } from "@/lib/sales-data";
import {
  createPortalClient,
  createSupplier,
  formatEta,
  getClientOrders,
  getClientsForSupplier,
  getPortalClients,
  getSupplierClientLinks,
  getSuppliers,
  linkClientToSupplier,
  removeClientFromSupplier,
  updateLinkPrices,
  updateSupplier,
  updateClientOrderDelivery,
  updateClientOrderStatus,
  type ClientOrderStatus,
  type ClientPortalOrder,
  type PortalClient,
  type PortalSupplier,
  type SupplierClientLink
} from "@/lib/client-portal-data";
import { getProducts } from "@/lib/products-data";
import { getClientMessageStats, getClientMessageThreads, getMessagesForStaff, type ClientMessage } from "@/lib/clientMessageService";

export default function ClientOrdersPage() {
  return (
    <AppShell allowedRoles={["admin", "storekeeper", "accountant", "marketer", "manager", "supervisor"]}>
      {(user) => <ClientOrdersContent user={user} />}
    </AppShell>
  );
}

function ClientOrdersContent({ user }: { user: SessionUser }) {
  const [orders, setOrders] = useState<ClientPortalOrder[]>([]);
  const [clients, setClients] = useState<PortalClient[]>([]);
  const [suppliers, setSuppliers] = useState<PortalSupplier[]>([]);
  const [links, setLinks] = useState<SupplierClientLink[]>([]);
  const [clientMessages, setClientMessages] = useState<ClientMessage[]>([]);
  const [editingClientId, setEditingClientId] = useState("");
  const [editingSupplierId, setEditingSupplierId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    setOrders(getClientOrders());
    setClients(getPortalClients());
    setSuppliers(getSuppliers());
    setLinks(getSupplierClientLinks());
    setClientMessages(getMessagesForStaff(user));
  }

  const dashboard = useMemo(
    () => ({
      pending: orders.filter((order) => order.status === "Pending").length,
      approved: orders.filter((order) => order.status === "Approved").length,
      delivered: orders.filter((order) => order.status === "Delivered").length,
      unpaid: orders.filter((order) => order.paymentStatus !== "Paid").length
    }),
    [orders]
  );
  const messageStats = getClientMessageStats(clientMessages);
  const messageThreads = getClientMessageThreads(clientMessages);

  function setStatus(order: ClientPortalOrder, status: ClientOrderStatus) {
    const updates: Partial<ClientPortalOrder> = {};

    if (status === "Out for Delivery") {
      updates.deliveryPerson = user.displayName;
    }

    if (status === "Delivered") {
      updates.deliveryPerson = user.displayName;
      updates.deliveredAt = new Date().toISOString();
    }

    setOrders(updateClientOrderStatus(order.id, status, updates));
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
      })
    );
    setMessage("Delivery ETA updated.");
  }

  function markPaid(order: ClientPortalOrder) {
    setOrders(updateClientOrderStatus(order.id, "Paid", { paymentStatus: "Paid" }));
  }

  function rejectOrder(order: ClientPortalOrder) {
    const reason = window.prompt("Reason for rejecting this order?");
    setOrders(updateClientOrderStatus(order.id, "Rejected", { rejectionReason: reason ?? "Rejected by admin" }));
  }

  function saveClientPricing(event: FormEvent<HTMLFormElement>, client: PortalClient, supplierId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const link = links.find((item) => item.clientId === client.id && item.supplierId === supplierId);
    const productPrices = { ...(link?.productPrices ?? client.productPrices) };

    getProducts().forEach((product) => {
      const value = Number(form.get(product.itemCode));
      if (Number.isFinite(value) && value > 0) {
        productPrices[product.itemCode] = value;
      }
    });

    setLinks(
      updateLinkPrices(
        supplierId,
        client.id,
        productPrices,
        String(form.get("assignedMarketer") ?? link?.assignedMarketer ?? client.assignedMarketer)
      )
    );
    setEditingClientId("");
    setMessage("Client prices updated for this supplier connection.");
  }

  function handleCreateSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    createSupplier({
      name: String(form.get("name") ?? ""),
      username: String(form.get("username") ?? ""),
      password: String(form.get("password") ?? "supplier123"),
      phone: String(form.get("phone") ?? ""),
      location: String(form.get("location") ?? ""),
      status: "active",
      notes: String(form.get("notes") ?? "")
    });
    event.currentTarget.reset();
    setMessage("Supplier created.");
    refresh();
  }

  function handleCreateClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    createPortalClient({
      clientName: String(form.get("clientName") ?? ""),
      ownerName: String(form.get("ownerName") ?? ""),
      username: String(form.get("username") ?? ""),
      password: String(form.get("password") ?? "client123"),
      phone: String(form.get("phone") ?? ""),
      location: String(form.get("location") ?? ""),
      status: "active"
    });
    event.currentTarget.reset();
    setMessage("Client created.");
    refresh();
  }

  function handleLinkClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    linkClientToSupplier(
      String(form.get("supplierId") ?? ""),
      String(form.get("clientId") ?? ""),
      String(form.get("assignedMarketer") ?? "Marketer 1")
    );
    setMessage("Client linked to supplier.");
    refresh();
  }

  function toggleSupplier(supplier: PortalSupplier) {
    updateSupplier(supplier.id, {
      status: supplier.status === "active" ? "inactive" : "active"
    });
    setMessage("Supplier status updated.");
    refresh();
  }

  function removeLink(supplierId: string, clientId: string) {
    removeClientFromSupplier(supplierId, clientId);
    setMessage("Client removed from supplier.");
    refresh();
  }

  return (
    <div className="space-y-6">
      <section className="app-card-soft p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-950">Client Orders</h2>
            <p className="mt-1 text-sm text-slate-600">
              Approve client orders, prepare loading, confirm delivery, and track payment status.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={ClipboardList} label="Pending Orders" value={dashboard.pending} />
        <Metric icon={PackageCheck} label="Approved for Loading" value={dashboard.approved} />
        <Metric icon={Truck} label="Delivered" value={dashboard.delivered} />
        <Metric icon={WalletCards} label="Unpaid / Partial" value={dashboard.unpaid} />
      </div>

      <section className="app-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-950">Client Message Queue</h3>
            <p className="text-sm font-semibold text-slate-500">
              {messageStats.newMessages} new messages, {messageStats.waitingReply} waiting reply.
            </p>
          </div>
          <Link className="secondary-button" href="/call-center/messages">
            <MessageSquare className="h-4 w-4" />
            Open Messages
          </Link>
        </div>
        <div className="mt-4 grid gap-2">
          {messageThreads.slice(0, 4).map((thread) => (
            <div className="rounded-lg border border-slate-200 bg-white p-3" key={thread.threadId}>
              <p className="font-black text-slate-950">{thread.clientName} - {thread.messageType}</p>
              <p className="text-sm font-semibold text-slate-500">{thread.orderId ?? "No order"} - {thread.status}</p>
            </div>
          ))}
          {!messageThreads.length ? <p className="text-sm font-semibold text-slate-500">No client messages yet.</p> : null}
        </div>
      </section>

      <section className="app-card p-5">
        <h3 className="text-lg font-black text-slate-950">Supplier/Admin Order Dashboard</h3>
        <div className="mt-4 grid gap-3">
          {orders.map((order) => (
            <article className="rounded-lg border border-slate-200 p-4" key={order.id}>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <h4 className="text-lg font-black text-slate-950">{order.clientName}</h4>
                  <p className="mt-1 text-sm text-slate-600">
                    {order.phone} - {order.location} - {order.supplier}
                  </p>
                  <p className="mt-2 font-bold text-brand-800">
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
              <div className="mt-4">
                <Link className="secondary-button" href="/call-center/messages">
                  <MessageSquare className="h-4 w-4" />
                  Message about this order
                </Link>
              </div>
              {user.role === "admin" ? (
                <DeliveryAssignmentForm order={order} onSubmit={saveDeliveryDetails} />
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {user.role === "admin" && order.status === "Pending" ? (
                  <button className="primary-button" onClick={() => setStatus(order, "Approved")} type="button">Approve</button>
                ) : null}
                {user.role === "admin" && order.status === "Pending" ? (
                  <button className="danger-button" onClick={() => rejectOrder(order)} type="button">Reject</button>
                ) : null}
                {user.role === "storekeeper" && order.status === "Approved" ? (
                  <button className="primary-button" onClick={() => setStatus(order, "Loaded")} type="button">Mark Loaded</button>
                ) : null}
                {user.role === "admin" && (order.status === "Approved" || order.status === "Loaded") ? (
                  <button className="primary-button" onClick={() => setStatus(order, "Out for Delivery")} type="button">Dispatch</button>
                ) : null}
                {user.role === "marketer" && order.status === "Loaded" ? (
                  <button className="primary-button" onClick={() => setStatus(order, "Out for Delivery")} type="button">Out for Delivery</button>
                ) : null}
                {user.role === "marketer" && order.status === "Out for Delivery" ? (
                  <button className="primary-button" onClick={() => setStatus(order, "Delivered")} type="button">Confirm Delivered</button>
                ) : null}
                {user.role === "accountant" && order.status === "Delivered" && order.paymentStatus !== "Paid" ? (
                  <button className="primary-button" onClick={() => markPaid(order)} type="button">Mark Paid</button>
                ) : null}
              </div>
            </article>
          ))}
          {orders.length === 0 ? (
            <p className="text-sm font-semibold text-slate-500">No client portal orders yet.</p>
          ) : null}
        </div>
      </section>

      {user.role === "admin" ? (
        <AdminRelationshipPanel
          clients={clients}
          editingClientId={editingClientId}
          editingSupplierId={editingSupplierId}
          links={links}
          message={message}
          onCreateClient={handleCreateClient}
          onCreateSupplier={handleCreateSupplier}
          onEditClient={setEditingClientId}
          onEditSupplier={setEditingSupplierId}
          onLinkClient={handleLinkClient}
          onRemoveLink={removeLink}
          onSavePricing={saveClientPricing}
          onToggleSupplier={toggleSupplier}
          suppliers={suppliers}
        />
      ) : null}
    </div>
  );
}

function AdminRelationshipPanel({
  clients,
  editingClientId,
  editingSupplierId,
  links,
  message,
  onCreateClient,
  onCreateSupplier,
  onEditClient,
  onEditSupplier,
  onLinkClient,
  onRemoveLink,
  onSavePricing,
  onToggleSupplier,
  suppliers
}: {
  clients: PortalClient[];
  editingClientId: string;
  editingSupplierId: string;
  links: SupplierClientLink[];
  message: string;
  onCreateClient: (event: FormEvent<HTMLFormElement>) => void;
  onCreateSupplier: (event: FormEvent<HTMLFormElement>) => void;
  onEditClient: (id: string) => void;
  onEditSupplier: (id: string) => void;
  onLinkClient: (event: FormEvent<HTMLFormElement>) => void;
  onRemoveLink: (supplierId: string, clientId: string) => void;
  onSavePricing: (event: FormEvent<HTMLFormElement>, client: PortalClient, supplierId: string) => void;
  onToggleSupplier: (supplier: PortalSupplier) => void;
  suppliers: PortalSupplier[];
}) {
  return (
    <section className="app-card p-5">
      <div className="flex items-center gap-2">
        <Link2 className="h-5 w-5 text-brand-700" />
        <h3 className="text-lg font-black text-slate-950">Private Supplier-Client Access</h3>
      </div>
      {message ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <form className="rounded-lg border border-slate-200 bg-white p-4" onSubmit={onCreateSupplier}>
          <div className="mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-brand-700" />
            <h4 className="font-black text-slate-950">Create Supplier</h4>
          </div>
          <Input label="Supplier Name" name="name" />
          <Input label="Username" name="username" />
          <Input defaultValue="supplier123" label="Password" name="password" />
          <Input label="Phone" name="phone" />
          <Input label="Location" name="location" />
          <Input label="Notes" name="notes" />
          <button className="primary-button mt-3 w-full">Create supplier</button>
        </form>

        <form className="rounded-lg border border-slate-200 bg-white p-4" onSubmit={onCreateClient}>
          <div className="mb-3 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-brand-700" />
            <h4 className="font-black text-slate-950">Create Client</h4>
          </div>
          <Input label="Business Name" name="clientName" />
          <Input label="Owner Name" name="ownerName" />
          <Input label="Username" name="username" />
          <Input defaultValue="client123" label="Password" name="password" />
          <Input label="Phone" name="phone" />
          <Input label="Location" name="location" />
          <button className="primary-button mt-3 w-full">Create client</button>
        </form>

        <form className="rounded-lg border border-slate-200 bg-white p-4" onSubmit={onLinkClient}>
          <div className="mb-3 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-brand-700" />
            <h4 className="font-black text-slate-950">Link Client to Supplier</h4>
          </div>
          <Select label="Supplier" name="supplierId" options={suppliers.map((supplier) => ({ label: supplier.name, value: supplier.id }))} />
          <Select label="Client" name="clientId" options={clients.map((client) => ({ label: client.clientName, value: client.id }))} />
          <Input defaultValue="Marketer 1" label="Assigned Marketer" name="assignedMarketer" />
          <button className="primary-button mt-3 w-full">Link client</button>
        </form>
      </div>

      <div className="mt-5 grid gap-4">
        {suppliers.map((supplier) => {
          const supplierClients = getClientsForSupplier(supplier.id);
          return (
            <article className="rounded-lg border border-slate-200 bg-white p-4" key={supplier.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h4 className="text-lg font-black text-slate-950">{supplier.name}</h4>
                  <p className="text-sm font-semibold text-slate-500">
                    {supplier.phone} - {supplier.location} - {supplier.status}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    Supplier login: {supplier.username} / {supplier.password}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="secondary-button" onClick={() => onEditSupplier(editingSupplierId === supplier.id ? "" : supplier.id)} type="button">
                    Manage prices
                  </button>
                  <button className={supplier.status === "active" ? "danger-button" : "primary-button"} onClick={() => onToggleSupplier(supplier)} type="button">
                    {supplier.status === "active" ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {supplierClients.map((client) => {
                  const link = links.find((item) => item.supplierId === supplier.id && item.clientId === client.id);
                  const isEditing = editingSupplierId === supplier.id && editingClientId === client.id;
                  return (
                    <div className="rounded-lg border border-slate-200 p-4" key={`${supplier.id}-${client.id}`}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h5 className="font-black text-slate-950">{client.clientName}</h5>
                          <p className="text-sm text-slate-600">
                            {client.phone} - {client.location} - {link?.assignedMarketer ?? client.assignedMarketer}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button className="secondary-button" onClick={() => onEditClient(isEditing ? "" : client.id)} type="button">Set prices</button>
                          <button className="danger-button" onClick={() => onRemoveLink(supplier.id, client.id)} type="button">Remove</button>
                        </div>
                      </div>
                      {isEditing ? (
                        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={(event) => onSavePricing(event, client, supplier.id)}>
                          <Input defaultValue={link?.assignedMarketer ?? client.assignedMarketer} label="Assigned Marketer" name="assignedMarketer" />
                          {getProducts().map((product) => (
                            <Input
                              defaultValue={String(link?.productPrices[product.itemCode] ?? client.productPrices[product.itemCode] ?? product.pricePerCarton)}
                              key={product.itemCode}
                              label={`${product.name} Price`}
                              name={product.itemCode}
                              type="number"
                            />
                          ))}
                          <button className="primary-button md:col-span-2">Save custom prices</button>
                        </form>
                      ) : null}
                    </div>
                  );
                })}
                {supplierClients.length === 0 ? (
                  <p className="text-sm font-semibold text-slate-500">No active clients linked to this supplier.</p>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof ClipboardList; label: string; value: number }) {
  return (
    <article className="app-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-black text-brand-800">{value}</p>
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
      <Input defaultValue={order.deliveryDate ?? ""} label="Delivery Date" name="deliveryDate" type="date" />
      <Input defaultValue={order.deliveryTruck ?? ""} label="Delivery Truck" name="deliveryTruck" />
      <Input defaultValue={order.deliveryDriver ?? order.deliveryPerson ?? ""} label="Driver / Delivery Person" name="deliveryDriver" />
      <Input defaultValue={order.estimatedArrivalTime ?? ""} label="ETA Start" name="estimatedArrivalTime" type="time" />
      <Input defaultValue={order.estimatedArrivalEndTime ?? ""} label="ETA End" name="estimatedArrivalEndTime" type="time" />
      <Input defaultValue={String(order.driverMinutesAway ?? "")} label="Driver Minutes Away" name="driverMinutesAway" type="number" />
      <button className="secondary-button md:col-span-3">Save delivery notice</button>
    </form>
  );
}

function Input({
  defaultValue,
  label,
  name,
  type = "text"
}: {
  defaultValue?: string;
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

function Select({
  label,
  name,
  options
}: {
  label: string;
  name: string;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-normal text-slate-500">{label}</span>
      <select className="form-input" name={name}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
