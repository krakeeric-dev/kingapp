import type { SessionUser } from "@/lib/auth";
import { getCompanyName, getCompanyWorkspaceId, canAccessCompany } from "@/lib/companies-data";
import { getClientOrders, saveClientOrders, type ClientPortalOrder } from "@/lib/client-portal-data";
import { logAuditEvent } from "@/lib/loading-data";
import { getProducts } from "@/lib/products-data";

export type WhatsAppChatStatus = "New" | "Open" | "Pending" | "Waiting Customer" | "Closed";
export type WhatsAppMessageDirection = "inbound" | "outbound" | "system";
export type WhatsAppMessageType = "Text" | "Image" | "PDF" | "Invoice" | "Dispatch Document" | "Delivery Note";
export type WhatsAppComplaintPriority = "Low" | "Medium" | "High" | "Critical";
export type WhatsAppComplaintStatus = "Open" | "Approved" | "Assigned" | "Resolved" | "Closed";
export type WhatsAppAgentStatus = "Online" | "Offline" | "Busy" | "Away";

export type WhatsAppCustomerProfile = {
  id: string;
  companyId: string;
  companyName: string;
  name: string;
  phone: string;
  address: string;
  location: string;
  customerType: string;
  productsPurchased: string[];
  debtStatus: string;
  totalOrders: number;
  lastContactDate: string;
  assignedAgent: string;
  createdAt: string;
  updatedAt: string;
};

export type WhatsAppChat = {
  id: string;
  companyId: string;
  companyName: string;
  businessNumber: string;
  customerId: string;
  customerName: string;
  phone: string;
  lastMessage: string;
  lastMessageAt: string;
  assignedAgentId: string;
  assignedAgentName: string;
  status: WhatsAppChatStatus;
  unreadCount: number;
  lockedByAgentId?: string;
  lockedByAgentName?: string;
  category: "General" | "Order" | "Payment" | "Complaint" | "Dispatch";
  createdAt: string;
  updatedAt: string;
};

export type WhatsAppMessage = {
  id: string;
  chatId: string;
  companyId: string;
  customerId: string;
  direction: WhatsAppMessageDirection;
  type: WhatsAppMessageType;
  body: string;
  fileName?: string;
  senderName: string;
  read: boolean;
  delivered: boolean;
  createdAt: string;
};

export type WhatsAppOrder = {
  id: string;
  chatId: string;
  customerId: string;
  customerName: string;
  phone: string;
  companyId: string;
  companyName: string;
  productName: string;
  itemCode: string;
  quantity: number;
  price: number;
  totalAmount: number;
  deliveryAddress: string;
  paymentMethod: string;
  notes: string;
  status: "Sent to Store" | "Dispatch Created" | "Closed";
  createdBy: string;
  createdAt: string;
};

export type WhatsAppComplaint = {
  id: string;
  complaintNumber: string;
  chatId: string;
  customerId: string;
  customerName: string;
  companyId: string;
  companyName: string;
  category: string;
  description: string;
  priority: WhatsAppComplaintPriority;
  agent: string;
  status: WhatsAppComplaintStatus;
  createdAt: string;
};

export type WhatsAppNotification = {
  id: string;
  companyId: string;
  title: string;
  body: string;
  severity: "Info" | "Warning" | "Urgent";
  createdAt: string;
  read: boolean;
};

export type WhatsAppAgentPresence = {
  id: string;
  companyId: string;
  agentId: string;
  agentName: string;
  status: WhatsAppAgentStatus;
  updatedAt: string;
};

const CHATS_KEY = "kingapp.whatsapp.chats";
const MESSAGES_KEY = "kingapp.whatsapp.messages";
const CUSTOMERS_KEY = "kingapp.whatsapp.customers";
const ORDERS_KEY = "kingapp.whatsapp.orders";
const COMPLAINTS_KEY = "kingapp.whatsapp.complaints";
const NOTIFICATIONS_KEY = "kingapp.whatsapp.notifications";
const AGENTS_KEY = "kingapp.whatsapp.agents";

