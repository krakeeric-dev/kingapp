"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AtSign,
  Edit3,
  MessageCircle,
  Paperclip,
  Pin,
  Reply,
  Search,
  Send,
  Trash2,
  Users
} from "lucide-react";
import { CallCenterShell } from "@/components/CallCenterShell";
import type { SessionUser } from "@/lib/auth";
import {
  chatChannels,
  deleteChatMessage,
  editChatMessage,
  getChatMessages,
  pinChatMessage,
  sendChatMessage,
  type ChatMessage
} from "@/lib/chatService";

export default function CallCenterChatPage() {
  return (
    <CallCenterShell title="Agent Chat" subtitle="Company Channels & Team Messaging">
      {(user) => <ChatContent user={user} />}
    </CallCenterShell>
  );
}

function ChatContent({ user }: { user: SessionUser }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedChannel, setSelectedChannel] = useState("call-center");
  const [query, setQuery] = useState("");
  const [replyToId, setReplyToId] = useState<string | undefined>();
  const [draft, setDraft] = useState({
    attachmentName: "",
    body: "",
    mention: ""
  });

  useEffect(() => {
    setMessages(getChatMessages());
  }, []);

  const selected = chatChannels.find((channel) => channel.id === selectedChannel) ?? chatChannels[0];
  const channelMessages = useMemo(() => {
    const search = query.trim().toLowerCase();
    return messages
      .filter((message) => message.channelId === selectedChannel)
      .filter((message) => !search || `${message.body} ${message.author} ${message.mention ?? ""}`.toLowerCase().includes(search))
      .sort((first, second) => first.createdAt.localeCompare(second.createdAt));
  }, [messages, query, selectedChannel]);

  const pinnedMessages = channelMessages.filter((message) => message.pinned && !message.deleted);
  const replyTarget = messages.find((message) => message.id === replyToId);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.body.trim() && !draft.attachmentName.trim()) return;
    setMessages(sendChatMessage({
      attachmentName: draft.attachmentName || undefined,
      body: draft.body,
      channelId: selectedChannel,
      mention: draft.mention || undefined,
      replyToId
    }, user));
    setDraft({ attachmentName: "", body: "", mention: "" });
    setReplyToId(undefined);
  }

  function editMessage(message: ChatMessage) {
    const nextBody = window.prompt("Edit message", message.body);
    if (!nextBody?.trim()) return;
    setMessages(editChatMessage(message.id, nextBody));
  }

  return (
    <div className="grid min-h-[760px] gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h3 className="text-lg font-black text-slate-950">Channels</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">Internal and multi-company rooms</p>
        </div>
        <div className="max-h-[690px] overflow-y-auto p-4">
          <ChannelGroup label="Company Operations" selectedChannel={selectedChannel} setSelectedChannel={setSelectedChannel} ids={["management", "dispatch", "loading", "storekeepers", "accounting", "call-center"]} />
          <ChannelGroup label="Multi-company Channels" selectedChannel={selectedChannel} setSelectedChannel={setSelectedChannel} ids={["agahozo-water", "teju-juice", "king-honey", "king-eggs"]} />
        </div>
      </aside>

      <section className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-100 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-blue-50 p-3 text-blue-700"><MessageCircle className="h-5 w-5" /></div>
              <div>
                <h3 className="text-2xl font-black text-slate-950">{selected.name}</h3>
                <p className="text-sm font-semibold text-slate-500">
                  <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  {selected.onlineCount} online - Typing indicator active
                </p>
              </div>
            </div>
            <label className="relative block w-full max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input className="form-input pl-9" onChange={(event) => setQuery(event.target.value)} placeholder="Search messages" value={query} />
            </label>
          </div>
        </header>

        {pinnedMessages.length ? (
          <div className="border-b border-amber-100 bg-amber-50 px-5 py-3">
            <p className="mb-2 text-xs font-black uppercase text-amber-700">Pinned messages</p>
            <div className="flex flex-wrap gap-2">
              {pinnedMessages.map((message) => (
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700 shadow-sm" key={message.id}>
                  {message.body}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/70 p-5">
          {channelMessages.map((message) => {
            const mine = message.author === user.displayName;
            const replied = message.replyToId ? messages.find((item) => item.id === message.replyToId) : undefined;
            return (
              <article className={`flex ${mine ? "justify-end" : "justify-start"}`} key={message.id}>
                <div className={`max-w-2xl rounded-2xl border px-4 py-3 shadow-sm ${mine ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-800"}`}>
                  {replied ? (
                    <div className={`mb-3 rounded-lg px-3 py-2 text-xs font-semibold ${mine ? "bg-blue-500 text-blue-50" : "bg-slate-100 text-slate-500"}`}>
                      Replying to {replied.author}: {replied.body}
                    </div>
                  ) : null}
                  <p className="text-xs font-black uppercase opacity-80">{message.author} {message.mention ? `- ${message.mention}` : ""}</p>
                  <p className="mt-2 text-sm font-semibold leading-relaxed">{message.body}</p>
                  {message.attachmentName ? <p className={`mt-2 text-xs font-black ${mine ? "text-blue-100" : "text-blue-700"}`}>Attachment: {message.attachmentName}</p> : null}
                  <div className={`mt-3 flex flex-wrap items-center gap-2 text-xs font-bold ${mine ? "text-blue-100" : "text-slate-500"}`}>
                    <span>{message.createdAt.slice(11, 16)}{message.edited ? " - edited" : ""}</span>
                    <button onClick={() => setReplyToId(message.id)} type="button"><Reply className="h-4 w-4" /></button>
                    <button onClick={() => setMessages(pinChatMessage(message.id))} type="button"><Pin className="h-4 w-4" /></button>
                    <button onClick={() => editMessage(message)} type="button"><Edit3 className="h-4 w-4" /></button>
                    <button onClick={() => setMessages(deleteChatMessage(message.id))} type="button"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <form className="border-t border-slate-100 p-4" onSubmit={submit}>
          {replyTarget ? (
            <div className="mb-3 flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700">
              Replying to {replyTarget.author}: {replyTarget.body}
              <button onClick={() => setReplyToId(undefined)} type="button">Clear</button>
            </div>
          ) : null}
          <div className="grid gap-3 lg:grid-cols-[150px_1fr_190px_auto]">
            <label className="relative block">
              <AtSign className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input className="form-input pl-9" onChange={(event) => setDraft((current) => ({ ...current, mention: event.target.value }))} placeholder="@mention" value={draft.mention} />
            </label>
            <input className="form-input" onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} placeholder={`Message ${selected.name}`} value={draft.body} />
            <label className="relative block">
              <Paperclip className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input className="form-input pl-9" onChange={(event) => setDraft((current) => ({ ...current, attachmentName: event.target.value }))} placeholder="Attach file" value={draft.attachmentName} />
            </label>
            <button className="primary-button"><Send className="h-4 w-4" /> Send</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ChannelGroup({ ids, label, selectedChannel, setSelectedChannel }: { ids: string[]; label: string; selectedChannel: string; setSelectedChannel: (id: string) => void }) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-xs font-black uppercase text-slate-400">{label}</p>
      <div className="space-y-2">
        {ids.map((id) => {
          const channel = chatChannels.find((item) => item.id === id);
          if (!channel) return null;
          return (
            <button
              className={`w-full rounded-xl border p-3 text-left transition ${selectedChannel === channel.id ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}
              key={channel.id}
              onClick={() => setSelectedChannel(channel.id)}
              type="button"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-black text-slate-950">{channel.name}</span>
                <span className="flex items-center gap-1 text-xs font-black text-emerald-600"><Users className="h-3 w-3" /> {channel.onlineCount}</span>
              </div>
              <p className="mt-1 text-xs font-semibold text-slate-500">{channel.companyName ?? "KingApp internal team"}</p>
              {channel.unreadCount ? <p className="mt-2 text-xs font-black text-blue-700">{channel.unreadCount} unread</p> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
