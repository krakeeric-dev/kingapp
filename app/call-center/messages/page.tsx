"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  Bell,
  CheckCheck,
  Clock,
  FileText,
  Image,
  MessageSquare,
  Mic,
  Paperclip,
  Pin,
  Search,
  Send,
  UserRound
} from "lucide-react";
import { CallCenterShell } from "@/components/CallCenterShell";
import type { SessionUser } from "@/lib/auth";
import {
  getCallLogs,
  type CallCenterClient
} from "@/lib/call-center-data";
import {
  getCompanyClients,
  getCompanyComplaints,
  getCompanyOrders
} from "@/lib/call-center-operations";
import {
  getClientTimeline,
  getConversationsForUser,
  getMessagesForUser,
  getNotificationsForUser,
  sendConversationMessage,
  type Conversation,
  type InternalMessage,
  type MessageType
} from "@/lib/messageService";
import {
  closeClientMessageThread,
  getClientMessageThreads,
  getMessagesForStaff,
  replyToClientMessage,
  type ClientMessage
} from "@/lib/clientMessageService";

const messageTypes: MessageType[] = ["Text", "Image", "File", "Voice note", "System notification"];

export default function CallCenterMessagesPage() {
  return (
    <CallCenterShell title="Messages" subtitle="Client Conversation Center">
      {(user) => <MessagesContent user={user} />}
    </CallCenterShell>
  );
}

