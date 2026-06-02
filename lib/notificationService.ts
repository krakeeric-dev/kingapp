export type NotificationTemplate =
  | "Order Received"
  | "Order Approved"
  | "Out For Delivery"
  | "Delivered"
  | "Payment Reminder";

export type NotificationPayload = {
  clientName: string;
  phone: string;
  orderNumber?: string;
  amount?: number;
  eta?: string;
  notes?: string;
};

export type NotificationResult = {
  id: string;
  channel: "WhatsApp";
  template: NotificationTemplate;
  phone: string;
  message: string;
  status: "mock_sent" | "failed";
  createdAt: string;
};

const NOTIFICATIONS_KEY = "kingapp.callCenter.notifications";

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

export function buildNotificationMessage(template: NotificationTemplate, payload: NotificationPayload) {
  if (template === "Order Received") {
    return `Hello ${payload.clientName}, your order ${payload.orderNumber ?? ""} has been received.`;
  }
  if (template === "Order Approved") {
    return `Hello ${payload.clientName}, your order ${payload.orderNumber ?? ""} has been approved.`;
  }
  if (template === "Out For Delivery") {
    return `Hello ${payload.clientName}, your order ${payload.orderNumber ?? ""} is out for delivery${payload.eta ? `, ETA ${payload.eta}` : ""}.`;
  }
  if (template === "Delivered") {
    return `Hello ${payload.clientName}, your order ${payload.orderNumber ?? ""} has been delivered. Thank you.`;
  }
  return `Hello ${payload.clientName}, payment reminder${payload.amount ? ` for ${payload.amount.toLocaleString()} RWF` : ""}. ${payload.notes ?? ""}`.trim();
}

export function sendWhatsAppNotification(
  template: NotificationTemplate,
  payload: NotificationPayload
): NotificationResult {
  const result: NotificationResult = {
    id: `WAPP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase(),
    channel: "WhatsApp",
    template,
    phone: payload.phone,
    message: buildNotificationMessage(template, payload),
    status: "mock_sent",
    createdAt: new Date().toISOString()
  };

  writeJson(NOTIFICATIONS_KEY, [result, ...getNotificationHistory()]);
  return result;
}

export function getNotificationHistory() {
  return readJson<NotificationResult[]>(NOTIFICATIONS_KEY, []);
}
