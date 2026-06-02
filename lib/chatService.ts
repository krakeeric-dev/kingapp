import type { SessionUser } from "@/lib/auth";

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
  companyName?: string;
  onlineCount: number;
  unreadCount: number;
};

const CHAT_KEY = "kingapp.callCenter.chatMessages";

export const chatChannels: ChatChannel[] = [
  { id: "management", name: "#management", onlineCount: 5, unreadCount: 2 },
  { id: "dispatch", name: "#dispatch", onlineCount: 4, unreadCount: 1 },
  { id: "loading", name: "#loading", onlineCount: 6, unreadCount: 0 },
  { id: "storekeepers", name: "#storekeepers", onlineCount: 3, unreadCount: 1 },
  { id: "accounting", name: "#accounting", onlineCount: 2, unreadCount: 0 },
  { id: "call-center", name: "#call-center", onlineCount: 8, unreadCount: 4 },
  { id: "agahozo-water", name: "#agahozo-water", companyName: "Agahozo Water", onlineCount: 7, unreadCount: 3 },
  { id: "teju-juice", name: "#teju-juice", companyName: "Teju Juice", onlineCount: 4, unreadCount: 1 },
  { id: "king-honey", name: "#king-honey", companyName: "King Honey", onlineCount: 3, unreadCount: 0 },
  { id: "king-eggs", name: "#king-eggs", companyName: "King Eggs", onlineCount: 3, unreadCount: 2 }
];

const seedMessages: ChatMessage[] = [
  {
    id: "CHAT-001",
    channelId: "call-center",
    author: "Manager",
    authorRole: "manager",
    body: "@team prioritize unpaid balance calls before lunch.",
    mention: "@team",
    pinned: true,
    edited: false,
    deleted: false,
    createdAt: "2026-06-02T08:50:00.000Z",
    updatedAt: "2026-06-02T08:50:00.000Z"
  },
  {
    id: "CHAT-002",
    channelId: "dispatch",
    author: "Alice Agent",
    authorRole: "callcenter",
    body: "Kigali Mart requested delivery confirmation.",
    pinned: false,
    edited: false,
    deleted: false,
    createdAt: "2026-06-02T09:05:00.000Z",
    updatedAt: "2026-06-02T09:05:00.000Z"
  }
];

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

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

export function getChatMessages() {
  const messages = readJson<ChatMessage[]>(CHAT_KEY, seedMessages);
  writeJson(CHAT_KEY, messages);
  return messages;
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