function MessagesContent({ user }: { user: SessionUser }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [clientMessages, setClientMessages] = useState<ClientMessage[]>([]);
  const [replyThreadId, setReplyThreadId] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [query, setQuery] = useState("");
  const [companyQuery, setCompanyQuery] = useState("");
  const [draft, setDraft] = useState({
    attachmentName: "",
    body: "",
    messageType: "Text" as MessageType
  });

  useEffect(() => {
    const loadedConversations = getConversationsForUser(user);
    setConversations(loadedConversations);
    setMessages(getMessagesForUser(user));
    setClientMessages(getMessagesForStaff(user));
    setSelectedId(loadedConversations[0]?.id ?? "");
  }, [user]);

  const filteredConversations = useMemo(() => {
    const userSearch = query.trim().toLowerCase();
    const companySearch = companyQuery.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const userMatch = !userSearch || `${conversation.title} ${conversation.clientName} ${conversation.phone}`.toLowerCase().includes(userSearch);
      const companyMatch = !companySearch || conversation.company.toLowerCase().includes(companySearch);
      return userMatch && companyMatch;
    });
  }, [companyQuery, conversations, query]);

  const selectedConversation = conversations.find((conversation) => conversation.id === selectedId) ?? filteredConversations[0];
  const clients = getCompanyClients(user);
  const selectedClient = findConversationClient(selectedConversation, clients);
  const threadMessages = messages
    .filter((message) => message.conversationId === selectedConversation?.id)
    .sort((first, second) => first.createdAt.localeCompare(second.createdAt));
  const notifications = getNotificationsForUser(user);
  const timeline = selectedClient ? getClientTimeline(selectedClient) : [];
  const orders = selectedClient ? getCompanyOrders(user).filter((order) => order.clientId === selectedClient.id) : [];
  const complaints = selectedClient ? getCompanyComplaints(user).filter((complaint) => complaint.clientId === selectedClient.id) : [];
  const callHistory = selectedClient ? getCallLogs().filter((call) => call.clientId === selectedClient.id) : [];
  const pinnedConversations = filteredConversations.filter((conversation) => conversation.pinned);
  const unreadCount = filteredConversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0);
  const clientThreads = getClientMessageThreads(clientMessages);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedConversation || (!draft.body.trim() && !draft.attachmentName.trim())) return;

    const nextMessages = sendConversationMessage(
      {
        attachmentName: draft.attachmentName || undefined,
        body: draft.body || `${draft.messageType} sent`,
        conversationId: selectedConversation.id,
        messageType: draft.messageType,
        subject: selectedConversation.title,
        toRole: user.role === "callcenter" ? "manager" : "callcenter",
        toUser: selectedConversation.clientName === "Internal" ? "Manager" : selectedConversation.clientName
      },
      user
    );
    setMessages(nextMessages);
    setConversations(getConversationsForUser(user));
    setDraft({ attachmentName: "", body: "", messageType: "Text" });
  }

  function submitClientReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!replyThreadId || !replyBody.trim()) return;
    replyToClientMessage({
      body: replyBody,
      fromName: user.displayName,
      fromRole: user.role === "admin" ? "admin" : user.role === "manager" ? "manager" : "callcenter",
      threadId: replyThreadId
    });
    setClientMessages(getMessagesForStaff(user));
    setReplyBody("");
    setReplyThreadId("");
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Kpi icon={MessageSquare} label="Messages Today" value={messages.length.toLocaleString()} />
        <Kpi icon={Bell} label="Unread Messages" value={unreadCount.toLocaleString()} />
        <Kpi icon={Pin} label="Pinned" value={pinnedConversations.length.toLocaleString()} />
        <Kpi icon={CheckCheck} label="Delivered" value={messages.filter((message) => message.status === "delivered").length.toLocaleString()} />
        <Kpi icon={Clock} label="Active Chats" value={filteredConversations.length.toLocaleString()} />
        <Kpi icon={Bell} label="Urgent Alerts" value={notifications.filter((item) => item.priority === "High" || item.priority === "Urgent").length.toLocaleString()} />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-950">Client Messages</h3>
            <p className="text-sm font-semibold text-slate-500">Messages from client portal, filtered by assigned company.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="status-badge border-blue-200 bg-blue-50 text-blue-700">{clientThreads.filter((item) => item.status === "New").length} New</span>
            <span className="status-badge border-amber-200 bg-amber-50 text-amber-700">{clientThreads.filter((item) => item.status !== "Closed" && item.fromRole === "client").length} Waiting Reply</span>
          </div>
        </div>
        <div className="grid gap-3">
          {clientThreads.map((thread) => (
            <article className="rounded-lg border border-slate-200 p-4" key={thread.threadId}>
              <div className="grid gap-4 xl:grid-cols-[1fr_220px_260px] xl:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{thread.messageType}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{thread.status}</span>
                    {thread.orderId ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{thread.orderId}</span> : null}
                  </div>
                  <h4 className="mt-3 font-black text-slate-950">{thread.clientName}</h4>
                  <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                    <p><span className="font-black text-slate-500">Client:</span> {thread.clientName}</p>
                    <p><span className="font-black text-slate-500">Company:</span> {thread.companyName}</p>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{thread.phone}</p>
                  {thread.orderId ? (
                    <div className="mt-3 rounded-lg border border-brand-100 bg-brand-50 p-3 text-sm">
                      <p className="font-black text-slate-950">Order #{thread.orderId}</p>
                      <p className="font-semibold text-slate-600">Company: {thread.companyName}</p>
                    </div>
                  ) : null}
                  <p className="mt-2 text-sm text-slate-700">{thread.body}</p>
                  <p className="mt-2 text-xs font-bold text-slate-400">{new Date(thread.createdAt).toLocaleString()}</p>
                </div>
                <div className="text-sm">
                  <p><span className="font-black text-slate-500">Supplier:</span> {thread.supplierName ?? "-"}</p>
                  <p><span className="font-black text-slate-500">Read:</span> {thread.readByStaff ? "Read" : "Unread"}</p>
                  <button
                    className="secondary-button mt-3"
                    onClick={() => {
                      closeClientMessageThread(thread.threadId);
                      setClientMessages(getMessagesForStaff(user));
                    }}
                    type="button"
                  >
                    Close
                  </button>
                </div>
                <form className="grid gap-2" onSubmit={submitClientReply}>
                  <textarea
                    className="form-input min-h-20"
                    onChange={(event) => {
                      setReplyThreadId(thread.threadId);
                      setReplyBody(event.target.value);
                    }}
                    placeholder="Reply to client"
                    value={replyThreadId === thread.threadId ? replyBody : ""}
                  />
                  <button className="primary-button"><Send className="h-4 w-4" /> Reply</button>
                </form>
              </div>
            </article>
          ))}
          {!clientThreads.length ? <p className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">No client portal messages for this company.</p> : null}
        </div>
      </section>

      <section className="grid min-h-[760px] gap-5 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
        <aside className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-950">Conversations</h3>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{unreadCount} unread</span>
            </div>
            <label className="relative mt-4 block">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input className="form-input pl-9" onChange={(event) => setQuery(event.target.value)} placeholder="Search users or phone" value={query} />
            </label>
            <label className="relative mt-3 block">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input className="form-input pl-9" onChange={(event) => setCompanyQuery(event.target.value)} placeholder="Search companies" value={companyQuery} />
            </label>
          </div>

          <div className="max-h-[640px] space-y-4 overflow-y-auto p-4">
            <ConversationGroup conversations={pinnedConversations} label="Pinned conversations" onSelect={setSelectedId} selectedId={selectedConversation?.id} />
            <ConversationGroup conversations={filteredConversations} label="Recent conversations" onSelect={setSelectedId} selectedId={selectedConversation?.id} />
          </div>
        </aside>

        <section className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-100 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase text-blue-700">{selectedConversation?.company ?? "Company"}</p>
                <h3 className="text-2xl font-black text-slate-950">{selectedConversation?.title ?? "No conversation selected"}</h3>
                <p className="text-sm font-semibold text-slate-500">{selectedConversation?.phone ?? "Select a thread"} - Online indicator active</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Typing indicator: team online</span>
            </div>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/70 p-5">
            {threadMessages.length ? threadMessages.map((message) => {
              const mine = message.fromUser === user.displayName;
              return (
                <article className={`flex ${mine ? "justify-end" : "justify-start"}`} key={message.id}>
                  <div className={`max-w-2xl rounded-2xl border px-4 py-3 shadow-sm ${mine ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-800"}`}>
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-black">
                      <MessageTypeIcon type={message.messageType ?? "Text"} />
                      <span>{message.messageType ?? "Text"}</span>
                      {message.attachmentName ? <span className={mine ? "text-blue-100" : "text-slate-500"}>{message.attachmentName}</span> : null}
                    </div>
                    <p className="text-sm font-semibold leading-relaxed">{message.body}</p>
                    <p className={`mt-3 text-xs font-bold ${mine ? "text-blue-100" : "text-slate-500"}`}>
                      {message.fromUser} - {message.createdAt.slice(11, 16)} - {message.status === "read" ? "Read" : "Delivered"}
                    </p>
                  </div>
                </article>
              );
            }) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <p className="font-black text-slate-700">No messages yet.</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">Send a text, file, image, voice note, or system notification.</p>
              </div>
            )}
          </div>

          <form className="border-t border-slate-100 p-4" onSubmit={submit}>
            <div className="grid gap-3 lg:grid-cols-[170px_1fr_180px_auto]">
              <select className="form-input" onChange={(event) => setDraft((current) => ({ ...current, messageType: event.target.value as MessageType }))} value={draft.messageType}>
                {messageTypes.map((type) => <option key={type}>{type}</option>)}
              </select>
              <input className="form-input" onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} placeholder="Type message, mention @manager, or reply context" value={draft.body} />
              <input className="form-input" onChange={(event) => setDraft((current) => ({ ...current, attachmentName: event.target.value }))} placeholder="Attachment name" value={draft.attachmentName} />
              <button className="primary-button"><Send className="h-4 w-4" /> Send</button>
            </div>
          </form>
        </section>

        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase text-blue-700">Client Profile</p>
                <h3 className="mt-2 text-xl font-black text-slate-950">{selectedClient?.clientName ?? selectedConversation?.clientName ?? "Internal Team"}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">{selectedClient?.phone ?? selectedConversation?.phone}</p>
              </div>
              <div className="rounded-xl bg-blue-50 p-3 text-blue-700"><UserRound className="h-5 w-5" /></div>
            </div>
            <div className="mt-5 grid gap-3 text-sm">
              <ProfileRow label="Company" value={selectedClient?.companyName ?? selectedConversation?.company ?? "KingApp"} />
              <ProfileRow label="Area" value={selectedClient?.area ?? "Internal"} />
              <ProfileRow label="Owner" value={selectedClient?.ownerName ?? "Team desk"} />
              <ProfileRow label="Balance" value={`${(selectedClient?.currentBalance ?? 0).toLocaleString()} RWF`} />
              <ProfileRow label="Orders" value={orders.length.toLocaleString()} />
              <ProfileRow label="Complaints" value={complaints.length.toLocaleString()} />
              <ProfileRow label="Call history" value={callHistory.length.toLocaleString()} />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-black text-slate-950">Communication Timeline</h3>
            <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto">
              {timeline.slice(0, 8).map((item) => (
                <article className="rounded-lg border border-slate-100 bg-slate-50 p-3" key={item.id}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">{item.type}</span>
                    <span className="text-[11px] font-bold text-slate-400">{item.createdAt.slice(0, 10)}</span>
                  </div>
                  <p className="mt-2 text-sm font-black text-slate-800">{item.title}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{item.detail}</p>
                </article>
              ))}
              {!timeline.length ? <p className="text-sm font-semibold text-slate-500">No client timeline events yet.</p> : null}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}