export const whatsappTemplates = [
  { name: "Greeting", body: "Welcome to KingApp Customer Service. How can we help you?" },
  { name: "Order Received", body: "Your order has been received and is being processed." },
  { name: "Dispatch", body: "Your products have been dispatched." },
  { name: "Payment Reminder", body: "Kindly complete your pending payment." },
  { name: "Complaint Received", body: "We have received your complaint and are working on it." },
  { name: "Thank You", body: "Thank you for choosing us." }
];

export const whatsappIntegrationProviders = ["WhatsApp Business API", "Twilio", "Meta Cloud API", "GSM Gateway"];

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

function nowIso() {
  return new Date().toISOString();
}

function todayIso() {
  return nowIso().slice(0, 10);
}

function activeCompany(user: SessionUser) {
  const companyId = getCompanyWorkspaceId(user);
  return {
    id: companyId === "all" ? user.companyId : companyId,
    name: companyId === "all" ? user.companyName : getCompanyName(companyId, user.companyName)
  };
}

function visibleForUser<T extends { companyId: string; category?: string }>(records: T[], user: SessionUser) {
  return records.filter((record) => {
    if (!canAccessCompany(user, record.companyId)) return false;
    if (user.role === "accountant") return record.category === "Payment" || !record.category;
    if (user.role === "storekeeper") return record.category === "Dispatch" || record.category === "Order" || !record.category;
    return true;
  });
}

export function getWhatsAppChats(user: SessionUser) {
  return visibleForUser(readJson<WhatsAppChat[]>(CHATS_KEY, []), user);
}

export function getWhatsAppMessages(user: SessionUser, chatId?: string) {
  const visibleChatIds = new Set(getWhatsAppChats(user).map((chat) => chat.id));
  return readJson<WhatsAppMessage[]>(MESSAGES_KEY, []).filter(
    (message) => visibleChatIds.has(message.chatId) && (!chatId || message.chatId === chatId)
  );
}

export function getWhatsAppCustomers(user: SessionUser) {
  return visibleForUser(readJson<WhatsAppCustomerProfile[]>(CUSTOMERS_KEY, []), user);
}

export function getWhatsAppOrders(user: SessionUser) {
  return visibleForUser(readJson<WhatsAppOrder[]>(ORDERS_KEY, []), user);
}

export function getWhatsAppComplaints(user: SessionUser) {
  return visibleForUser(readJson<WhatsAppComplaint[]>(COMPLAINTS_KEY, []), user);
}

export function getWhatsAppNotifications(user: SessionUser) {
  return visibleForUser(readJson<WhatsAppNotification[]>(NOTIFICATIONS_KEY, []), user);
}

export function getWhatsAppAgentPresence(user: SessionUser) {
  return visibleForUser(readJson<WhatsAppAgentPresence[]>(AGENTS_KEY, []), user);
}

export function createOrUpdateWhatsAppCustomer(input: {
  address?: string;
  assignedAgent?: string;
  companyId: string;
  companyName: string;
  customerType?: string;
  debtStatus?: string;
  location?: string;
  name: string;
  phone: string;
  productsPurchased?: string[];
}) {
  const customers = readJson<WhatsAppCustomerProfile[]>(CUSTOMERS_KEY, []);
  const existingIndex = customers.findIndex(
    (customer) => customer.companyId === input.companyId && normalizedPhone(customer.phone) === normalizedPhone(input.phone)
  );
  const previous = existingIndex >= 0 ? customers[existingIndex] : null;
  const customer: WhatsAppCustomerProfile = {
    id: previous?.id ?? makeId("WAC"),
    companyId: input.companyId,
    companyName: input.companyName,
    name: input.name.trim() || previous?.name || "Unknown Customer",
    phone: input.phone.trim(),
    address: input.address ?? previous?.address ?? "",
    location: input.location ?? previous?.location ?? "",
    customerType: input.customerType ?? previous?.customerType ?? "",
    productsPurchased: Array.from(new Set([...(previous?.productsPurchased ?? []), ...(input.productsPurchased ?? [])].filter(Boolean))),
    debtStatus: input.debtStatus ?? previous?.debtStatus ?? "Not reviewed",
    totalOrders: previous?.totalOrders ?? 0,
    lastContactDate: todayIso(),
    assignedAgent: input.assignedAgent ?? previous?.assignedAgent ?? "",
    createdAt: previous?.createdAt ?? nowIso(),
    updatedAt: nowIso()
  };

  if (existingIndex >= 0) {
    customers[existingIndex] = customer;
  } else {
    customers.unshift(customer);
  }
  writeJson(CUSTOMERS_KEY, customers);
  return customer;
}

