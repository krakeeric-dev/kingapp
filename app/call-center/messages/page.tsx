"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, MessageSquare, Search, Send } from "lucide-react";
import { CallCenterShell } from "@/components/CallCenterShell";
import type { SessionUser } from "@/lib/auth";
import {
  getInternalNotifications,
  getMessages,
  markMessageRead,
  sendInternalMessage,
  type InternalMessage,
  type InternalNotification
} from "@/lib/messageService";

export default function CallCenterMessagesPage() {
  return (
    <CallCenterShell title="Messages" subtitle="Internal Notifications & Inbox">
      {(user) => <MessagesContent user={user} />}
    </CallCenterShell>
  );
}

function MessagesContent({ user }: { user: SessionUser }) {
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [notifications, setNotifications] = useState<InternalNotification[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({
    toUser: user.role === "manager" || user.role === "admin" ? "Call Center Agent" : "Manager",
    toRole: user.role === "manager" || user.role === "admin" ? "callcenter" : "manager",
    subject: "",
    body: ""
  });

  useEffect(() => {
    setMessages(getMessages());
    setNotifications(getInternalNotifications());
  }, []);

  const visibleMessages = useMemo(() => {
    const search = query.trim().toLowerCase();
    const scoped = user.role === "callcenter"
      ? messages.filter((message) => message.toUser === user.displayName || message.fromUser === user.displayName || message.toRole === "callcenter")
      : messages;
    return scoped.filter((message) =>
      !search || `${message.subject} ${message.body} ${message.fromUser} ${message.toUser}`.toLowerCase().includes(search)
    );
  }, [messages, query, user]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.subject.trim() || !form.body.trim()) return;
    setMessages(sendInternalMessage(form, user));
    setForm((current) => ({ ...current, subject: "", body: "" }));
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={MessageSquare} label="Messages Today" value={visibleMessages.length.toLocaleString()} />
        <Kpi icon={Bell} label="Unread Messages" value={visibleMessages.filter((message) => message.status !== "read").length.toLocaleString()} />
        <Kpi icon={CheckCheck} label="Delivered" value={visibleMessages.filter((message) => message.status === "delivered").length.toLocaleString()} />
        <Kpi icon={Bell} label="Urgent Alerts" value={notifications.filter((item) => item.priority === "Urgent" || item.priority === "High").length.toLocaleString()} />
      </div>

      <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h3 className="text-lg font-black text-slate-950">Inbox</h3>
            <label className="relative block max-w-sm">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input className="form-input pl-9" onChange={(event) => setQuery(event.target.value)} placeholder="Search messages" value={query} />
            </label>
          </div>
          <div className="grid gap-3">
            {visibleMessages.map((message) => (
              <article className="rounded-lg border border-slate-200 p-4" key={message.id}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h4 className="font-black text-slate-950">{message.subject}</h4>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{message.fromUser} to {message.toUser}</p>
                    <p className="mt-3 text-sm text-slate-700">{message.body}</p>
                    <p className="mt-2 text-xs font-bold text-slate-400">Typing indicator: {message.toUser} is online</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`status-badge ${message.status === "read" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>{message.status}</span>
                    <button className="secondary-button !px-3 !py-2 !text-xs" onClick={() => setMessages(markMessageRead(message.id))} type="button">Mark read</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <form className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" onSubmit={submit}>
          <h3 className="text-lg font-black text-slate-950">New Message</h3>
          <div className="mt-4 grid gap-3">
            <Field label="To User">
              <input className="form-input" onChange={(event) => setForm((current) => ({ ...current, toUser: event.target.value }))} value={form.toUser} />
            </Field>
            <Field label="To Role">
              <select className="form-input" onChange={(event) => setForm((current) => ({ ...current, toRole: event.target.value }))} value={form.toRole}>
                <option value="manager">Manager</option>
                <option value="callcenter">Call Center Agent</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <Field label="Subject">
              <input className="form-input" onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} value={form.subject} />
            </Field>
            <Field label="Message">
              <textarea className="form-input min-h-28" onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} value={form.body} />
            </Field>
            <button className="primary-button"><Send className="h-4 w-4" /> Send Message</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof MessageSquare; label: string; value: string }) {
  return <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-sm font-bold text-slate-500">{label}</p><p className="mt-3 text-3xl font-black text-blue-700">{value}</p></div><div className="rounded-lg bg-blue-50 p-2 text-blue-700"><Icon className="h-5 w-5" /></div></div></article>;
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return <label className="block"><span className="mb-1 block text-xs font-black uppercase text-slate-500">{label}</span>{children}</label>;
}
