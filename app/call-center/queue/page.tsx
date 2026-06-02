"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Clock,
  Headphones,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  Timer,
  UserCheck,
  UsersRound
} from "lucide-react";
import { ClientAutoPopup } from "@/components/ClientAutoPopup";
import { CallCenterShell } from "@/components/CallCenterShell";
import type { SessionUser } from "@/lib/auth";
import { formatMoney } from "@/lib/sales-data";
import {
  acceptQueueCall,
  addActiveCallNote,
  addCallback,
  addComplaint,
  addPaymentFollowUp,
  closeActiveCall,
  getAgents,
  getAverageWaitSeconds,
  getCallCenterClients,
  getCallDuration,
  getCallbacks,
  getMissedCalls,
  getQueueCalls,
  markCallMissed,
  sendCallToQueue,
  transferCall,
  type CallCenterAgent,
  type CallCenterClient,
  type QueueCall
} from "@/lib/call-center-data";
import { createOneClickOrder } from "@/lib/call-center-operations";
import { sendWhatsAppNotification } from "@/lib/notificationService";
import { getProducts, type ProductMaster } from "@/lib/products-data";

const today = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);
const secondsLabel = (seconds: number) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

export default function CallQueuePage() {
  return (
    <CallCenterShell title="Incoming Calls" subtitle="Queue Control Desk">
      {(user) => <QueueContent user={user} />}
    </CallCenterShell>
  );
}

