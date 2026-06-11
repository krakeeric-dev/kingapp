import type { SessionUser } from "@/lib/auth";
import { canAccessCompany, getCompanies, getCompanyWorkspaceId } from "@/lib/companies-data";
import {
  getClientOrders,
  getClientsForSupplier,
  getSupplierClientLinks,
  getSuppliers,
  type ClientPortalOrder,
  type PortalClient,
  type PortalSupplier
} from "@/lib/client-portal-data";
import { createInternalNotification } from "@/lib/messageService";
import { logAuditEvent } from "@/lib/loading-data";

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

export type ClientMessageCompanyDisplay = {
  id: string;
  logo: string;
  name: string;
  supportStatus: string;
  supportTeam: string;
  badgeClass: string;
};

const CLIENT_MESSAGES_KEY = "kingapp.clientPortal.messages";

const companyBySupplierId: Record<string, { id: string; name: string }> = {};

const clientCompanyFallback: Record<string, { id: string; name: string }> = {};

export const clientMessageCompanyDisplays: Record<string, ClientMessageCompanyDisplay> = {};

function getCompanyDisplayMap() {
  return getCompanies().reduce<Record<string, ClientMessageCompanyDisplay>>((map, company) => {
    map[company.id] = {
      id: company.id,
      logo: company.name.slice(0, 2).toUpperCase(),
      name: company.name,
      supportStatus: "Online",
      supportTeam: "Customer Support",
      badgeClass: "bg-blue-50 text-blue-700 border-blue-200"
    };
    return map;
  }, {});
}

export function getClientMessageCompanyDisplay(companyId?: string, companyName?: string) {
  const displayMap = getCompanyDisplayMap();
  if (companyId && displayMap[companyId]) return displayMap[companyId];
  const match = Object.values(displayMap).find((company) => company.name === companyName);
  return match ?? {
    id: companyId ?? "",
    logo: (companyName ?? "KA").slice(0, 2).toUpperCase(),
    name: companyName ?? "No company selected",
    supportStatus: "Online",
    supportTeam: "Customer Support",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200"
  };
}

const _seedMessages: ClientMessage[] = [];

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

export function getCompanyForClientMessage(client: PortalClient, supplierId?: string) {
  if (supplierId && companyBySupplierId[supplierId]) return companyBySupplierId[supplierId];
  return clientCompanyFallback[client.id] ?? { id: "", name: "No company selected" };
}

export function getLinkedMessageCompaniesForClient(client: PortalClient) {
  const linkedSupplierIds = getSupplierClientLinks()
    .filter((link) => link.clientId === client.id && link.active)
    .map((link) => link.supplierId);
  const companies = linkedSupplierIds.map((supplierId) => {
    const company = getCompanyForClientMessage(client, supplierId);
    return {
      ...getClientMessageCompanyDisplay(company.id, company.name),
      supplierId
    };
  });
  const seen = new Set<string>();
  return companies.filter((company) => {
    if (seen.has(company.id)) return false;
    seen.add(company.id);
    return true;
  });
}

export function getClientMessages() {
  const messages = readJson<ClientMessage[]>(CLIENT_MESSAGES_KEY, []);
  return withoutSeedRecords(CLIENT_MESSAGES_KEY, messages, _seedMessages.map((message) => message.id));
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
  logAuditEvent({
    action: "message_sent",
    companyId: message.companyId,
    companyName: message.companyName,
    module: "Client Messages",
    newValue: message,
    recordId: message.id,
    reason: "Client message sent",
    status: "success"
  });
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
  const updatedMessages = saveClientMessages([message, ...messages]);
  logAuditEvent({
    action: "message_sent",
    companyId: message.companyId,
    companyName: message.companyName,
    module: "Client Messages",
    newValue: message,
    recordId: message.id,
    reason: "Client message reply sent",
    status: "success"
  });
  return updatedMessages;
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