export function registerInboundWhatsAppChat(input: {
  address: string;
  businessNumber: string;
  category: WhatsAppChat["category"];
  customerName: string;
  customerType: string;
  initialMessage: string;
  location: string;
  phone: string;
  user: SessionUser;
}) {
  const company = activeCompany(input.user);
  const customer = createOrUpdateWhatsAppCustomer({
    address: input.address,
    assignedAgent: input.user.displayName,
    companyId: company.id,
    companyName: company.name,
    customerType: input.customerType,
    location: input.location,
    name: input.customerName,
    phone: input.phone
  });
  const chats = readJson<WhatsAppChat[]>(CHATS_KEY, []);
  const existingChat = chats.find(
    (chat) => chat.companyId === company.id && normalizedPhone(chat.phone) === normalizedPhone(input.phone) && chat.status !== "Closed"
  );
  const chat: WhatsAppChat = {
    id: existingChat?.id ?? makeId("WACHAT"),
    companyId: company.id,
    companyName: company.name,
    businessNumber: input.businessNumber,
    customerId: customer.id,
    customerName: customer.name,
    phone: customer.phone,
    lastMessage: input.initialMessage,
    lastMessageAt: nowIso(),
    assignedAgentId: existingChat?.assignedAgentId ?? "",
    assignedAgentName: existingChat?.assignedAgentName ?? "Unassigned",
    status: existingChat?.status ?? "New",
    unreadCount: (existingChat?.unreadCount ?? 0) + 1,
    category: input.category,
    createdAt: existingChat?.createdAt ?? nowIso(),
    updatedAt: nowIso()
  };
  saveChat(chat);
  appendMessage({
    body: input.initialMessage,
    chat,
    customerId: customer.id,
    direction: "inbound",
    senderName: customer.name,
    type: "Text"
  });
  addNotification(company.id, "New WhatsApp message", `${customer.name} sent a new message.`, "Info");
  logAuditEvent({
    action: "message_received",
    companyId: company.id,
    companyName: company.name,
    module: "WhatsApp Call Center",
    newValue: chat,
    recordId: chat.id,
    reason: "WhatsApp inbound message registered",
    status: "success",
    user: input.user
  });
  return chat;
}

export function sendWhatsAppMessage(input: {
  body: string;
  chatId: string;
  fileName?: string;
  type: WhatsAppMessageType;
  user: SessionUser;
}) {
  const chat = readJson<WhatsAppChat[]>(CHATS_KEY, []).find((item) => item.id === input.chatId);
  if (!chat) throw new Error("Chat not found.");
  if (!canAccessCompany(input.user, chat.companyId)) throw new Error("You do not have access to this company.");

  const message = appendMessage({
    body: input.body,
    chat,
    customerId: chat.customerId,
    direction: "outbound",
    fileName: input.fileName,
    senderName: input.user.displayName,
    type: input.type
  });
  saveChat({
    ...chat,
    lastMessage: input.body,
    lastMessageAt: message.createdAt,
    lockedByAgentId: input.user.id,
    lockedByAgentName: input.user.displayName,
    status: chat.status === "New" ? "Open" : chat.status,
    unreadCount: 0,
    updatedAt: message.createdAt
  });
  logAuditEvent({
    action: "message_sent",
    companyId: chat.companyId,
    companyName: chat.companyName,
    module: "WhatsApp Call Center",
    newValue: { body: input.body, type: input.type },
    recordId: chat.id,
    reason: "WhatsApp message sent",
    status: "success",
    user: input.user
  });
  return message;
}

