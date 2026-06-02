"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { MessageCircle, Search, Send } from "lucide-react";
import { CallCenterShell } from "@/components/CallCenterShell";
import type { SessionUser } from "@/lib/auth";
import { getMessages, sendInternalMessage, type InternalMessage } from "@/lib/messageService";

export default function CallCenterChatPage() {
  return (
    <CallCenterShell title="Agent Chat" subtitle="Agent, Manager & Team Conversation">
      {(user) => <ChatContent user={user} />}
    </CallCenterShell>
  );
}

function ChatContent({ user }: { user: SessionUser }) {
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const recipient = user.role === "callcenter" ? "Manager" : "Call Center Agent";

  useEffect(() => {
    setMessages(getMessages());
  }, []);

  const visibleMessages = useMemo(() => {
    const search = query.trim().toLowerCase();
    return messages
      .filter((message) => user.role !== "callcenter" || message.fromUser === user.displayName || message.toUser === user.displayName || message.toRole === "callcenter")
      .filter((message) => !search || `${message.subject} ${message.body} ${message.fromUser} ${message.toUser}`.toLowerCase().includes(search))
      .sort((first, second) => first.createdAt.localeCompare(second.createdAt));
  }, [messages, query, user]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim()) return;
    setMessages(sendInternalMessage({
      toUser: recipient,
      toRole: user.role === "callcenter" ? "manager" : "callcenter",
      subject: "Live chat",
      body: draft
    }, user));
    setDraft("");
  }

  return (
    <div className="grid min-h-[720px] gap-5 xl:grid-cols-[320px_1fr]">
      <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-black text-slate-950">Conversations</h3>
        <label className="relative mt-4 block">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input className="form-input pl-9" onChange={(event) => setQuery(event.target.value)} placeholder="Search chat" value={query} />
        </label>
        <div className="mt-5 grid gap-2">
          {["Manager", "Call Center Agent", "Supervisor Desk", "Delivery Desk"].map((name) => (
            <button className={`rounded-lg px-3 py-3 text-left text-sm font-black ${name === recipient ? "bg-blue-50 text-blue-700" : "bg-slate-50 text-slate-700"}`} key={name} type="button">
              {name}
              <span className="mt-1 block text-xs font-semibold text-slate-500">Delivered and read receipts enabled</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-700"><MessageCircle className="h-5 w-5" /></div>
            <div>
              <h3 className="font-black text-slate-950">{recipient}</h3>
              <p className="text-xs font-bold text-emerald-600">Typing indicator: online</p>
            </div>
          </div>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {visibleMessages.map((message) => {
            const mine = message.fromUser === user.displayName;
            return (
              <div className={`flex ${mine ? "justify-end" : "justify-start"}`} key={message.id}>
                <article className={`max-w-xl rounded-2xl px-4 py-3 ${mine ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-800"}`}>
                  <p className="text-sm font-bold">{message.body}</p>
                  <p className={`mt-2 text-xs font-semibold ${mine ? "text-blue-100" : "text-slate-500"}`}>
                    {message.fromUser} - {message.status === "read" ? "Read" : "Delivered"}
                  </p>
                </article>
              </div>
            );
          })}
        </div>
        <form className="border-t border-slate-100 p-4" onSubmit={submit}>
          <div className="flex gap-2">
            <input className="form-input" onChange={(event) => setDraft(event.target.value)} placeholder="Type a message" value={draft} />
            <button className="primary-button"><Send className="h-4 w-4" /> Send</button>
          </div>
        </form>
      </section>
    </div>
  );
}
