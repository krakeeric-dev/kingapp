import type { SessionUser } from "@/lib/auth";
import { logAuditEvent } from "@/lib/loading-data";

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
  companyId?: string;
  companyName?: string;
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
  companyId?: string;
  companyName?: string;
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
  companyId?: string;
  companyName?: string;
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
  companyId?: string;
  companyName?: string;
  clientId: string;
  clientName: string;
  complaintNumber?: string;
  complaintType: string;
  product: string;
  quantity: number;
  description: string;
  priority: string;
  assignedTo?: string;
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
export type AgentPhoneType =
  | "Browser Softphone"
  | "IP Desk Phone"
  | "Mobile App"
  | "Fixed Line";

export type CallCenterAgent = {
  id: string;
  companyId?: string;
  companyName?: string;
  name: string;
  extension: string;
  status: AgentStatus;
  phoneType?: AgentPhoneType;
};

export type QueueCallStatus = "Incoming" | "Waiting" | "Active" | "Missed" | "Transferred" | "Closed";

export type QueueCall = {
  id: string;
  companyId?: string;
  companyName?: string;
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

const _defaultClients: CallCenterClient[] = [];

const _defaultAgents: CallCenterAgent[] = [];

const _defaultQueueCalls: QueueCall[] = [];

const _defaultMissedCalls: MissedCall[] = [];

const _defaultCallbacks: CallbackItem[] = [];

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

function withoutSeedRecords<T extends { id: string }>(key: string, records: T[], seedIds: string[]) {
  const seedSet = new Set(seedIds);
  const filtered = records.filter((record) => !seedSet.has(record.id));
  if (filtered.length !== records.length) {
    writeJson(key, filtered);
  }
  return filtered;
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

export function getCallCenterClients() {
  const clients = readJson<CallCenterClient[]>(CLIENTS_KEY, []);
  return withoutSeedRecords(CLIENTS_KEY, clients, _defaultClients.map((client) => client.id));
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
  logAuditEvent({
    action: "call_logged",
    companyId: user.companyId,
    companyName: user.companyName,
    module: "Customer Care & Relationship Management (CCRM)",
    newValue: record,
    recordId: record.id,
    reason: "Call logged",
    status: "success",
    user
  });
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
    companyId: client.companyId,
    companyName: client.companyName,
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
  logAuditEvent({
    action: "order_created",
    companyId: record.companyId,
    companyName: record.companyName,
    module: "Customer Care & Relationship Management (CCRM) Orders",
    newValue: record,
    recordId: record.id,
    reason: "CCRM order created",
    status: "success",
    user
  });
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
    companyId: client.companyId,
    companyName: client.companyName,
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
    companyId: client.companyId,
    companyName: client.companyName,
    clientId: client.id,
    clientName: client.clientName,
    complaintNumber: createId("CMP"),
    agent: user.displayName,
    createdAt: new Date().toISOString()
  };
  const records = [record, ...getComplaints()];
  writeJson(COMPLAINTS_KEY, records);
  logAuditEvent({
    action: "complaint_created",
    companyId: record.companyId,
    companyName: record.companyName,
    module: "Complaints",
    newValue: record,
    recordId: record.id,
    reason: "Complaint created",
    status: "success",
    user
  });
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
  const agents = readJson<CallCenterAgent[]>(AGENTS_KEY, []);
  return withoutSeedRecords(AGENTS_KEY, agents, _defaultAgents.map((agent) => agent.id));
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
  const calls = readJson<QueueCall[]>(QUEUE_CALLS_KEY, []);
  return withoutSeedRecords(QUEUE_CALLS_KEY, calls, _defaultQueueCalls.map((call) => call.id));
}

export function saveQueueCalls(calls: QueueCall[]) {
  writeJson(QUEUE_CALLS_KEY, calls);
  return calls;
}

export function getMissedCalls() {
  const calls = readJson<MissedCall[]>(MISSED_CALLS_KEY, []);
  return withoutSeedRecords(MISSED_CALLS_KEY, calls, _defaultMissedCalls.map((call) => call.id));
}

export function saveMissedCalls(calls: MissedCall[]) {
  writeJson(MISSED_CALLS_KEY, calls);
  return calls;
}

export function getCallbacks() {
  const callbacks = readJson<CallbackItem[]>(CALLBACKS_KEY, []);
  return withoutSeedRecords(CALLBACKS_KEY, callbacks, _defaultCallbacks.map((callback) => callback.id));
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
        id: `USER-${agentName.toUpperCase().replace(/\s+/g, "-")}`,
        username: agentName,
        name: agentName,
        displayName: agentName,
        role: "callcenter",
        companyId: call.companyId ?? "COMP-AGAHOZO",
        companyName: call.companyName ?? "No company selected",
        assignedCompanies: [call.companyId ?? "COMP-AGAHOZO"],
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