export function assignWhatsAppChat(chatId: string, agentName: string, user: SessionUser) {
  const chat = getRawChat(chatId);
  const updated = {
    ...chat,
    assignedAgentId: agentName,
    assignedAgentName: agentName || "Unassigned",
    status: "Open" as const,
    updatedAt: nowIso()
  };
  saveChat(updated);
  logAuditEvent({
    action: "agent_assignment",
    companyId: updated.companyId,
    companyName: updated.companyName,
    module: "WhatsApp Call Center",
    newValue: { assignedAgent: updated.assignedAgentName },
    recordId: chatId,
    reason: "WhatsApp chat assigned",
    status: "success",
    user
  });
  return updated;
}

export function transferWhatsAppChat(chatId: string, agentName: string, user: SessionUser) {
  const previous = getRawChat(chatId);
  const updated = assignWhatsAppChat(chatId, agentName, user);
  appendSystemMessage(updated, `Chat transferred from ${previous.assignedAgentName || "Unassigned"} to ${updated.assignedAgentName}.`);
  addNotification(updated.companyId, "WhatsApp transfer", `${updated.customerName} was transferred to ${updated.assignedAgentName}.`, "Warning");
  logAuditEvent({
    action: "chat_transferred",
    companyId: updated.companyId,
    companyName: updated.companyName,
    module: "WhatsApp Call Center",
    newValue: { assignedAgent: updated.assignedAgentName },
    oldValue: { assignedAgent: previous.assignedAgentName },
    recordId: chatId,
    reason: "WhatsApp chat transferred",
    status: "success",
    user
  });
  return updated;
}

export function closeWhatsAppChat(chatId: string, user: SessionUser) {
  const chat = getRawChat(chatId);
  const updated = { ...chat, status: "Closed" as const, updatedAt: nowIso() };
  saveChat(updated);
  appendSystemMessage(updated, `Chat closed by ${user.displayName}.`);
  logAuditEvent({
    action: "chat_closed",
    companyId: updated.companyId,
    companyName: updated.companyName,
    module: "WhatsApp Call Center",
    recordId: chatId,
    reason: "WhatsApp chat closed",
    status: "success",
    user
  });
  return updated;
}

export function createWhatsAppOrder(input: {
  chatId: string;
  deliveryAddress: string;
  itemCode: string;
  notes: string;
  paymentMethod: string;
  productName: string;
  quantity: number;
  user: SessionUser;
}) {
  const chat = getRawChat(input.chatId);
  const product = getProducts().find((item) => item.itemCode === input.itemCode || item.name === input.productName);
  const price = product?.pricePerCarton ?? 0;
  const order: WhatsAppOrder = {
    id: makeId("WAORD"),
    chatId: chat.id,
    companyId: chat.companyId,
    companyName: chat.companyName,
    customerId: chat.customerId,
    customerName: chat.customerName,
    phone: chat.phone,
    productName: product?.name ?? input.productName,
    itemCode: product?.itemCode ?? input.itemCode,
    quantity: input.quantity,
    price,
    totalAmount: input.quantity * price,
    deliveryAddress: input.deliveryAddress,
    paymentMethod: input.paymentMethod,
    notes: input.notes,
    status: "Sent to Store",
    createdBy: input.user.displayName,
    createdAt: nowIso()
  };

  writeJson(ORDERS_KEY, [order, ...readJson<WhatsAppOrder[]>(ORDERS_KEY, [])]);
  incrementCustomerOrderTotal(chat.customerId, order.productName);
  saveClientOrders([toClientPortalOrder(order), ...getClientOrders()]);
  saveChat({ ...chat, category: "Order", lastMessage: "Order created from WhatsApp.", status: "Pending", updatedAt: nowIso() });
  appendSystemMessage(chat, `Order ${order.id} sent to Store for ${order.quantity} x ${order.productName}.`);
  addNotification(chat.companyId, "WhatsApp order created", `${chat.customerName} order sent to Store.`, "Info");
  logAuditEvent({
    action: "order_created",
    companyId: chat.companyId,
    companyName: chat.companyName,
    module: "WhatsApp Call Center",
    newValue: order,
    recordId: order.id,
    reason: "Order created from WhatsApp chat",
    status: "success",
    user: input.user
  });
  return order;
}

