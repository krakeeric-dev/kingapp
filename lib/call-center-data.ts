import type { SessionUser } from "@/lib/auth";

export type CallType =
  | "New Order"
  | "Reorder"
  | "Complaint"
  | "Payment Follow-up"
  | "Customer Care"
  | "New Client Prospect";

export type CallStatus = "Open" | "Closed" | "Pending Callback" | "Scheduled";

export type CallCenterClient = {
  id: string;
  clientName: string;
  ownerName: string;
  phone: string;
  area: string;
  assignedMarketer: string;
  currentBalance: number;
  lastOrderDate: string;
  lastOrderQuantity: number;
  lastPaymentDate: string;
  notes: string[];
};

export type CallLog = {
  id: string;
  date: string;
  time: string;
  clientId: string;
  clientName: string;
  phone: string;
  callType: CallType;
  duration: string;
  outcome: CallStatus;
  nextAction: string;
  agent: string;
};

export type PendingOrder = {
  id: string;
  clientId: string;
  clientName: string;
  phone: string;
  area: string;
  product: string;
  quantity: number;
  deliveryDate: string;
  notes: string;
  status: "Pending Storekeeper";
  createdBy: string;
  createdAt: string;
};

export type PaymentFollowUp = {
  id: string;
  clientId: string;
  clientName: string;
  amountDue: number;
  daysOutstanding: number;
  promiseToPayDate: string;
  comment: string;
  status: string;
  agent: string;
  createdAt: string;
};

export type ComplaintRecord = {
  id: string;
  clientId: string;
  clientName: string;
  complaintType: string;
  product: string;
  quantity: number;
  description: string;
  priority: string;
  status: string;
  agent: string;
  createdAt: string;
};

export type ScheduledFollowUp = {
  id: string;
  clientId: string;
  clientName: string;
  date: string;
  time: string;
  reason: string;
  assignedAgent: string;
  status: "Scheduled" | "Done";
};

const CLIENTS_KEY = "kingapp.callCenter.clients";
const CALL_LOGS_KEY = "kingapp.callCenter.callLogs";
const ORDERS_KEY = "kingapp.callCenter.pendingOrders";
const PAYMENT_FOLLOW_UPS_KEY = "kingapp.callCenter.paymentFollowUps";
const COMPLAINTS_KEY = "kingapp.callCenter.complaints";
const FOLLOW_UPS_KEY = "kingapp.callCenter.followUps";

const defaultClients: CallCenterClient[] = [
  {
    id: "CL-001",
    clientName: "Kigali Mart",
    ownerName: "Jean Bosco",
    phone: "0788000001",
    area: "Nyamirambo",
    assignedMarketer: "Marketer 1",
    currentBalance: 42000,
    lastOrderDate: "2026-05-31",
    lastOrderQuantity: 35,
    lastPaymentDate: "2026-05-29",
    notes: ["Prefers morning delivery", "Owner pays on Fridays"]
  },
  {
    id: "CL-002",
    clientName: "Sunrise Shop",
    ownerName: "Aline Uwase",
    phone: "0788000002",
    area: "Kimironko",
    assignedMarketer: "Marketer 1",
    currentBalance: 0,
    lastOrderDate: "2026-05-30",
    lastOrderQuantity: 22,
    lastPaymentDate: "2026-05-30",
    notes: ["Reorder every Tuesday", "Prefers 500ml only"]
  },
  {
    id: "CL-003",
    clientName: "City Corner",
    ownerName: "Patrick N.",
    phone: "0788000003",
    area: "Remera",
    assignedMarketer: "Marketer 1",
    currentBalance: 18500,
    lastOrderDate: "2026-05-28",
    lastOrderQuantity: 18,
    lastPaymentDate: "2026-05-27",
    notes: ["Call before delivery"]
  }
];

function readJson<T>(key: string, fallback: T): T {
  const rawValue = window.localStorage.getItem(key);

  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    window.localStorage.removeItem(key);
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

export function getCallCenterClients() {
  const clients = readJson<CallCenterClient[]>(CLIENTS_KEY, defaultClients);
  writeJson(CLIENTS_KEY, clients);
  return clients;
}

export function saveClientNotes(clientId: string, notes: string[]) {
  const clients = getCallCenterClients().map((client) =>
    client.id === clientId ? { ...client, notes } : client
  );
  writeJson(CLIENTS_KEY, clients);
  return clients;
}

export function getCallLogs() {
  return readJson<CallLog[]>(CALL_LOGS_KEY, []);
}

export function addCallLog(input: Omit<CallLog, "id" | "agent">, user: SessionUser) {
  const record: CallLog = {
    ...input,
    id: createId("CALL"),
    agent: user.displayName
  };
  const records = [record, ...getCallLogs()];
  writeJson(CALL_LOGS_KEY, records);
  return records;
}

export function getPendingOrders() {
  return readJson<PendingOrder[]>(ORDERS_KEY, []);
}

export function addPendingOrder(
  client: CallCenterClient,
  input: Pick<PendingOrder, "product" | "quantity" | "deliveryDate" | "notes">,
  user: SessionUser
) {
  const record: PendingOrder = {
    ...input,
    id: createId("ORD"),
    clientId: client.id,
    clientName: client.clientName,
    phone: client.phone,
    area: client.area,
    status: "Pending Storekeeper",
    createdBy: user.displayName,
    createdAt: new Date().toISOString()
  };
  const records = [record, ...getPendingOrders()];
  writeJson(ORDERS_KEY, records);
  return records;
}

export function getPaymentFollowUps() {
  return readJson<PaymentFollowUp[]>(PAYMENT_FOLLOW_UPS_KEY, []);
}

export function addPaymentFollowUp(
  client: CallCenterClient,
  input: Omit<PaymentFollowUp, "id" | "clientId" | "clientName" | "agent" | "createdAt">,
  user: SessionUser
) {
  const record: PaymentFollowUp = {
    ...input,
    id: createId("PAY"),
    clientId: client.id,
    clientName: client.clientName,
    agent: user.displayName,
    createdAt: new Date().toISOString()
  };
  const records = [record, ...getPaymentFollowUps()];
  writeJson(PAYMENT_FOLLOW_UPS_KEY, records);
  return records;
}

export function getComplaints() {
  return readJson<ComplaintRecord[]>(COMPLAINTS_KEY, []);
}

export function addComplaint(
  client: CallCenterClient,
  input: Omit<ComplaintRecord, "id" | "clientId" | "clientName" | "agent" | "createdAt">,
  user: SessionUser
) {
  const record: ComplaintRecord = {
    ...input,
    id: createId("COMP"),
    clientId: client.id,
    clientName: client.clientName,
    agent: user.displayName,
    createdAt: new Date().toISOString()
  };
  const records = [record, ...getComplaints()];
  writeJson(COMPLAINTS_KEY, records);
  return records;
}

export function getScheduledFollowUps() {
  return readJson<ScheduledFollowUp[]>(FOLLOW_UPS_KEY, []);
}

export function addScheduledFollowUp(
  client: CallCenterClient,
  input: Omit<ScheduledFollowUp, "id" | "clientId" | "clientName" | "status">,
) {
  const record: ScheduledFollowUp = {
    ...input,
    id: createId("FUP"),
    clientId: client.id,
    clientName: client.clientName,
    status: "Scheduled"
  };
  const records = [record, ...getScheduledFollowUps()];
  writeJson(FOLLOW_UPS_KEY, records);
  return records;
}
