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

export type AgentStatus = "Available" | "Ringing" | "On Call" | "Away" | "Offline";

export type CallCenterAgent = {
  id: string;
  name: string;
  extension: string;
  status: AgentStatus;
};

export type QueueCallStatus = "Incoming" | "Waiting" | "Active" | "Missed" | "Transferred" | "Closed";

export type QueueCall = {
  id: string;
  clientId: string;
  clientName: string;
  phone: string;
  location: string;
  currentBalance: number;
  lastOrder: string;
  assignedMarketer: string;
  callReason: CallType;
  status: QueueCallStatus;
  assignedAgent?: string;
  startedAt: string;
  acceptedAt?: string;
  endedAt?: string;
  transferTo?: "Supervisor" | "Accountant" | "Storekeeper" | "Manager";
  notes: string[];
};

export type MissedCallStatus = "Not Called Back" | "Called Back" | "No Answer" | "Converted to Order";

export type MissedCall = {
  id: string;
  date: string;
  time: string;
  caller: string;
  phone: string;
  reason: string;
  status: MissedCallStatus;
  clientId?: string;
};

export type CallbackPriority = "Low" | "Medium" | "High" | "Urgent";

export type CallbackItem = {
  id: string;
  clientId: string;
  clientName: string;
  phone: string;
  callbackDate: string;
  callbackTime: string;
  reason: string;
  assignedAgent: string;
  priority: CallbackPriority;
  status: "Pending" | "Done" | "No Answer" | "Converted to Order";
};

const CLIENTS_KEY = "kingapp.callCenter.clients";
const CALL_LOGS_KEY = "kingapp.callCenter.callLogs";
const ORDERS_KEY = "kingapp.callCenter.pendingOrders";
const PAYMENT_FOLLOW_UPS_KEY = "kingapp.callCenter.paymentFollowUps";
const COMPLAINTS_KEY = "kingapp.callCenter.complaints";
const FOLLOW_UPS_KEY = "kingapp.callCenter.followUps";
const AGENTS_KEY = "kingapp.callCenter.agents";
const QUEUE_CALLS_KEY = "kingapp.callCenter.queueCalls";
const MISSED_CALLS_KEY = "kingapp.callCenter.missedCalls";
const CALLBACKS_KEY = "kingapp.callCenter.callbacks";

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
  },
  {
    id: "CL-004",
    clientName: "Green Valley Bar",
    ownerName: "Eric M.",
    phone: "0788000004",
    area: "Kacyiru",
    assignedMarketer: "Marketer 2",
    currentBalance: 76000,
    lastOrderDate: "2026-05-31",
    lastOrderQuantity: 42,
    lastPaymentDate: "2026-05-25",
    notes: ["High priority account", "Prefers afternoon delivery"]
  },
  {
    id: "CL-005",
    clientName: "Blue Star Mini Market",
    ownerName: "Diane K.",
    phone: "0788000005",
    area: "Gikondo",
    assignedMarketer: "Marketer 2",
    currentBalance: 9500,
    lastOrderDate: "2026-05-30",
    lastOrderQuantity: 15,
    lastPaymentDate: "2026-05-30",
    notes: ["Needs invoice copy by WhatsApp"]
  },
  {
    id: "CL-006",
    clientName: "Hilltop Restaurant",
    ownerName: "Claude H.",
    phone: "0788000006",
    area: "Kibagabaga",
    assignedMarketer: "Marketer 3",
    currentBalance: 0,
    lastOrderDate: "2026-05-29",
    lastOrderQuantity: 28,
    lastPaymentDate: "2026-05-29",
    notes: ["Owner available after 10 AM"]
  },
  {
    id: "CL-007",
    clientName: "Peace Corner Shop",
    ownerName: "Vestine U.",
    phone: "0788000007",
    area: "Kanombe",
    assignedMarketer: "Marketer 3",
    currentBalance: 31500,
    lastOrderDate: "2026-05-27",
    lastOrderQuantity: 20,
    lastPaymentDate: "2026-05-26",
    notes: ["Payment promise every Saturday"]
  },
  {
    id: "CL-008",
    clientName: "Express Kiosk",
    ownerName: "Mugisha P.",
    phone: "0788000008",
    area: "Nyarutarama",
    assignedMarketer: "Marketer 1",
    currentBalance: 12500,
    lastOrderDate: "2026-05-31",
    lastOrderQuantity: 12,
    lastPaymentDate: "2026-05-31",
    notes: ["Small shop but frequent reorders"]
  },
  {
    id: "CL-009",
    clientName: "Airport Lounge Supply",
    ownerName: "Grace N.",
    phone: "0788000009",
    area: "Kabeza",
    assignedMarketer: "Marketer 2",
    currentBalance: 98000,
    lastOrderDate: "2026-05-28",
    lastOrderQuantity: 60,
    lastPaymentDate: "2026-05-24",
    notes: ["Needs supervisor approval for complaints"]
  },
  {
    id: "CL-010",
    clientName: "Downtown Wholesale",
    ownerName: "Samuel B.",
    phone: "0788000010",
    area: "CBD",
    assignedMarketer: "Marketer 1",
    currentBalance: 0,
    lastOrderDate: "2026-05-31",
    lastOrderQuantity: 80,
    lastPaymentDate: "2026-05-31",
    notes: ["Bulk account", "Reorder every Monday"]
  }
];

