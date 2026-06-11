import type { SessionUser } from "@/lib/auth";
import { canAccessCompany, getCompanies, getCompanyWorkspaceId } from "@/lib/companies-data";

export type ChatMessage = {
  id: string;
  channelId: string;
  author: string;
  authorRole: string;
  body: string;
  replyToId?: string;
  mention?: string;
  attachmentName?: string;
  pinned: boolean;
  edited: boolean;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ChatChannel = {
  id: string;
  name: string;
  companyId?: string;
  companyName?: string;
  onlineCount: number;
  unreadCount: number;
};

const CHAT_KEY = "kingapp.callCenter.chatMessages";

export const chatChannels: ChatChannel[] = [
  { id: "management", name: "#management", onlineCount: 0, unreadCount: 0 },
  { id: "dispatch", name: "#dispatch", onlineCount: 0, unreadCount: 0 },
  { id: "loading", name: "#loading", onlineCount: 0, unreadCount: 0 },
  { id: "storekeepers", name: "#storekeepers", onlineCount: 0, unreadCount: 0 },
  { id: "accounting", name: "#accounting", onlineCount: 0, unreadCount: 0 },
  { id: "call-center", name: "#call-center", onlineCount: 0, unreadCount: 0 }
];

function getChatChannels() {
  const companyChannels = getCompanies().map((company) => ({
    id: company.id,
    name: `#${company.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    companyId: company.id,
    companyName: company.name,
    onlineCount: 0,
    unreadCount: 0
  }));
  return [...chatChannels, ...companyChannels];
}

const _seedMessages: ChatMessage[] = [];

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    window.localStorage.removeItem(key);
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function withoutSeedRecords<T extends { id: string }>(key: string, records: T[], seedIds: string[]) {
  const seedSet = new Set(seedIds);
  const filtered = records.filter((record) => !seedSet.has(record.id));
  if (filtered.length !== records.length) writeJson(key, filtered);
  return filtered;
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

export function getChatMessages() {
  const messages = readJson<ChatMessage[]>(CHAT_KEY, []);
  return withoutSeedRecords(CHAT_KEY, messages, _seedMessages.map((message) => message.id));
}

export function getChatChannelsForUser(user: SessionUser) {
  const workspaceId = getCompanyWorkspaceId(user);
  return getChatChannels().filter((channel) => {
    if (!channel.companyId) return true;
    if (workspaceId !== "all") return channel.companyId === workspaceId;
    return canAccessCompany(user, channel.companyId);
  });
}

export function getChatMessagesForUser(user: SessionUser) {
  const allowedChannels = new Set(getChatChannelsForUser(user).map((channel) => channel.id));
  return getChatMessages().filter((message) => allowedChannels.has(message.channelId));
}

export function sendChatMessage(input: Pick<ChatMessage, "attachmentName" | "body" | "channelId" | "mention" | "replyToId">, user: SessionUser) {
  const now = new Date().toISOString();
  const message: ChatMessage = {
    ...input,
    id: makeId("CHAT"),
    author: user.displayName,
    authorRole: user.role,
    pinned: false,
    edited: false,
    deleted: false,
    createdAt: now,
    updatedAt: now
  };
  const messages = [message, ...getChatMessages()];
  writeJson(CHAT_KEY, messages);
  return messages;
}

export function editChatMessage(messageId: string, body: string) {
  const messages = getChatMessages().map((message) =>
    message.id === messageId ? { ...message, body, edited: true, updatedAt: new Date().toISOString() } : message
  );
  writeJson(CHAT_KEY, messages);
  return messages;
}

export function deleteChatMessage(messageId: string) {
  const messages = getChatMessages().map((message) =>
    message.id === messageId ? { ...message, deleted: true, body: "Message deleted", updatedAt: new Date().toISOString() } : message
  );
  writeJson(CHAT_KEY, messages);
  return messages;
}

export function pinChatMessage(messageId: string) {
  const messages = getChatMessages().map((message) =>
    message.id === messageId ? { ...message, pinned: !message.pinned } : message
  );
  writeJson(CHAT_KEY, messages);
  return messages;
}