function QueueContent({ user }: { user: SessionUser }) {
  const [calls, setCalls] = useState<QueueCall[]>([]);
  const [agents, setAgents] = useState<CallCenterAgent[]>([]);
  const [clients, setClients] = useState<CallCenterClient[]>([]);
  const [missedCalls, setMissedCalls] = useState(getSafeEmptyArray<ReturnType<typeof getMissedCalls>[number]>());
  const [callbacks, setCallbacks] = useState(getSafeEmptyArray<ReturnType<typeof getCallbacks>[number]>());
  const [products, setProducts] = useState<ProductMaster[]>([]);
  const [selectedCallId, setSelectedCallId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    const loadedCalls = getQueueCalls();
    setCalls(loadedCalls);
    setAgents(getAgents());
    setClients(getCallCenterClients());
    setMissedCalls(getMissedCalls());
    setCallbacks(getCallbacks());
    setProducts(getProducts());
    setSelectedCallId((current) => current || loadedCalls.find((call) => call.status === "Active")?.id || "");
  }

  const incoming = calls.filter((call) => call.status === "Incoming");
  const waiting = calls.filter((call) => call.status === "Waiting");
  const active = calls.filter((call) => call.status === "Active" || call.status === "Transferred");
  const missed = missedCalls;
  const availableAgents = agents.filter((agent) => agent.status === "Available");
  const selectedCall = calls.find((call) => call.id === selectedCallId) ?? active[0];
  const selectedClient = clients.find((client) => client.id === selectedCall?.clientId);

  const metrics = useMemo(
    () => ({
      waiting: waiting.length,
      active: active.length,
      available: availableAgents.length,
      missedToday: missed.filter((call) => call.date === today()).length,
      callbacksToday: callbacks.filter((callback) => callback.callbackDate === today() && callback.status === "Pending").length,
      avgWait: secondsLabel(getAverageWaitSeconds(calls))
    }),
    [active.length, availableAgents.length, callbacks, calls, missed, waiting.length]
  );

  function acceptCall(call: QueueCall) {
    const agent = availableAgents[0] ?? agents.find((item) => item.name === user.displayName);
    if (!agent && user.role !== "admin" && user.role !== "manager") {
      setMessage("No available agent can receive this call.");
      return;
    }
    const agentName = agent?.name ?? user.displayName;
    setCalls(acceptQueueCall(call.id, agentName));
    setSelectedCallId(call.id);
    setMessage(`${call.clientName} accepted by ${agentName}.`);
    setAgents(getAgents());
  }

  function queueCall(call: QueueCall) {
    setCalls(sendCallToQueue(call.id));
    setMessage("Call sent to waiting queue.");
  }

  function missCall(call: QueueCall) {
    setCalls(markCallMissed(call.id, "Rejected or missed by call center"));
    setMissedCalls(getMissedCalls());
    setMessage("Call moved to missed calls.");
  }

  function closeCall(call: QueueCall) {
    setCalls(closeActiveCall(call.id, call.assignedAgent ?? user.displayName));
    setMessage("Call closed and added to call history.");
    setAgents(getAgents());
  }

  function handleTransfer(call: QueueCall, team: QueueCall["transferTo"]) {
    if (!team) return;
    setCalls(transferCall(call.id, team, user.displayName));
    setMessage(`Call transferred to ${team}.`);
  }

  return (
    <div className="space-y-6">
      <section className="app-card-soft p-5 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Headphones className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-950">Call Queue Command Center</h2>
              <p className="mt-1 text-sm text-slate-600">
                Mock queue control for future 3CX, Twilio, Asterisk, IP phone, and office phone integration.
              </p>
            </div>
          </div>
        </div>
      </section>

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </div>
      ) : null}

      {incoming[0] ? (
        <ClientAutoPopup
          call={incoming[0]}
          client={clients.find((client) => client.id === incoming[0].clientId)}
          onAccept={() => acceptCall(incoming[0])}
          onQueue={() => queueCall(incoming[0])}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Kpi icon={Clock} label="Calls Waiting" value={metrics.waiting} />
        <Kpi icon={PhoneCall} label="Active Calls" value={metrics.active} />
        <Kpi icon={UserCheck} label="Available Agents" value={metrics.available} />
        <Kpi icon={PhoneOff} label="Missed Today" value={metrics.missedToday} />
        <Kpi icon={Timer} label="Callbacks Due" value={metrics.callbacksToday} />
        <Kpi icon={UsersRound} label="Average Wait" value={metrics.avgWait} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <QueueSection title="Incoming Calls" calls={incoming} empty="No incoming calls." onAccept={acceptCall} onMissed={missCall} onQueue={queueCall} />
          <QueueSection title="Waiting Queue" calls={waiting} empty="No callers waiting." onAccept={acceptCall} onMissed={missCall} />
          <QueueSection title="Active Calls" calls={active} empty="No active calls." onSelect={(call) => setSelectedCallId(call.id)} />
          <QueueSection title="Missed Calls" calls={calls.filter((call) => call.status === "Missed")} empty="No missed queue calls." />
          <CallbackPreview callbacks={callbacks} />
        </div>

        {selectedCall && selectedClient ? (
          <ActiveCallPanel
            call={selectedCall}
            client={selectedClient}
            onClose={closeCall}
            onMessage={setMessage}
            onRefresh={refresh}
            onTransfer={handleTransfer}
            products={products}
            user={user}
          />
        ) : (
          <Panel title="Active Call Screen">
            <p className="text-sm font-semibold text-slate-500">Accept or select an active call to open the client profile.</p>
          </Panel>
        )}
      </div>
    </div>
  );
}

function IncomingPopup({
  call,
  onAccept,
  onMissed,
  onQueue
}: {
  call: QueueCall;
  onAccept: (call: QueueCall) => void;
  onMissed: (call: QueueCall) => void;
  onQueue: (call: QueueCall) => void;
}) {
  return (
    <section className="rounded-lg border border-brand-200 bg-white p-5 shadow-executive">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <PhoneIncoming className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-normal text-brand-700">Incoming Call</p>
            <h3 className="mt-1 text-2xl font-black text-slate-950">{call.clientName}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-600">{call.phone} - {call.location}</p>
            <p className="mt-2 text-sm text-slate-600">
              Balance: <span className="font-black text-slate-950">{formatMoney(call.currentBalance)} RWF</span> - Last order: {call.lastOrder}
            </p>
            <p className="text-sm text-slate-600">Assigned marketer: {call.assignedMarketer}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="primary-button" onClick={() => onAccept(call)} type="button">Accept Call</button>
          <button className="secondary-button" onClick={() => onQueue(call)} type="button">Send to Queue</button>
          <button className="danger-button" onClick={() => onMissed(call)} type="button">Reject / Missed</button>
        </div>
      </div>
    </section>
  );
}

