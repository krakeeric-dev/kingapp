import type { SessionUser } from "@/lib/auth";
import {
  getCallbacks,
  getCallLogs,
  getComplaints,
  getPaymentFollowUps,
  getPendingOrders,
  type CallCenterClient
} from "@/lib/call-center-data";
import { getClientOrders } from "@/lib/client-portal-data";

export type MessageStatus = "delivered" | "read";
export type AnnouncementPriority = "Normal" | "Important" | "Urgent";
export type NotificationChannel = "Internal" | "SMS" | "WhatsApp" | "Email";

export type InternalMessage = {
  id: string;
  fromUser: string;
  fromRole: string;
  toUser: string;
  toRole: string;
  subject: string;
  body: string;
  status: MessageStatus;
  deliveredAt: string;
  readAt?: string;
  createdAt: string;
};

export type TeamAnnouncement = {
  id: string;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  audience: "All" | "Managers" | "Agents";
  createdBy: string;
  createdAt: string;
};

export type InternalNotification = {
  id: string;
  channel: NotificationChannel;
  type: "order" | "complaint" | "callback" | "message" | "announcement";
  title: string;
  body: string;
  assignedTo?: string;
  priority: "Low" | "Medium" | "High" | "Urgent";
  read: boolean;
  createdAt: string;
};

export type TimelineItem = {
  id: string;
  type: "Call" | "Message" | "Complaint" | "Order" | "Payment" | "Callback";
  title: string;
  detail: string;
  createdAt: string;
};

const MESSAGES_KEY = "kingapp.callCenter.messages";
const ANNOUNCEMENTS_KEY = "kingapp.callCenter.announcements";
const NOTIFICATIONS_KEY = "kingapp.callCenter.internalNotifications";

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

const seedMessages: InternalMessage[] = [
  {
    id: "MSG-001",
    fromUser: "Alice Agent",
    fromRole: "callcenter",
    toUser: "Manager",
    toRole: "manager",
    subject: "Kigali Mart payment promise",
    body: "Client promised to pay before Friday afternoon delivery.",
    status: "read",
    deliveredAt: "2026-06-02T08:45:00.000Z",
    readAt: "2026-06-02T08:55:00.000Z",
    createdAt: "2026-06-02T08:44:00.000Z"
  },
  {
    id: "MSG-002",
    fromUser: "Manager",
    fromRole: "manager",
    toUser: "Call Center Agent",
    toRole: "callcenter",
    subject: "Confirm high balance clients",
    body: "Please prioritize stores with unpaid balances before taking new orders.",
    status: "delivered",
    deliveredAt: "2026-06-02T09:10:00.000Z",
    createdAt: "2026-06-02T09:10:00.000Z"
  }
];

const seedAnnouncements: TeamAnnouncement[] = [
  {
    id: "ANN-001",
    title: "Meeting at 4 PM",
    body: "Call center team review for delivery issues and payment promises.",
    priority: "Important",
    audience: "All",
    createdBy: "Manager",
    createdAt: "2026-06-02T09:00:00.000Z"
  },
  {
    id: "ANN-002",
    title: "Promotion update",
    body: "Push Water 500ml reorder calls for priority retail clients today.",
    priority: "Normal",
    audience: "Agents",
    createdBy: "Manager",
    createdAt: "2026-06-02T09:30:00.000Z"
  }
];

export function getMessages() {
  const messages = readJson<InternalMessage[]>(MESSAGES_KEY, seedMessages);
  writeJson(MESSAGES_KEY, messages);
  return messages;
}

export function sendInternalMessage(input: Pick<InternalMessage, "body" | "subject" | "toRole" | "toUser">, user: SessionUser) {
  const now = new Date().toISOString();
  const message: InternalMessage = {
    ...input,
    id: makeId("MSG"),
    fromUser: user.displayName,
    fromRole: user.role,
    status: "delivered",
    deliveredAt: now,
    createdAt: now
  };
  const messages = [message, ...getMessages()];
  writeJson(MESSAGES_KEY, messages);
  createInternalNotification({
    type: "message",
    title: `Message from ${user.displayName}`,
    body: input.subject,
    assignedTo: input.toUser,
    priority: "Medium"
  });
  return messages;
}