const defaultAgents: CallCenterAgent[] = [
  { id: "AG-001", name: "Alice Agent", extension: "201", status: "Available" },
  { id: "AG-002", name: "Bertin Agent", extension: "202", status: "On Call" },
  { id: "AG-003", name: "Chantal Agent", extension: "203", status: "Available" },
  { id: "AG-004", name: "David Agent", extension: "204", status: "Away" },
  { id: "AG-005", name: "Esther Agent", extension: "205", status: "Offline" }
];

const defaultQueueCalls: QueueCall[] = [
  {
    id: "QCALL-001",
    clientId: "CL-001",
    clientName: "Kigali Mart",
    phone: "0788000001",
    location: "Nyamirambo",
    currentBalance: 42000,
    lastOrder: "35 cartons on 2026-05-31",
    assignedMarketer: "Marketer 1",
    callReason: "Reorder",
    status: "Incoming",
    startedAt: new Date(Date.now() - 45_000).toISOString(),
    notes: ["Likely reorder call"]
  },
  {
    id: "QCALL-002",
    clientId: "CL-004",
    clientName: "Green Valley Bar",
    phone: "0788000004",
    location: "Kacyiru",
    currentBalance: 76000,
    lastOrder: "42 cartons on 2026-05-31",
    assignedMarketer: "Marketer 2",
    callReason: "Payment Follow-up",
    status: "Waiting",
    startedAt: new Date(Date.now() - 240_000).toISOString(),
    notes: ["Balance is overdue"]
  },
  {
    id: "QCALL-003",
    clientId: "CL-009",
    clientName: "Airport Lounge Supply",
    phone: "0788000009",
    location: "Kabeza",
    currentBalance: 98000,
    lastOrder: "60 cartons on 2026-05-28",
    assignedMarketer: "Marketer 2",
    callReason: "Complaint",
    status: "Waiting",
    startedAt: new Date(Date.now() - 120_000).toISOString(),
    notes: ["Possible short delivery complaint"]
  },
  {
    id: "QCALL-004",
    clientId: "CL-002",
    clientName: "Sunrise Shop",
    phone: "0788000002",
    location: "Kimironko",
    currentBalance: 0,
    lastOrder: "22 cartons on 2026-05-30",
    assignedMarketer: "Marketer 1",
    callReason: "Customer Care",
    status: "Active",
    assignedAgent: "Bertin Agent",
    startedAt: new Date(Date.now() - 360_000).toISOString(),
    acceptedAt: new Date(Date.now() - 300_000).toISOString(),
    notes: ["Checking delivery satisfaction"]
  },
  {
    id: "QCALL-005",
    clientId: "CL-007",
    clientName: "Peace Corner Shop",
    phone: "0788000007",
    location: "Kanombe",
    currentBalance: 31500,
    lastOrder: "20 cartons on 2026-05-27",
    assignedMarketer: "Marketer 3",
    callReason: "Payment Follow-up",
    status: "Missed",
    startedAt: new Date(Date.now() - 1_800_000).toISOString(),
    notes: ["No available agent"]
  },
  {
    id: "QCALL-006",
    clientId: "CL-010",
    clientName: "Downtown Wholesale",
    phone: "0788000010",
    location: "CBD",
    currentBalance: 0,
    lastOrder: "80 cartons on 2026-05-31",
    assignedMarketer: "Marketer 1",
    callReason: "New Order",
    status: "Incoming",
    startedAt: new Date(Date.now() - 20_000).toISOString(),
    notes: ["Bulk reorder account"]
  }
];

