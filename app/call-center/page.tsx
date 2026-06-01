"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  ClipboardList,
  Headphones,
  MessageSquareWarning,
  PhoneCall,
  PhoneMissed,
  Search,
  ShoppingCart,
  UserCheck,
  WalletCards
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { SessionUser } from "@/lib/auth";
import { formatMoney } from "@/lib/sales-data";
import {
  addCallLog,
  addComplaint,
  addPaymentFollowUp,
  addPendingOrder,
  addScheduledFollowUp,
  getCallCenterClients,
  getCallLogs,
  getComplaints,
  getPaymentFollowUps,
  getPendingOrders,
  getScheduledFollowUps,
  saveClientNotes,
  type CallCenterClient,
  type CallLog,
  type CallType,
  type ComplaintRecord,
  type PaymentFollowUp,
  type PendingOrder,
  type ScheduledFollowUp
} from "@/lib/call-center-data";
import { getProducts, type ProductMaster } from "@/lib/products-data";

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const nowTime = () => new Date().toTimeString().slice(0, 5);

export default function CallCenterPage() {
  return (
    <AppShell allowedRoles={["admin", "callcenter"]}>
      {(user) => <CallCenterContent user={user} />}
    </AppShell>
  );
}

function CallCenterContent({ user }: { user: SessionUser }) {
  const [clients, setClients] = useState<CallCenterClient[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [payments, setPayments] = useState<PaymentFollowUp[]>([]);
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [followUps, setFollowUps] = useState<ScheduledFollowUp[]>([]);
  const [products, setProducts] = useState<ProductMaster[]>([]);
  const [query, setQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [message, setMessage] = useState("");

  const [callForm, setCallForm] = useState({
    callType: "Customer Care" as CallType,
    duration: "",
    outcome: "Open",
    nextAction: ""
  });
  const [orderForm, setOrderForm] = useState({
    product: "",
    quantity: "",
    deliveryDate: today(),
    notes: ""
  });
  const [paymentForm, setPaymentForm] = useState({
    amountDue: "",
    daysOutstanding: "",
    promiseToPayDate: today(),
    comment: "",
    status: "Open"
  });
  const [complaintForm, setComplaintForm] = useState({
    complaintType: "damaged stock",
    product: "",
    quantity: "",
    description: "",
    priority: "Medium",
    status: "Open"
  });
  const [followUpForm, setFollowUpForm] = useState({
    date: today(),
    time: nowTime(),
    reason: "",
    assignedAgent: user.displayName
  });
  const [noteDraft, setNoteDraft] = useState("");

  useEffect(() => {
    const loadedClients = getCallCenterClients();
    setClients(loadedClients);
    setSelectedClientId(loadedClients[0]?.id ?? "");
    setCallLogs(getCallLogs());
    setOrders(getPendingOrders());
    setPayments(getPaymentFollowUps());
    setComplaints(getComplaints());
    setFollowUps(getScheduledFollowUps());
    setProducts(getProducts());
  }, []);

  const selectedClient = clients.find((client) => client.id === selectedClientId);
  const filteredClients = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (!search) {
      return clients;
    }

    return clients.filter((client) =>
      `${client.clientName} ${client.ownerName} ${client.phone} ${client.area}`
        .toLowerCase()
        .includes(search)
    );
  }, [clients, query]);

  const dashboard = useMemo(() => {
    const todaysCalls = callLogs.filter((record) => record.date === today());

    return {
      callsToday: todaysCalls.length,
      ordersToday: orders.filter((record) => record.createdAt.slice(0, 10) === today()).length,
      followUpsPending: followUps.filter((record) => record.status === "Scheduled").length,
      complaintsOpen: complaints.filter((record) => record.status !== "Closed").length,
      paymentFollowUps: payments.filter((record) => record.status !== "Closed").length,
      newClientsContacted: todaysCalls.filter((record) => record.callType === "New Client Prospect").length
    };
  }, [callLogs, complaints, followUps, orders, payments]);

  function requireClient() {
    if (!selectedClient) {
      setMessage("Select a client first.");
      return null;
    }

    return selectedClient;
  }

  function handleCallSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = requireClient();

    if (!client) return;

    setCallLogs(
      addCallLog(
        {
          date: today(),
          time: nowTime(),
          clientId: client.id,
          clientName: client.clientName,
          phone: client.phone,
          callType: callForm.callType,
          duration: callForm.duration || "0 min",
          outcome: callForm.outcome as CallLog["outcome"],
          nextAction: callForm.nextAction
        },
        user
      )
    );
    setCallForm({ callType: "Customer Care", duration: "", outcome: "Open", nextAction: "" });
    setMessage("Call logged.");
  }

  function handleOrderSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = requireClient();
    const quantity = Number(orderForm.quantity);

    if (!client || !orderForm.product || !Number.isFinite(quantity) || quantity <= 0) return;

    setOrders(addPendingOrder(client, { ...orderForm, quantity }, user));
    setOrderForm({ product: "", quantity: "", deliveryDate: today(), notes: "" });
    setMessage("Order sent to Pending Orders for Storekeeper.");
  }

  function handlePaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = requireClient();

    if (!client) return;

    setPayments(
      addPaymentFollowUp(
        client,
        {
          amountDue: Number(paymentForm.amountDue) || 0,
          daysOutstanding: Number(paymentForm.daysOutstanding) || 0,
          promiseToPayDate: paymentForm.promiseToPayDate,
          comment: paymentForm.comment,
          status: paymentForm.status
        },
        user
      )
    );
    setPaymentForm({ amountDue: "", daysOutstanding: "", promiseToPayDate: today(), comment: "", status: "Open" });
    setMessage("Payment follow-up saved for Accountant.");
  }

  function handleComplaintSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = requireClient();

    if (!client) return;

    setComplaints(
      addComplaint(
        client,
        {
          complaintType: complaintForm.complaintType,
          product: complaintForm.product,
          quantity: Number(complaintForm.quantity) || 0,
          description: complaintForm.description,
          priority: complaintForm.priority,
          status: complaintForm.status
        },
        user
      )
    );
    setComplaintForm({ complaintType: "damaged stock", product: "", quantity: "", description: "", priority: "Medium", status: "Open" });
    setMessage("Complaint logged for Supervisor/Admin.");
  }

  function handleFollowUpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = requireClient();

    if (!client) return;

    setFollowUps(addScheduledFollowUp(client, followUpForm));
    setFollowUpForm({ date: today(), time: nowTime(), reason: "", assignedAgent: user.displayName });
    setMessage("Follow-up scheduled.");
  }

  function handleAddNote() {
    const client = requireClient();

    if (!client || !noteDraft.trim()) return;

    const updatedClients = saveClientNotes(client.id, [noteDraft.trim(), ...client.notes]);
    setClients(updatedClients);
    setNoteDraft("");
    setMessage("Client note saved.");
  }

  return (
    <div className="space-y-6">
      <section className="app-card-soft p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <PhoneCall className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-950">Call Center</h2>
            <p className="mt-1 text-sm text-slate-600">
              Search clients, book orders, log calls, complaints, payments, and follow-ups inside KingApp.
            </p>
          </div>
        </div>
      </section>

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Kpi icon={PhoneCall} label="Total Calls Today" value={dashboard.callsToday} />
        <Kpi icon={ShoppingCart} label="Orders Booked Today" value={dashboard.ordersToday} />
        <Kpi icon={CalendarClock} label="Follow-ups Pending" value={dashboard.followUpsPending} />
        <Kpi icon={MessageSquareWarning} label="Complaints Open" value={dashboard.complaintsOpen} />
        <Kpi icon={WalletCards} label="Payment Follow-ups" value={dashboard.paymentFollowUps} />
        <Kpi icon={ClipboardList} label="New Clients Contacted" value={dashboard.newClientsContacted} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <ModuleLink href="/call-center/queue" icon={Headphones} title="Call Queue" text="Incoming, waiting, active, missed, and callbacks." />
        <ModuleLink href="/call-center/agents" icon={UserCheck} title="Agents" text="Control available, ringing, on-call, away, and offline states." />
        <ModuleLink href="/call-center/missed-calls" icon={PhoneMissed} title="Missed Calls" text="Call back missed callers and update outcomes." />
        <ModuleLink href="/call-center/callbacks" icon={CalendarClock} title="Callbacks" text="Prioritize follow-ups and track completion." />
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <section className="app-card p-4">
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-black text-slate-900">
              <Search className="h-4 w-4 text-brand-700" />
              Client Search
            </span>
            <input
              className="form-input"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, phone, location"
              value={query}
            />
          </label>
          <div className="mt-4 grid gap-2">
            {filteredClients.map((client) => (
              <button
                className={`rounded-lg border px-3 py-3 text-left text-sm ${
                  client.id === selectedClientId
                    ? "border-brand-300 bg-brand-50 text-brand-950"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
                key={client.id}
                onClick={() => setSelectedClientId(client.id)}
                type="button"
              >
                <span className="block font-black">{client.clientName}</span>
                <span className="mt-1 block font-semibold">{client.phone} - {client.area}</span>
              </button>
            ))}
          </div>
        </section>

        {selectedClient ? (
          <section className="space-y-4">
            <ClientProfile client={selectedClient} />
            <Panel title="Client Call History">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Agent</th>
                      <th>Call Type</th>
                      <th>Duration</th>
                      <th>Outcome</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {callLogs.filter((record) => record.clientId === selectedClient.id).map((record) => (
                      <tr key={record.id}>
                        <td>{record.date}</td>
                        <td>{record.time}</td>
                        <td>{record.agent}</td>
                        <td>{record.callType}</td>
                        <td>{record.duration}</td>
                        <td>{record.outcome}</td>
                        <td>{record.nextAction}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {callLogs.filter((record) => record.clientId === selectedClient.id).length === 0 ? (
                <p className="mt-3 text-sm font-semibold text-slate-500">No previous call history for this client.</p>
              ) : null}
            </Panel>
            <div className="grid gap-4 xl:grid-cols-2">
              <Panel title="+ New Order">
                <form className="grid gap-3" onSubmit={handleOrderSubmit}>
                  <Select label="Product" value={orderForm.product} onChange={(value) => setOrderForm((current) => ({ ...current, product: value }))}>
                    <option value="">Select product</option>
                    {products.map((product) => <option key={product.itemCode}>{product.name}</option>)}
                  </Select>
                  <Input label="Quantity" type="number" value={orderForm.quantity} onChange={(value) => setOrderForm((current) => ({ ...current, quantity: value }))} />
                  <Input label="Delivery Date" type="date" value={orderForm.deliveryDate} onChange={(value) => setOrderForm((current) => ({ ...current, deliveryDate: value }))} />
                  <Input label="Notes" value={orderForm.notes} onChange={(value) => setOrderForm((current) => ({ ...current, notes: value }))} />
                  <button className="primary-button">Save order</button>
                </form>
              </Panel>

              <Panel title="Schedule Follow-Up">
                <form className="grid gap-3" onSubmit={handleFollowUpSubmit}>
                  <Input label="Date" type="date" value={followUpForm.date} onChange={(value) => setFollowUpForm((current) => ({ ...current, date: value }))} />
                  <Input label="Time" type="time" value={followUpForm.time} onChange={(value) => setFollowUpForm((current) => ({ ...current, time: value }))} />
                  <Input label="Reason" value={followUpForm.reason} onChange={(value) => setFollowUpForm((current) => ({ ...current, reason: value }))} />
                  <Input label="Assigned Agent" value={followUpForm.assignedAgent} onChange={(value) => setFollowUpForm((current) => ({ ...current, assignedAgent: value }))} />
                  <button className="primary-button">Schedule</button>
                </form>
              </Panel>

              <Panel title="Payment Follow-Up">
                <form className="grid gap-3" onSubmit={handlePaymentSubmit}>
                  <Input label="Amount Due" type="number" value={paymentForm.amountDue} onChange={(value) => setPaymentForm((current) => ({ ...current, amountDue: value }))} />
                  <Input label="Days Outstanding" type="number" value={paymentForm.daysOutstanding} onChange={(value) => setPaymentForm((current) => ({ ...current, daysOutstanding: value }))} />
                  <Input label="Promise To Pay Date" type="date" value={paymentForm.promiseToPayDate} onChange={(value) => setPaymentForm((current) => ({ ...current, promiseToPayDate: value }))} />
                  <Input label="Comment" value={paymentForm.comment} onChange={(value) => setPaymentForm((current) => ({ ...current, comment: value }))} />
                  <Input label="Status" value={paymentForm.status} onChange={(value) => setPaymentForm((current) => ({ ...current, status: value }))} />
                  <button className="primary-button">Save payment follow-up</button>
                </form>
              </Panel>

              <Panel title="Complaint Logging">
                <form className="grid gap-3" onSubmit={handleComplaintSubmit}>
                  <Select label="Complaint Type" value={complaintForm.complaintType} onChange={(value) => setComplaintForm((current) => ({ ...current, complaintType: value }))}>
                    {["damaged stock", "wrong delivery", "short delivery", "delayed truck", "payment dispute"].map((item) => <option key={item}>{item}</option>)}
                  </Select>
                  <Input label="Product" value={complaintForm.product} onChange={(value) => setComplaintForm((current) => ({ ...current, product: value }))} />
                  <Input label="Quantity" type="number" value={complaintForm.quantity} onChange={(value) => setComplaintForm((current) => ({ ...current, quantity: value }))} />
                  <Input label="Description" value={complaintForm.description} onChange={(value) => setComplaintForm((current) => ({ ...current, description: value }))} />
                  <Select label="Priority" value={complaintForm.priority} onChange={(value) => setComplaintForm((current) => ({ ...current, priority: value }))}>
                    {["Low", "Medium", "High", "Urgent"].map((item) => <option key={item}>{item}</option>)}
                  </Select>
                  <Input label="Status" value={complaintForm.status} onChange={(value) => setComplaintForm((current) => ({ ...current, status: value }))} />
                  <button className="primary-button">Log complaint</button>
                </form>
              </Panel>
            </div>

            <Panel title="Call Notes">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input className="form-input" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Add client note" />
                <button className="primary-button" onClick={handleAddNote} type="button">Save note</button>
              </div>
              <div className="mt-3 grid gap-2">
                {selectedClient.notes.map((note) => (
                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700" key={note}>{note}</div>
                ))}
              </div>
            </Panel>
          </section>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Log Call">
          <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCallSubmit}>
            <Select label="Call Type" value={callForm.callType} onChange={(value) => setCallForm((current) => ({ ...current, callType: value as CallType }))}>
              {["New Order", "Reorder", "Complaint", "Payment Follow-up", "Customer Care", "New Client Prospect"].map((item) => <option key={item}>{item}</option>)}
            </Select>
            <Input label="Duration" value={callForm.duration} onChange={(value) => setCallForm((current) => ({ ...current, duration: value }))} placeholder="4 min" />
            <Select label="Outcome" value={callForm.outcome} onChange={(value) => setCallForm((current) => ({ ...current, outcome: value }))}>
              {["Open", "Closed", "Pending Callback", "Scheduled"].map((item) => <option key={item}>{item}</option>)}
            </Select>
            <Input label="Next Action" value={callForm.nextAction} onChange={(value) => setCallForm((current) => ({ ...current, nextAction: value }))} />
            <button className="primary-button md:col-span-2">Save call log</button>
          </form>
        </Panel>

        <Panel title="Today's Follow-ups">
          <div className="grid gap-2">
            {followUps.filter((record) => record.date === today()).map((record) => (
              <div className="rounded-lg border border-slate-100 px-3 py-2 text-sm" key={record.id}>
                <span className="font-black">{record.time}</span> - {record.clientName}: {record.reason}
              </div>
            ))}
            {followUps.filter((record) => record.date === today()).length === 0 ? (
              <p className="text-sm font-semibold text-slate-500">No follow-ups scheduled for today.</p>
            ) : null}
          </div>
        </Panel>
      </div>

      <Panel title="Call Log Table">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Client</th>
                <th>Phone</th>
                <th>Call Type</th>
                <th>Duration</th>
                <th>Outcome</th>
                <th>Next Action</th>
                <th>Agent</th>
              </tr>
            </thead>
            <tbody>
              {callLogs.map((record) => (
                <tr key={record.id}>
                  <td>{record.date}</td>
                  <td>{record.time}</td>
                  <td className="font-bold text-slate-950">{record.clientName}</td>
                  <td>{record.phone}</td>
                  <td>{record.callType}</td>
                  <td>{record.duration}</td>
                  <td>{record.outcome}</td>
                  <td>{record.nextAction}</td>
                  <td>{record.agent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function ClientProfile({ client }: { client: CallCenterClient }) {
  return (
    <section className="app-card p-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ProfileItem label="Client Name" value={client.clientName} />
        <ProfileItem label="Owner Name" value={client.ownerName} />
        <ProfileItem label="Phone" value={client.phone} />
        <ProfileItem label="Area" value={client.area} />
        <ProfileItem label="Assigned Marketer" value={client.assignedMarketer} />
        <ProfileItem label="Current Balance" value={`${formatMoney(client.currentBalance)} RWF`} />
        <ProfileItem label="Last Order Date" value={client.lastOrderDate} />
        <ProfileItem label="Last Order Quantity" value={client.lastOrderQuantity.toLocaleString()} />
        <ProfileItem label="Last Payment Date" value={client.lastPaymentDate} />
      </div>
    </section>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof PhoneCall; label: string; value: number }) {
  return (
    <article className="app-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-normal text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-brand-800">{value}</p>
        </div>
        <div className="rounded-lg bg-brand-50 p-2 text-brand-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  );
}

function ModuleLink({
  href,
  icon: Icon,
  text,
  title
}: {
  href: string;
  icon: typeof PhoneCall;
  text: string;
  title: string;
}) {
  return (
    <Link className="app-card p-4 transition hover:border-brand-200 hover:bg-brand-50" href={href}>
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-brand-50 p-2 text-brand-700">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-black text-slate-950">{title}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">{text}</p>
        </div>
      </div>
    </Link>
  );
}

function Panel({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="app-card p-5">
      <h3 className="mb-4 text-lg font-black text-slate-950">{title}</h3>
      {children}
    </section>
  );
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-xs font-bold uppercase tracking-normal text-slate-500">{label}</p>
      <p className="mt-1 font-black text-slate-950">{value}</p>
    </div>
  );
}

function Input({
  label,
  onChange,
  placeholder,
  type = "text",
  value
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-normal text-slate-500">{label}</span>
      <input className="form-input" min={type === "number" ? "0" : undefined} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} value={value} />
    </label>
  );
}

function Select({
  children,
  label,
  onChange,
  value
}: {
  children: React.ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-normal text-slate-500">{label}</span>
      <select className="form-input" onChange={(event) => onChange(event.target.value)} value={value}>
        {children}
      </select>
    </label>
  );
}