export function markMessageRead(messageId: string) {
  const now = new Date().toISOString();
  const messages = getMessages().map((message) =>
    message.id === messageId ? { ...message, status: "read" as const, readAt: now } : message
  );
  writeJson(MESSAGES_KEY, messages);
  return messages;
}

export function getAnnouncements() {
  const announcements = readJson<TeamAnnouncement[]>(ANNOUNCEMENTS_KEY, seedAnnouncements);
  writeJson(ANNOUNCEMENTS_KEY, announcements);
  return announcements;
}

export function createAnnouncement(input: Pick<TeamAnnouncement, "audience" | "body" | "priority" | "title">, user: SessionUser) {
  const announcement: TeamAnnouncement = {
    ...input,
    id: makeId("ANN"),
    createdBy: user.displayName,
    createdAt: new Date().toISOString()
  };
  const announcements = [announcement, ...getAnnouncements()];
  writeJson(ANNOUNCEMENTS_KEY, announcements);
  createInternalNotification({
    type: "announcement",
    title: announcement.title,
    body: announcement.body,
    priority: announcement.priority === "Urgent" ? "Urgent" : "Medium"
  });
  return announcements;
}

export function getInternalNotifications() {
  const notifications = readJson<InternalNotification[]>(NOTIFICATIONS_KEY, []);
  const generated = [
    ...getOrderNotifications(),
    ...getComplaintNotifications(),
    ...getCallbackReminderNotifications()
  ];
  const existingIds = new Set(notifications.map((notification) => notification.id));
  const merged = [...generated.filter((item) => !existingIds.has(item.id)), ...notifications];
  writeJson(NOTIFICATIONS_KEY, merged);
  return merged;
}

export function createInternalNotification(input: Omit<InternalNotification, "channel" | "createdAt" | "id" | "read"> & { channel?: NotificationChannel }) {
  const notification: InternalNotification = {
    ...input,
    id: makeId("NTF"),
    channel: input.channel ?? "Internal",
    read: false,
    createdAt: new Date().toISOString()
  };
  const notifications = [notification, ...readJson<InternalNotification[]>(NOTIFICATIONS_KEY, [])];
  writeJson(NOTIFICATIONS_KEY, notifications);
  return notification;
}

export function getMessagingDashboardStats(user: SessionUser) {
  const today = new Date().toISOString().slice(0, 10);
  const messages = getMessages();
  const notifications = getInternalNotifications();
  const announcements = getAnnouncements();
  const visibleMessages = user.role === "callcenter"
    ? messages.filter((message) => message.toUser === user.displayName || message.fromUser === user.displayName || message.toRole === "callcenter")
    : messages;
  const visibleNotifications = user.role === "callcenter"
    ? notifications.filter((notification) => !notification.assignedTo || notification.assignedTo === user.displayName)
    : notifications;

  return {
    messagesToday: visibleMessages.filter((message) => message.createdAt.slice(0, 10) === today).length,
    unreadMessages: visibleMessages.filter((message) => message.status !== "read").length,
    announcements: announcements.length,
    urgentAlerts: visibleNotifications.filter((notification) => notification.priority === "Urgent" || notification.priority === "High").length
  };
}

