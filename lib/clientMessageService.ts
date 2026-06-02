import type { SessionUser } from "@/lib/auth";
import { canAccessCompany, getCompanyWorkspaceId } from "@/lib/companies-data";
import {
  getClientOrders,
  getClientsForSupplier,
  getPortalClients,
  getSupplierClientLinks,
  getSuppliers,
  type ClientPortalOrder,
  type PortalClient,
  type PortalSupplier
} from "@/lib/client-portal-data";
import { createInternalNotification } from "@/lib/messageService";

export type ClientMessageType =
  | "General message"
  | "Order question"
  | "Delivery question"
  | "Payment question"
  | "Complaint"
  | "Support request";

export type ClientMessageStatus = "New" | "Read" | "Replied" | "Closed";

export type ClientMessage = {
  id: string;
  threadId: string;
  companyId: string;
  companyName: string;
  supplierId?: string;
  supplierName?: string;
  clientId: string;
  clientName: string;
  phone: string;
  messageType: ClientMessageType;
  orderId?: string;
  subject: string;
  body: string;
  attachmentName?: string;
  fromRole: "client" | "supplier" | "callcenter" | "manager" | "admin";
  fromName: string;
  status: ClientMessageStatus;
  readByClient: boolean;
  readByStaff: boolean;
  createdAt: string;
};

const CLIENT_MESSAGES_KEY = "kingapp.clientPortal.messages";

const companyBySupplierId: Record<string, { id: string; name: string }> = {
  "SUP-001": { id: "COMP-AGAHOZO", name: "Agahozo Water" },
  "SUP-002": { id: "COMP-TEJU", name: "Teju Juice" }
};

const clientCompanyFallback: Record<string, { id: string; name: string }> = {
  "PORTAL-CL-001": { id: "COMP-AGAHOZO", name: "Agahozo Water" },
  "PORTAL-CL-002": { id: "COMP-TEJU", name: "Teju Juice" }
};