export function createWhatsAppComplaint(input: {
  category: string;
  chatId: string;
  description: string;
  priority: WhatsAppComplaintPriority;
  user: SessionUser;
}) {
  const chat = getRawChat(input.chatId);
  const complaint: WhatsAppComplaint = {
    id: makeId("WACMP"),
    complaintNumber: makeId("CMP"),
    chatId: chat.id,
    companyId: chat.companyId,
    companyName: chat.companyName,
    customerId: chat.customerId,
    customerName: chat.customerName,
    category: input.category,
    description: input.description,
    priority: input.priority,
    agent: input.user.displayName,
    status: "Open",
    createdAt: nowIso()
  };
  writeJson(COMPLAINTS_KEY, [complaint, ...readJson<WhatsAppComplaint[]>(COMPLAINTS_KEY, [])]);
  saveChat({ ...chat, category: "Complaint", lastMessage: "Complaint created from WhatsApp.", status: "Pending", updatedAt: nowIso() });
  appendSystemMessage(chat, `Complaint ${complaint.complaintNumber} created and sent to Supervisor.`);
  addNotification(chat.companyId, "WhatsApp complaint created", `${chat.customerName}: ${complaint.category}`, complaint.priority === "Critical" ? "Urgent" : "Warning");
  logAuditEvent({
    action: "complaint_created",
    companyId: chat.companyId,
    companyName: chat.companyName,
    module: "WhatsApp Call Center",
    newValue: complaint,
    recordId: complaint.id,
    reason: "Complaint created from WhatsApp chat",
    status: "success",
    user: input.user
  });
  return complaint;
}

export function updateWhatsAppComplaintStatus(complaintId: string, status: WhatsAppComplaintStatus, user: SessionUser) {
  const complaints = readJson<WhatsAppComplaint[]>(COMPLAINTS_KEY, []);
  const oldComplaint = complaints.find((complaint) => complaint.id === complaintId);
  const updatedComplaints = complaints.map((complaint) =>
    complaint.id === complaintId ? { ...complaint, status } : complaint
  );
  writeJson(COMPLAINTS_KEY, updatedComplaints);
  if (oldComplaint) {
    logAuditEvent({
      action: "complaint_status_changed",
      companyId: oldComplaint.companyId,
      companyName: oldComplaint.companyName,
      module: "WhatsApp Call Center",
      newValue: { status },
      oldValue: { status: oldComplaint.status },
      recordId: complaintId,
      reason: "WhatsApp complaint status changed",
      status: "success",
      user
    });
  }
  return updatedComplaints.find((complaint) => complaint.id === complaintId) ?? null;
}

export function setWhatsAppAgentStatus(status: WhatsAppAgentStatus, user: SessionUser) {
  const company = activeCompany(user);
  const agents = readJson<WhatsAppAgentPresence[]>(AGENTS_KEY, []);
  const id = `${company.id}:${user.id}`;
  const record: WhatsAppAgentPresence = {
    id,
    companyId: company.id,
    agentId: user.id,
    agentName: user.displayName,
    status,
    updatedAt: nowIso()
  };
  const next = agents.some((agent) => agent.id === id)
    ? agents.map((agent) => (agent.id === id ? record : agent))
    : [record, ...agents];
  writeJson(AGENTS_KEY, next);
  return record;
}

export function getWhatsAppDashboard(user: SessionUser) {
  const chats = getWhatsAppChats(user);
  const orders = getWhatsAppOrders(user);
  const complaints = getWhatsAppComplaints(user);
  const today = todayIso();
  return {
    activeChats: chats.filter((chat) => chat.status !== "Closed").length,
    waitingChats: chats.filter((chat) => chat.status === "New" || chat.status === "Waiting Customer").length,
    assignedChats: chats.filter((chat) => chat.assignedAgentName && chat.assignedAgentName !== "Unassigned").length,
    closedChats: chats.filter((chat) => chat.status === "Closed").length,
    unreadMessages: chats.reduce((total, chat) => total + chat.unreadCount, 0),
    todayOrders: orders.filter((order) => order.createdAt.slice(0, 10) === today).length,
    todayComplaints: complaints.filter((complaint) => complaint.createdAt.slice(0, 10) === today).length
  };
}