export function getClientTimeline(client: CallCenterClient): TimelineItem[] {
  const calls = getCallLogs()
    .filter((item) => item.clientId === client.id)
    .map<TimelineItem>((item) => ({
      id: item.id,
      type: "Call",
      title: `${item.callType} call`,
      detail: `${item.outcome} by ${item.agent}. ${item.nextAction}`,
      createdAt: `${item.date}T${item.time}:00.000Z`
    }));
  const messages = getMessages()
    .filter((item) => item.body.toLowerCase().includes(client.clientName.toLowerCase()) || item.subject.toLowerCase().includes(client.clientName.toLowerCase()))
    .map<TimelineItem>((item) => ({
      id: item.id,
      type: "Message",
      title: item.subject,
      detail: item.body,
      createdAt: item.createdAt
    }));
  const complaints = getComplaints()
    .filter((item) => item.clientId === client.id)
    .map<TimelineItem>((item) => ({
      id: item.id,
      type: "Complaint",
      title: item.complaintType,
      detail: `${item.priority} priority - ${item.status}`,
      createdAt: item.createdAt
    }));
  const orders = [...getPendingOrders(), ...getClientOrders()]
    .filter((item) => item.clientId === client.id)
    .map<TimelineItem>((item) => ({
      id: item.id,
      type: "Order",
      title: `Order ${item.id}`,
      detail: "status" in item ? item.status : "Pending Storekeeper",
      createdAt: "createdAt" in item ? item.createdAt : new Date().toISOString()
    }));
  const payments = getPaymentFollowUps()
    .filter((item) => item.clientId === client.id)
    .map<TimelineItem>((item) => ({
      id: item.id,
      type: "Payment",
      title: `Payment follow-up ${item.amountDue.toLocaleString()} RWF`,
      detail: `${item.status} - Promise date ${item.promiseToPayDate}`,
      createdAt: item.createdAt
    }));
  const callbacks = getCallbacks()
    .filter((item) => item.clientId === client.id)
    .map<TimelineItem>((item) => ({
      id: item.id,
      type: "Callback",
      title: item.reason,
      detail: `${item.callbackDate} ${item.callbackTime} - ${item.status}`,
      createdAt: `${item.callbackDate}T${item.callbackTime}:00.000Z`
    }));

  return [...calls, ...messages, ...complaints, ...orders, ...payments, ...callbacks]
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
}

function getOrderNotifications(): InternalNotification[] {
  const statuses = ["Pending", "Approved", "Loading", "Out For Delivery", "Delivered", "Paid"];
  return getClientOrders().slice(0, 12).map((order, index) => {
    const status = statuses.includes(order.status) ? order.status : order.status === "Loaded" ? "Loading" : order.status;
    return {
      id: `ORDER-NTF-${order.id}`,
      channel: "Internal",
      type: "order",
      title: `Order ${order.id} ${status.toLowerCase()}.`,
      body: `Order #${order.id} ${status.toLowerCase()} for ${order.clientName}.`,
      priority: index < 3 ? "High" : "Medium",
      read: false,
      createdAt: order.createdAt
    };
  });
}

function getComplaintNotifications(): InternalNotification[] {
  return getComplaints().slice(0, 12).map((complaint) => ({
    id: `COMP-NTF-${complaint.id}`,
    channel: "Internal",
    type: "complaint",
    title: `Complaint created: ${complaint.clientName}`,
    body: `Notify Manager and ${complaint.agent || complaint.assignedTo || "assigned agent"} about ${complaint.complaintType}.`,
    assignedTo: complaint.agent,
    priority: complaint.priority === "Urgent" || complaint.priority === "High" ? "Urgent" : "High",
    read: false,
    createdAt: complaint.createdAt
  }));
}

function getCallbackReminderNotifications(): InternalNotification[] {
  const now = Date.now();
  const fifteenMinutes = 15 * 60 * 1000;
  return getCallbacks()
    .filter((callback) => {
      const callbackTime = new Date(`${callback.callbackDate}T${callback.callbackTime}:00`).getTime();
      return callback.status === "Pending" && callbackTime >= now && callbackTime - now <= fifteenMinutes;
    })
    .map((callback) => ({
      id: `CB-REM-${callback.id}`,
      channel: "Internal" as const,
      type: "callback" as const,
      title: `Reminder: Call ${callback.clientName} at ${callback.callbackTime}.`,
      body: callback.reason,
      assignedTo: callback.assignedAgent,
      priority: "High" as const,
      read: false,
      createdAt: new Date().toISOString()
    }));
}
