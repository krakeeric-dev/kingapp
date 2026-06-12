"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, MessageSquare, Paperclip, Send } from "lucide-react";
import {
  clearPortalSession,
  getClientOrders,
  getPortalClients,
  getPortalSession,
  type PortalClient
} from "@/lib/client-portal-data";
import {
  createClientMessage,
  getClientMessageCompanyDisplay,
  getClientMessageStats,
  getClientMessageThreads,
  getLinkedMessageCompaniesForClient,
  getMessagesForPortalClient,
  type ClientMessage,
  type ClientMessageType
} from "@/lib/clientMessageService";
import { getSession } from "@/lib/storage";

const ADMIN_CLIENT_VIEW_KEY = "kingapp.clientPortal.adminViewClientId";

const messageTypes: ClientMessageType[] = [
  "General message",
  "Order question",
  "Delivery question",
  "Payment question",
  "Complaint",
  "Support request"
];

export default function ClientPortalMessagesPage() {
  const [client, setClient] = useState<PortalClient | null>(null);
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [form, setForm] = useState({
    attachmentName: "",
    body: "",
    messageType: "General message" as ClientMessageType,
    orderId: "",
    subject: ""
  });

  useEffect(() => {
    const appSession = getSession();
    const adminClientId = appSession?.role === "admin"
      ? window.localStorage.getItem(ADMIN_CLIENT_VIEW_KEY) ?? ""
      : "";
    const session = adminClientId
      ? getPortalClients().find((item) => item.id === adminClientId) ?? null
      : getPortalSession();
    setClient(session);
    if (session) {
      const loadedMessages = getMessagesForPortalClient(session);
      const requestedOrderId = new URLSearchParams(window.location.search).get("orderId") ?? "";
      setMessages(loadedMessages);
      setSelectedThreadId(requestedOrderId ? `ORDER-${requestedOrderId}` : getClientMessageThreads(loadedMessages)[0]?.threadId ?? "");
      setSelectedCompanyId(getLinkedMessageCompaniesForClient(session)[0]?.id ?? "");
      setForm((current) => ({
        ...current,
        messageType: requestedOrderId ? "Order question" : current.messageType,
        orderId: requestedOrderId,
        subject: requestedOrderId ? `I want to ask about order ${requestedOrderId}.` : current.subject
      }));
    }
  }, []);

  const orders = useMemo(
    () => (client ? getClientOrders().filter((order) => order.clientId === client.id) : []),
    [client]
  );
  const threads = getClientMessageThreads(messages);
  const selectedThread = messages
    .filter((message) => message.threadId === selectedThreadId)
    .sort((first, second) => first.createdAt.localeCompare(second.createdAt));
  const stats = getClientMessageStats(messages);
  const linkedCompanies = client ? getLinkedMessageCompaniesForClient(client) : [];
  const selectedOrder = orders.find((order) => order.id === form.orderId);
  const selectedCompany =
    selectedOrder
      ? getClientMessageCompanyDisplay(selectedOrder.companyId, selectedOrder.companyName)
      : linkedCompanies.find((company) => company.id === selectedCompanyId) ?? linkedCompanies[0];
  const selectedSupplierId =
    selectedOrder?.supplierId ??
    linkedCompanies.find((company) => company.id === selectedCompany?.id)?.supplierId;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || !form.body.trim()) return;
    const next = createClientMessage({
      attachmentName: form.attachmentName || undefined,
      body: form.body,
      client,
      messageType: form.messageType,
      orderId: form.orderId || undefined,
      subject: form.subject || undefined,
      supplierId: orders.find((order) => order.id === form.orderId)?.supplierId
        ?? selectedSupplierId
    });
    const clientMessages = next.filter((message) => message.clientId === client.id);
    setMessages(clientMessages);
    const threadId = form.orderId ? `ORDER-${form.orderId}` : clientMessages[0]?.threadId ?? "";
    setSelectedThreadId(threadId);
    setForm((current) => ({ ...current, attachmentName: "", body: "", subject: "" }));
  }

  if (!client) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <section className="mx-auto max-w-md rounded-lg border border-brand-100 bg-white p-6 text-center shadow-executive">
          <MessageSquare className="mx-auto h-10 w-10 text-brand-700" />
          <h1 className="mt-4 text-2xl font-black text-slate-950">Client Messages</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">Open a client view before reading messages.</p>
          <Link className="primary-button mt-5 w-full" href="/client-portal">Open Client Portal</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="app-card-soft p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase text-brand-700">Client Portal</p>
              <h1 className="mt-1 text-3xl font-black text-slate-950">Messages</h1>
              <p className="mt-2 text-sm font-semibold text-slate-500">{client.clientName} - {client.phone}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link className="secondary-button" href="/client-portal"><ArrowLeft className="h-4 w-4" /> Portal</Link>
              <button
                className="secondary-button"
                onClick={() => {
                  if (getSession()?.role === "admin") {
                    window.localStorage.removeItem(ADMIN_CLIENT_VIEW_KEY);
                  } else {
                    clearPortalSession();
                  }
                  window.location.href = "/client-portal";
                }}
                type="button"
              >
                Logout
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className={`flex h-14 w-14 items-center justify-center rounded-xl border text-lg font-black ${selectedCompany?.badgeClass ?? "border-blue-200 bg-blue-50 text-blue-700"}`}>
                {selectedCompany?.logo ?? "KA"}
              </div>
              <div>
                <p className="text-xs font-black uppercase text-slate-400">Company</p>
                <h2 className="text-2xl font-black uppercase text-slate-950">{selectedCompany?.name ?? "Company"}</h2>
                <p className="text-sm font-bold text-slate-500">{selectedCompany?.supportTeam ?? "Customer Support"}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {selectedCompany?.supportStatus ?? "Online"}
            </span>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="New Messages" value={stats.newMessages} />
          <Kpi label="Unread Messages" value={messages.filter((message) => !message.readByClient).length} />
          <Kpi label="Waiting Reply" value={stats.waitingReply} />
          <Kpi label="Open Support" value={stats.openSupportRequests} />
        </div>

        <section className="grid min-h-[700px] gap-5 xl:grid-cols-[320px_1fr_360px]">
          <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Conversations</h2>
            <div className="mt-4 space-y-2">
              {threads.map((thread) => (
                <button
                  className={`w-full rounded-lg border p-3 text-left ${thread.threadId === selectedThreadId ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-white"}`}
                  key={thread.threadId}
                  onClick={() => setSelectedThreadId(thread.threadId)}
                  type="button"
                >
                  <p className="font-black text-slate-950">{thread.subject}</p>
                  <span className={`mt-2 inline-flex rounded-full border px-2 py-1 text-[11px] font-black ${getClientMessageCompanyDisplay(thread.companyId, thread.companyName).badgeClass}`}>
                    {thread.companyName}
                  </span>
                  <p className="mt-2 text-xs font-semibold text-slate-500">{thread.messageType} - {thread.status}</p>
                  <p className="mt-2 line-clamp-2 text-xs text-slate-500">{thread.body}</p>
                </button>
              ))}
              {!threads.length ? <p className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-500">No messages yet.</p> : null}
            </div>
          </aside>

          <section className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-100 p-5">
              <h2 className="text-xl font-black text-slate-950">Message Thread</h2>
              <p className="text-sm font-semibold text-slate-500">Supplier and call center replies appear here.</p>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/70 p-5">
              {selectedThread.map((message) => {
                const mine = message.fromRole === "client";
                return (
                  <article className={`flex ${mine ? "justify-end" : "justify-start"}`} key={message.id}>
                    <div className={`max-w-2xl rounded-2xl px-4 py-3 shadow-sm ${mine ? "bg-brand-700 text-white" : "border border-slate-200 bg-white text-slate-800"}`}>
                      <p className="text-xs font-black uppercase opacity-80">{message.fromName} - {message.messageType}</p>
                      <p className="mt-2 text-sm font-semibold">{message.body}</p>
                      {message.attachmentName ? <p className="mt-2 text-xs font-black">Attachment: {message.attachmentName}</p> : null}
                      <p className="mt-3 text-xs font-bold opacity-75">{new Date(message.createdAt).toLocaleString()} - {message.status}</p>
                    </div>
                  </article>
                );
              })}
              {!selectedThread.length ? <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center font-bold text-slate-500">Select a thread or send a new message.</p> : null}
            </div>
          </section>

          <form className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" onSubmit={submit}>
            <h2 className="text-lg font-black text-slate-950">Send Message</h2>
            <div className="mt-4 grid gap-3">
              <Field label="Message Company">
                {linkedCompanies.length > 1 && !form.orderId ? (
                  <select className="form-input" onChange={(event) => setSelectedCompanyId(event.target.value)} value={selectedCompanyId}>
                    {linkedCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                  </select>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-black text-slate-900">
                    {selectedCompany?.name ?? "No linked company"}
                  </div>
                )}
              </Field>
              <Field label="Sending Message To">
                <div className={`rounded-lg border px-3 py-3 text-sm font-black ${selectedCompany?.badgeClass ?? "border-blue-200 bg-blue-50 text-blue-700"}`}>
                  {selectedCompany?.name ?? "Company"}
                </div>
              </Field>
              <Field label="Message Type">
                <select className="form-input" onChange={(event) => setForm((current) => ({ ...current, messageType: event.target.value as ClientMessageType }))} value={form.messageType}>
                  {messageTypes.map((type) => <option key={type}>{type}</option>)}
                </select>
              </Field>
              <Field label="Related Order">
                <select className="form-input" onChange={(event) => setForm((current) => ({ ...current, orderId: event.target.value }))} value={form.orderId}>
                  <option value="">No order selected</option>
                  {orders.map((order) => <option key={order.id} value={order.id}>{order.id} - {order.status}</option>)}
                </select>
              </Field>
              {form.orderId ? (
                <div className="rounded-lg border border-brand-100 bg-brand-50 p-3">
                  <p className="text-sm font-black text-slate-950">Order #{form.orderId}</p>
                  <p className="text-sm font-semibold text-slate-600">Company: {selectedCompany?.name ?? "Company"}</p>
                </div>
              ) : null}
              <Field label="Subject">
                <input className="form-input" onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} placeholder={form.orderId ? `I want to ask about order ${form.orderId}.` : "Message subject"} value={form.subject} />
              </Field>
              <Field label="Message">
                <textarea className="form-input min-h-32" onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} value={form.body} />
              </Field>
              <Field label="Attach file">
                <div className="relative">
                  <Paperclip className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input className="form-input pl-9" onChange={(event) => setForm((current) => ({ ...current, attachmentName: event.target.value }))} placeholder="receipt.jpg, invoice.pdf" value={form.attachmentName} />
                </div>
              </Field>
              <button className="primary-button"><Send className="h-4 w-4" /> Send Message</button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <article className="app-card p-5">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-black text-brand-800">{value}</p>
    </article>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return <label className="block"><span className="mb-1 block text-xs font-black uppercase text-slate-500">{label}</span>{children}</label>;
}