function getRawChat(chatId: string) {
  const chat = readJson<WhatsAppChat[]>(CHATS_KEY, []).find((item) => item.id === chatId);
  if (!chat) throw new Error("Chat not found.");
  return chat;
}

function saveChat(chat: WhatsAppChat) {
  const chats = readJson<WhatsAppChat[]>(CHATS_KEY, []);
  const next = chats.some((item) => item.id === chat.id)
    ? chats.map((item) => (item.id === chat.id ? chat : item))
    : [chat, ...chats];
  writeJson(CHATS_KEY, next);
}

function appendMessage(input: {
  body: string;
  chat: WhatsAppChat;
  customerId: string;
  direction: WhatsAppMessageDirection;
  fileName?: string;
  senderName: string;
  type: WhatsAppMessageType;
}) {
  const message: WhatsAppMessage = {
    id: makeId("WAMSG"),
    chatId: input.chat.id,
    companyId: input.chat.companyId,
    customerId: input.customerId,
    direction: input.direction,
    type: input.type,
    body: input.body,
    fileName: input.fileName,
    senderName: input.senderName,
    read: input.direction !== "inbound",
    delivered: input.direction !== "inbound",
    createdAt: nowIso()
  };
  writeJson(MESSAGES_KEY, [message, ...readJson<WhatsAppMessage[]>(MESSAGES_KEY, [])]);
  return message;
}

function appendSystemMessage(chat: WhatsAppChat, body: string) {
  return appendMessage({
    body,
    chat,
    customerId: chat.customerId,
    direction: "system",
    senderName: "KingApp",
    type: "Text"
  });
}

function addNotification(companyId: string, title: string, body: string, severity: WhatsAppNotification["severity"]) {
  const notification: WhatsAppNotification = {
    id: makeId("WANOT"),
    companyId,
    title,
    body,
    severity,
    createdAt: nowIso(),
    read: false
  };
  writeJson(NOTIFICATIONS_KEY, [notification, ...readJson<WhatsAppNotification[]>(NOTIFICATIONS_KEY, [])]);
  return notification;
}

function incrementCustomerOrderTotal(customerId: string, productName: string) {
  const customers = readJson<WhatsAppCustomerProfile[]>(CUSTOMERS_KEY, []);
  writeJson(
    CUSTOMERS_KEY,
    customers.map((customer) =>
      customer.id === customerId
        ? {
            ...customer,
            productsPurchased: Array.from(new Set([...customer.productsPurchased, productName])),
            totalOrders: customer.totalOrders + 1,
            updatedAt: nowIso()
          }
        : customer
    )
  );
}

function toClientPortalOrder(order: WhatsAppOrder): ClientPortalOrder {
  return {
    id: order.id.replace("WAORD", "CPO"),
    agentId: order.createdBy,
    assignedMarketer: order.createdBy,
    clientId: order.customerId,
    clientName: order.customerName,
    companyId: order.companyId,
    companyName: order.companyName,
    createdAt: order.createdAt,
    location: order.deliveryAddress,
    lines: [
      {
        amount: order.totalAmount,
        itemCode: order.itemCode,
        pricePerCarton: order.price,
        productName: order.productName,
        quantity: order.quantity
      }
    ],
    notifications: [
      {
        id: makeId("NTF"),
        message: "Order received from WhatsApp and sent to Store.",
        createdAt: nowIso()
      }
    ],
    paymentStatus: "Unpaid",
    phone: order.phone,
    status: "Pending",
    supplier: order.companyName,
    supplierId: order.companyId,
    totalAmount: order.totalAmount,
    totalQuantity: order.quantity
  };
}

function normalizedPhone(phone: string) {
  return phone.replace(/\D/g, "");
}