const defaultMissedCalls: MissedCall[] = [
  { id: "MIS-001", date: "2026-06-01", time: "09:20", caller: "Peace Corner Shop", phone: "0788000007", reason: "Payment Follow-up", status: "Not Called Back", clientId: "CL-007" },
  { id: "MIS-002", date: "2026-06-01", time: "10:12", caller: "Unknown Caller", phone: "0788111222", reason: "New Client Prospect", status: "No Answer" },
  { id: "MIS-003", date: "2026-05-31", time: "16:42", caller: "City Corner", phone: "0788000003", reason: "Reorder", status: "Called Back", clientId: "CL-003" }
];

const defaultCallbacks: CallbackItem[] = [
  { id: "CB-001", clientId: "CL-004", clientName: "Green Valley Bar", phone: "0788000004", callbackDate: "2026-06-01", callbackTime: "14:30", reason: "Payment promise follow-up", assignedAgent: "Alice Agent", priority: "Urgent", status: "Pending" },
  { id: "CB-002", clientId: "CL-006", clientName: "Hilltop Restaurant", phone: "0788000006", callbackDate: "2026-06-01", callbackTime: "15:00", reason: "Confirm reorder", assignedAgent: "Chantal Agent", priority: "Medium", status: "Pending" },
  { id: "CB-003", clientId: "CL-008", clientName: "Express Kiosk", phone: "0788000008", callbackDate: "2026-06-02", callbackTime: "09:00", reason: "Morning delivery preference", assignedAgent: "Alice Agent", priority: "Low", status: "Pending" }
];

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

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
  if (typeof window === "undefined") {
    return;
  }

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

export function getAgents() {
  const agents = readJson<CallCenterAgent[]>(AGENTS_KEY, defaultAgents);
  writeJson(AGENTS_KEY, agents);
  return agents;
}

export function saveAgents(agents: CallCenterAgent[]) {
  writeJson(AGENTS_KEY, agents);
  return agents;
}

export function updateAgentStatus(agentId: string, status: AgentStatus) {
  const agents = getAgents().map((agent) =>
    agent.id === agentId ? { ...agent, status } : agent
  );
  return saveAgents(agents);
}

export function getQueueCalls() {
  const calls = readJson<QueueCall[]>(QUEUE_CALLS_KEY, defaultQueueCalls);
  writeJson(QUEUE_CALLS_KEY, calls);
  return calls;
}

export function saveQueueCalls(calls: QueueCall[]) {
  writeJson(QUEUE_CALLS_KEY, calls);
  return calls;
}

export function getMissedCalls() {
  const calls = readJson<MissedCall[]>(MISSED_CALLS_KEY, defaultMissedCalls);
  writeJson(MISSED_CALLS_KEY, calls);
  return calls;
}

export function saveMissedCalls(calls: MissedCall[]) {
  writeJson(MISSED_CALLS_KEY, calls);
  return calls;
}

export function getCallbacks() {
  const callbacks = readJson<CallbackItem[]>(CALLBACKS_KEY, defaultCallbacks);
  writeJson(CALLBACKS_KEY, callbacks);
  return callbacks;
}

export function saveCallbacks(callbacks: CallbackItem[]) {
  writeJson(CALLBACKS_KEY, callbacks);
  return callbacks;
}

export function sendCallToQueue(callId: string) {
  return saveQueueCalls(
    getQueueCalls().map((call) =>
      call.id === callId ? { ...call, status: "Waiting", notes: ["Sent to waiting queue", ...call.notes] } : call
    )
  );
}