function ActiveCallPanel({
  call,
  client,
  onClose,
  onMessage,
  onRefresh,
  onTransfer,
  products,
  user
}: {
  call: QueueCall;
  client: CallCenterClient;
  onClose: (call: QueueCall) => void;
  onMessage: (message: string) => void;
  onRefresh: () => void;
  onTransfer: (call: QueueCall, team: QueueCall["transferTo"]) => void;
  products: ProductMaster[];
  user: SessionUser;
}) {
  const [note, setNote] = useState("");
  const [orderOpen, setOrderOpen] = useState(false);

  function saveOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const quantity = Number(form.get("quantity"));
    const product = String(form.get("product") ?? "");
    if (!product || !Number.isFinite(quantity) || quantity <= 0) return;
    const result = createOneClickOrder(
      client,
      {
        productName: product,
        quantity,
        deliveryDate: String(form.get("deliveryDate") ?? today()),
        notes: String(form.get("notes") ?? "")
      },
      user
    );
    sendWhatsAppNotification("Order Received", {
      clientName: client.clientName,
      phone: client.phone,
      orderNumber: result.portalOrder.id
    });
    onMessage("Order created for Client Orders and Storekeeper Loading Queue.");
    setOrderOpen(false);
    event.currentTarget.reset();
  }

  function saveComplaint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    addComplaint(client, {
      complaintType: String(form.get("complaintType") ?? "damaged stock"),
      product: String(form.get("product") ?? ""),
      quantity: Number(form.get("quantity")) || 0,
      description: String(form.get("description") ?? ""),
      priority: String(form.get("priority") ?? "Medium"),
      status: "Open"
    }, user);
    onMessage("Complaint logged.");
    event.currentTarget.reset();
  }

  function savePromise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    addPaymentFollowUp(client, {
      amountDue: Number(form.get("amountDue")) || client.currentBalance,
      daysOutstanding: Number(form.get("daysOutstanding")) || 0,
      promiseToPayDate: String(form.get("promiseToPayDate") ?? today()),
      comment: String(form.get("comment") ?? ""),
      status: "Open"
    }, user);
    onMessage("Payment promise logged.");
    event.currentTarget.reset();
  }

  function scheduleCallback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    addCallback({
      clientId: client.id,
      clientName: client.clientName,
      phone: client.phone,
      callbackDate: String(form.get("callbackDate") ?? today()),
      callbackTime: String(form.get("callbackTime") ?? nowTime()),
      reason: String(form.get("reason") ?? ""),
      assignedAgent: String(form.get("assignedAgent") ?? user.displayName),
      priority: String(form.get("priority") ?? "Medium") as "Low" | "Medium" | "High" | "Urgent",
      status: "Pending"
    });
    onMessage("Callback scheduled.");
    event.currentTarget.reset();
    onRefresh();
  }

  function saveNote() {
    if (!note.trim()) return;
    addActiveCallNote(call.id, note.trim());
    onMessage("Call note added.");
    setNote("");
    onRefresh();
  }

  return (
    <Panel title="Active Call Screen">
      <div className="rounded-lg border border-brand-100 bg-brand-50 p-4">
        <p className="text-xs font-black uppercase tracking-normal text-brand-700">Active Call</p>
        <h3 className="mt-1 text-2xl font-black text-slate-950">{client.clientName}</h3>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <Info label="Phone" value={client.phone} />
          <Info label="Location" value={client.area} />
          <Info label="Agent" value={call.assignedAgent ?? "Unassigned"} />
          <Info label="Timer" value={getCallDuration(call.acceptedAt ?? call.startedAt)} />
          <Info label="Reason" value={call.callReason} />
          <Info label="Balance" value={`${formatMoney(client.currentBalance)} RWF`} />
          <Info label="Last Order" value={`${client.lastOrderQuantity} cartons on ${client.lastOrderDate}`} />
          <Info label="Marketer" value={client.assignedMarketer} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="primary-button" onClick={() => setOrderOpen(true)} type="button">Create Order</button>
        {["Supervisor", "Accountant", "Storekeeper", "Manager"].map((team) => (
          <button className="secondary-button" key={team} onClick={() => onTransfer(call, team as QueueCall["transferTo"])} type="button">
            <ArrowRightLeft className="h-4 w-4" />
            Transfer to {team}
          </button>
        ))}
        <button className="danger-button" onClick={() => onClose(call)} type="button">End Call</button>
      </div>

      <div className="mt-4 grid gap-4">
        {orderOpen ? (
          <QuickOrderModal
            client={client}
            onClose={() => setOrderOpen(false)}
            onSubmit={saveOrder}
            products={products}
          />
        ) : null}

        <MiniForm title="Log Payment Promise" onSubmit={savePromise}>
          <Input defaultValue={String(client.currentBalance)} name="amountDue" type="number" />
          <Input name="daysOutstanding" placeholder="Days outstanding" type="number" />
          <Input defaultValue={today()} name="promiseToPayDate" type="date" />
          <Input name="comment" placeholder="Comment" />
        </MiniForm>

        <MiniForm title="Log Complaint" onSubmit={saveComplaint}>
          <Select name="complaintType">
            {["damaged stock", "wrong delivery", "short delivery", "delayed truck", "payment dispute"].map((item) => <option key={item}>{item}</option>)}
          </Select>
          <Input name="product" placeholder="Product" />
          <Input name="quantity" placeholder="Quantity" type="number" />
          <Select name="priority">
            {["Low", "Medium", "High", "Urgent"].map((item) => <option key={item}>{item}</option>)}
          </Select>
          <Input name="description" placeholder="Description" />
        </MiniForm>

        <MiniForm title="Schedule Follow-Up" onSubmit={scheduleCallback}>
          <Input defaultValue={today()} name="callbackDate" type="date" />
          <Input defaultValue={nowTime()} name="callbackTime" type="time" />
          <Input name="reason" placeholder="Reason" />
          <Input defaultValue={user.displayName} name="assignedAgent" />
          <Select name="priority">
            {["Low", "Medium", "High", "Urgent"].map((item) => <option key={item}>{item}</option>)}
          </Select>
        </MiniForm>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h4 className="font-black text-slate-950">Add Call Note</h4>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input className="form-input" onChange={(event) => setNote(event.target.value)} placeholder="Type call note" value={note} />
            <button className="primary-button" onClick={saveNote} type="button">Save Note</button>
          </div>
          <div className="mt-3 grid gap-2">
            {[...call.notes, ...client.notes].slice(0, 6).map((item) => (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600" key={item}>{item}</p>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function QueueSection({
  calls,
  empty,
  onAccept,
  onMissed,
  onQueue,
  onSelect,
  title
}: {
  calls: QueueCall[];
  empty: string;
  onAccept?: (call: QueueCall) => void;
  onMissed?: (call: QueueCall) => void;
  onQueue?: (call: QueueCall) => void;
  onSelect?: (call: QueueCall) => void;
  title: string;
}) {
  return (
    <Panel title={title}>
      <div className="grid gap-3">
        {calls.map((call) => (
          <article className="rounded-lg border border-slate-200 bg-white p-4" key={call.id}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h4 className="font-black text-slate-950">{call.clientName}</h4>
                <p className="text-sm font-semibold text-slate-500">{call.phone} - {call.location} - {call.callReason}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">Waiting {secondsLabel(Math.floor((Date.now() - new Date(call.startedAt).getTime()) / 1000))}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {onAccept ? <button className="primary-button" onClick={() => onAccept(call)} type="button">Accept</button> : null}
                {onQueue ? <button className="secondary-button" onClick={() => onQueue(call)} type="button">Queue</button> : null}
                {onMissed ? <button className="danger-button" onClick={() => onMissed(call)} type="button">Missed</button> : null}
                {onSelect ? <button className="secondary-button" onClick={() => onSelect(call)} type="button">Open</button> : null}
              </div>
            </div>
          </article>
        ))}
        {calls.length === 0 ? <p className="text-sm font-semibold text-slate-500">{empty}</p> : null}
      </div>
    </Panel>
  );
}

function QuickOrderModal({
  client,
  onClose,
  onSubmit,
  products
}: {
  client: CallCenterClient;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  products: ProductMaster[];
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <form className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl" onSubmit={onSubmit}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase text-blue-700">One Click Order</p>
            <h3 className="mt-1 text-2xl font-black text-slate-950">{client.clientName}</h3>
            <p className="text-sm font-semibold text-slate-500">{client.phone} - {client.area}</p>
          </div>
          <button className="secondary-button" onClick={onClose} type="button">Close</button>
        </div>
        <div className="mt-5 grid gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase text-slate-500">Product</span>
            <select className="form-input" name="product" required>
              <option value="">Select product</option>
              {products.map((product) => <option key={product.itemCode}>{product.name}</option>)}
            </select>
          </label>
          <Input name="quantity" placeholder="Quantity" type="number" />
          <Input defaultValue={today()} name="deliveryDate" type="date" />
          <Input name="notes" placeholder="Notes" />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="secondary-button" onClick={onClose} type="button">Cancel</button>
          <button className="primary-button">Submit Order</button>
        </div>
      </form>
    </div>
  );
}

function CallbackPreview({ callbacks }: { callbacks: ReturnType<typeof getCallbacks> }) {
  const pendingCallbacks = callbacks.filter((callback) => callback.status === "Pending");
  return (
    <Panel title="Callback List">
      <div className="grid gap-2">
        {pendingCallbacks.slice(0, 5).map((callback) => (
          <div className="rounded-lg border border-slate-100 px-3 py-2 text-sm" key={callback.id}>
            <span className="font-black">{callback.callbackDate} {callback.callbackTime}</span> - {callback.clientName}: {callback.reason}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function getSafeEmptyArray<T>() {
  return [] as T[];
}

function Kpi({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: number | string }) {
  return (
    <article className="app-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-normal text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black text-brand-800">{value}</p>
        </div>
        <div className="rounded-lg bg-brand-50 p-2 text-brand-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  );
}

function Panel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="app-card p-5">
      <h3 className="mb-4 text-lg font-black text-slate-950">{title}</h3>
      {children}
    </section>
  );
}

function MiniForm({ children, onSubmit, title }: { children: ReactNode; onSubmit: (event: FormEvent<HTMLFormElement>) => void; title: string }) {
  return (
    <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-2" onSubmit={onSubmit}>
      <h4 className="font-black text-slate-950 md:col-span-2">{title}</h4>
      {children}
      <button className="primary-button md:col-span-2">Save</button>
    </form>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2">
      <p className="text-xs font-bold uppercase tracking-normal text-slate-500">{label}</p>
      <p className="mt-1 font-black text-slate-950">{value}</p>
    </div>
  );
}

function Input({ defaultValue, name, placeholder, type = "text" }: { defaultValue?: string; name: string; placeholder?: string; type?: string }) {
  return <input className="form-input" defaultValue={defaultValue} min={type === "number" ? "0" : undefined} name={name} placeholder={placeholder} type={type} />;
}

function Select({ children, name }: { children: ReactNode; name: string }) {
  return <select className="form-input" name={name}>{children}</select>;
}