function ConversationGroup({ conversations, label, onSelect, selectedId }: { conversations: Conversation[]; label: string; onSelect: (id: string) => void; selectedId?: string }) {
  return (
    <div>
      <p className="mb-2 text-xs font-black uppercase text-slate-400">{label}</p>
      <div className="space-y-2">
        {conversations.map((conversation) => (
          <button
            className={`w-full rounded-xl border p-3 text-left transition ${conversation.id === selectedId ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}
            key={`${label}-${conversation.id}`}
            onClick={() => onSelect(conversation.id)}
            type="button"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black text-slate-950">{conversation.title}</p>
                <p className="text-xs font-semibold text-slate-500">{conversation.company}</p>
              </div>
              {conversation.unreadCount ? <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-black text-white">{conversation.unreadCount}</span> : null}
            </div>
            <p className="mt-2 line-clamp-2 text-xs font-semibold text-slate-500">{conversation.lastMessage}</p>
          </button>
        ))}
        {!conversations.length ? <p className="rounded-lg bg-slate-50 p-3 text-xs font-semibold text-slate-500">No conversations found.</p> : null}
      </div>
    </div>
  );
}

function findConversationClient(conversation: Conversation | undefined, clients: CallCenterClient[]) {
  if (!conversation) return undefined;
  return clients.find((client) =>
    client.clientName.toLowerCase() === conversation.clientName.toLowerCase()
    || client.phone === conversation.phone
    || conversation.title.toLowerCase().includes(client.clientName.toLowerCase())
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof MessageSquare; label: string; value: string }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
        </div>
        <div className="rounded-xl bg-blue-50 p-2 text-blue-700"><Icon className="h-5 w-5" /></div>
      </div>
    </article>
  );
}

function MessageTypeIcon({ type }: { type: MessageType }) {
  const icons: Record<MessageType, ReactNode> = {
    File: <FileText className="h-4 w-4" />,
    Image: <Image className="h-4 w-4" />,
    "System notification": <Bell className="h-4 w-4" />,
    Text: <MessageSquare className="h-4 w-4" />,
    "Voice note": <Mic className="h-4 w-4" />
  };
  return <span>{icons[type] ?? <Paperclip className="h-4 w-4" />}</span>;
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
      <span className="font-bold text-slate-500">{label}</span>
      <span className="text-right font-black text-slate-900">{value}</span>
    </div>
  );
}