export function acceptQueueCall(callId: string, agentName: string) {
  const acceptedAt = new Date().toISOString();
  const calls = saveQueueCalls(
    getQueueCalls().map((call) =>
      call.id === callId
        ? {
            ...call,
            status: "Active",
            assignedAgent: agentName,
            acceptedAt,
            notes: [`Accepted by ${agentName}`, ...call.notes]
          }
        : call
    )
  );
  saveAgents(
    getAgents().map((agent) =>
      agent.name === agentName ? { ...agent, status: "On Call" } : agent
    )
  );
  return calls;
}

export function markCallMissed(callId: string, reason = "No available agent") {
  const target = getQueueCalls().find((call) => call.id === callId);
  const calls = saveQueueCalls(
    getQueueCalls().map((call) =>
      call.id === callId ? { ...call, status: "Missed", notes: [reason, ...call.notes] } : call
    )
  );

  if (target) {
    const date = new Date();
    saveMissedCalls([
      {
        id: createId("MIS"),
        date: date.toISOString().slice(0, 10),
        time: date.toTimeString().slice(0, 5),
        caller: target.clientName,
        phone: target.phone,
        reason,
        status: "Not Called Back",
        clientId: target.clientId
      },
      ...getMissedCalls()
    ]);
  }

  return calls;
}

export function transferCall(callId: string, transferTo: QueueCall["transferTo"], agentName: string) {
  return saveQueueCalls(
    getQueueCalls().map((call) =>
      call.id === callId
        ? {
            ...call,
            status: "Transferred",
            transferTo,
            notes: [`Transferred to ${transferTo} by ${agentName}`, ...call.notes]
          }
        : call
    )
  );
}

export function closeActiveCall(callId: string, agentName: string, outcome: CallStatus = "Closed") {
  const endedAt = new Date().toISOString();
  const call = getQueueCalls().find((item) => item.id === callId);
  const calls = saveQueueCalls(
    getQueueCalls().map((item) =>
      item.id === callId ? { ...item, status: "Closed", endedAt, notes: ["Call closed", ...item.notes] } : item
    )
  );
  saveAgents(
    getAgents().map((agent) =>
      agent.name === agentName ? { ...agent, status: "Available" } : agent
    )
  );

  if (call) {
    addCallLog(
      {
        date: endedAt.slice(0, 10),
        time: new Date(endedAt).toTimeString().slice(0, 5),
        clientId: call.clientId,
        clientName: call.clientName,
        phone: call.phone,
        callType: call.callReason,
        duration: getCallDuration(call.acceptedAt ?? call.startedAt, endedAt),
        outcome,
        nextAction: call.transferTo ? `Transferred to ${call.transferTo}` : "Call completed"
      },
      {
        username: agentName,
        displayName: agentName,
        role: "callcenter",
        phone: "",
        email: "",
        status: "active",
        createdAt: endedAt,
        updatedAt: endedAt
      }
    );
  }

  return calls;
}

export function addActiveCallNote(callId: string, note: string) {
  return saveQueueCalls(
    getQueueCalls().map((call) =>
      call.id === callId ? { ...call, notes: [note, ...call.notes] } : call
    )
  );
}

export function updateMissedCallStatus(callId: string, status: MissedCallStatus) {
  return saveMissedCalls(
    getMissedCalls().map((call) =>
      call.id === callId ? { ...call, status } : call
    )
  );
}

export function addCallback(input: Omit<CallbackItem, "id">) {
  const records = [{ ...input, id: createId("CB") }, ...getCallbacks()];
  return saveCallbacks(records);
}

export function updateCallbackStatus(callbackId: string, status: CallbackItem["status"]) {
  return saveCallbacks(
    getCallbacks().map((callback) =>
      callback.id === callbackId ? { ...callback, status } : callback
    )
  );
}

export function getCallDuration(start: string, end = new Date().toISOString()) {
  const milliseconds = Math.max(0, new Date(end).getTime() - new Date(start).getTime());
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function getAverageWaitSeconds(calls: QueueCall[]) {
  const waiting = calls.filter((call) => call.status === "Waiting");
  if (waiting.length === 0) return 0;

  const total = waiting.reduce(
    (sum, call) => sum + Math.floor((Date.now() - new Date(call.startedAt).getTime()) / 1000),
    0
  );
  return Math.round(total / waiting.length);
}