const seedMessages: ClientMessage[] = [
  {
    id: "CLMSG-001",
    threadId: "CLTH-001",
    companyId: "COMP-AGAHOZO",
    companyName: "Agahozo Water",
    supplierId: "SUP-001",
    supplierName: "KingApp Beverage Pro",
    clientId: "PORTAL-CL-001",
    clientName: "Kigali Mart",
    phone: "0788000001",
    messageType: "Delivery question",
    orderId: "CPO-DEMO-001",
    subject: "Delivery time confirmation",
    body: "Please confirm if today's delivery will arrive before 3 PM.",
    fromRole: "client",
    fromName: "Kigali Mart",
    status: "New",
    readByClient: true,
    readByStaff: false,
    createdAt: "2026-06-02T09:25:00.000Z"
  },
  {
    id: "CLMSG-002",
    threadId: "CLTH-002",
    companyId: "COMP-TEJU",
    companyName: "Teju Juice",
    supplierId: "SUP-002",
    supplierName: "Premium Water Depot",
    clientId: "PORTAL-CL-002",
    clientName: "Sunrise Shop",
    phone: "0788000002",
    messageType: "Payment question",
    subject: "Balance statement",
    body: "Can you send my current balance before I pay?",
    fromRole: "client",
    fromName: "Sunrise Shop",
    status: "New",
    readByClient: true,
    readByStaff: false,
    createdAt: "2026-06-02T10:05:00.000Z"
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

export function getCompanyForClientMessage(client: PortalClient, supplierId?: string) {
  if (supplierId && companyBySupplierId[supplierId]) return companyBySupplierId[supplierId];
  return clientCompanyFallback[client.id] ?? { id: "COMP-AGAHOZO", name: "Agahozo Water" };
}

export function getClientMessages() {
  const messages = readJson<ClientMessage[]>(CLIENT_MESSAGES_KEY, seedMessages);
  writeJson(CLIENT_MESSAGES_KEY, messages);
  return messages;
}

export function saveClientMessages(messages: ClientMessage[]) {
  writeJson(CLIENT_MESSAGES_KEY, messages);
  return messages;
}

export function getClientMessageThreads(messages = getClientMessages()) {
  const latestByThread = new Map<string, ClientMessage>();
  messages.forEach((message) => {
    const current = latestByThread.get(message.threadId);
    if (!current || message.createdAt > current.createdAt) {
      latestByThread.set(message.threadId, message);
    }
  });
  return Array.from(latestByThread.values()).sort((first, second) => second.createdAt.localeCompare(first.createdAt));
}

export function getMessagesForPortalClient(client: PortalClient) {
  return getClientMessages().filter((message) => message.clientId === client.id);
}

export function getMessagesForSupplier(supplier: PortalSupplier) {
  const clientIds = new Set(getClientsForSupplier(supplier.id).map((client) => client.id));
  return getClientMessages().filter((message) => message.supplierId === supplier.id || clientIds.has(message.clientId));
}

export function getMessagesForStaff(user: SessionUser) {
  const workspaceId = getCompanyWorkspaceId(user);
  return getClientMessages().filter((message) => {
    if (user.role === "supplier") return false;
    if (workspaceId !== "all") return message.companyId === workspaceId;
    return canAccessCompany(user, message.companyId);
  });
}

export function createClientMessage(input: {
  attachmentName?: string;
  body: string;
  client: PortalClient;
  messageType: ClientMessageType;
  orderId?: string;
  supplierId?: string;
  subject?: string;
}) {
  const supplier = input.supplierId ? getSuppliers().find((item) => item.id === input.supplierId) : undefined;
  const company = getCompanyForClientMessage(input.client, input.supplierId);
  const order = input.orderId ? getClientOrders().find((item) => item.id === input.orderId) : undefined;
  const message: ClientMessage = {
    id: makeId("CLMSG"),
    threadId: input.orderId ? `ORDER-${input.orderId}` : makeId("CLTH"),
    companyId: order?.companyId ?? company.id,
    companyName: order?.companyName ?? company.name,
    supplierId: input.supplierId ?? order?.supplierId,
    supplierName: supplier?.name ?? order?.supplier,
    clientId: input.client.id,
    clientName: input.client.clientName,
    phone: input.client.phone,
    messageType: input.messageType,
    orderId: input.orderId,
    subject: input.subject || (input.orderId ? `Question about order ${input.orderId}` : input.messageType),
    body: input.body,
    attachmentName: input.attachmentName,
    fromRole: "client",
    fromName: input.client.clientName,
    status: "New",
    readByClient: true,
    readByStaff: false,
    createdAt: new Date().toISOString()
  };
  const messages = saveClientMessages([message, ...getClientMessages()]);
  createInternalNotification({
    type: "message",
    title: `New client message: ${message.clientName}`,
    body: message.subject,
    priority: message.messageType === "Complaint" ? "High" : "Medium"
  });
  return messages;
}

export function replyToClientMessage(input: {
  attachmentName?: string;
  body: string;
  fromName: string;
  fromRole: ClientMessage["fromRole"];
  threadId: string;
}) {
  const thread = getClientMessages().find((message) => message.threadId === input.threadId);
  if (!thread) return getClientMessages();
  const message: ClientMessage = {
    ...thread,
    id: makeId("CLMSG"),
    attachmentName: input.attachmentName,
    body: input.body,
    createdAt: new Date().toISOString(),
    fromName: input.fromName,
    fromRole: input.fromRole,
    readByClient: false,
    readByStaff: true,
    status: "Replied"
  };
  const messages = getClientMessages().map((item) =>
    item.threadId === input.threadId ? { ...item, status: "Replied" as const, readByStaff: true } : item
  );
  return saveClientMessages([message, ...messages]);
}

export function closeClientMessageThread(threadId: string) {
  return saveClientMessages(
    getClientMessages().map((message) =>
      message.threadId === threadId ? { ...message, status: "Closed" as const, readByStaff: true } : message
    )
  );
}

export function getClientMessageStats(messages: ClientMessage[]) {
  const threads = getClientMessageThreads(messages);
  return {
    newMessages: messages.filter((message) => message.status === "New").length,
    unreadMessages: messages.filter((message) => !message.readByClient || !message.readByStaff).length,
    waitingReply: threads.filter((message) => message.fromRole === "client" && message.status !== "Closed").length,
    openSupportRequests: threads.filter((message) => message.status !== "Closed").length,
    lastReply: messages.find((message) => message.fromRole !== "client")?.createdAt ?? ""
  };
}

export function getOrderThreadId(order: Pick<ClientPortalOrder, "id">) {
  return `ORDER-${order.id}`;
}
