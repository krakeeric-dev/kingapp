import {
  addCallLog,
  getAgents,
  getCallCenterClients,
  getCallDuration,
  getQueueCalls,
  saveAgents,
  saveQueueCalls,
  type CallCenterAgent,
  type QueueCall
} from "@/lib/call-center-data";
import {
  getProviderAdapter,
  type TelephonyProvider,
  type WebhookPayload
} from "@/lib/providerAdapters";
import { getUnknownCompanyCallLabel, routeCallByInboundNumber } from "@/lib/company-call-routing";

export type TelephonySettings = {
  provider: TelephonyProvider;
  providerName: string;
  apiKey: string;
  sipServer: string;
  webhookUrl: string;
  companyPhoneNumber: string;
  providerStatus?: "Connected" | "Not Connected";
  defaultQueue: string;
  recordingEnabled: boolean;
  callPopupEnabled: boolean;
};

export type DeviceMapping = {
  id: string;
  extension: string;
  agent: string;
  deviceType: "IP Phone" | "Browser" | "Mobile" | "Fixed Line Gateway";
  deviceName: string;
  status: "Online" | "Offline" | "Provisioning";
  lastSeen: string;
};

export type CallRecording = {
  id: string;
  callId: string;
  recordingStatus: "Not Connected" | "Pending" | "Ready";
  recordingUrl: string;
  duration: string;
  agent: string;
  client: string;
  notes: string;
};

const SETTINGS_KEY = "kingapp.telephony.settings";
const DEVICES_KEY = "kingapp.telephony.devices";
const RECORDINGS_KEY = "kingapp.telephony.recordings";

const defaultSettings: TelephonySettings = {
  provider: "Manual Mode",
  providerName: "Manual Mode",
  apiKey: "",
  sipServer: "",
  webhookUrl: "/api/call-center/incoming-call",
  companyPhoneNumber: "+250 788 000 000",
  providerStatus: "Not Connected",
  defaultQueue: "Sales Queue",
  recordingEnabled: false,
  callPopupEnabled: true
};

const defaultDevices: DeviceMapping[] = [
  { id: "DEV-101", extension: "101", agent: "Alice Agent", deviceType: "Browser", deviceName: "Chrome Softphone", status: "Online", lastSeen: "Just now" },
  { id: "DEV-102", extension: "102", agent: "Eric Agent", deviceType: "IP Phone", deviceName: "Yealink T31P", status: "Online", lastSeen: "2 min ago" },
  { id: "DEV-103", extension: "103", agent: "Chantal Agent", deviceType: "Mobile", deviceName: "3CX Mobile App", status: "Online", lastSeen: "5 min ago" },
  { id: "DEV-104", extension: "104", agent: "David Agent", deviceType: "Fixed Line Gateway", deviceName: "Office Gateway 1", status: "Provisioning", lastSeen: "Today 09:15" }
];

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const rawValue = window.localStorage.getItem(key);
  if (!rawValue) return fallback;
  try {
    return JSON.parse(rawValue) as T;
  } catch {
    window.localStorage.removeItem(key);
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

export function getTelephonySettings() {
  return { ...defaultSettings, ...readJson<Partial<TelephonySettings>>(SETTINGS_KEY, defaultSettings) };
}

export function saveTelephonySettings(settings: TelephonySettings) {
  writeJson(SETTINGS_KEY, settings);
  return settings;
}

export function getDeviceMappings() {
  const devices = readJson<DeviceMapping[]>(DEVICES_KEY, defaultDevices);
  writeJson(DEVICES_KEY, devices);
  return devices;
}

export function getCallRecordings() {
  const calls = getQueueCalls();
  const existing = readJson<CallRecording[]>(RECORDINGS_KEY, []);
  if (existing.length > 0) return existing;
  const seeded = calls.slice(0, 4).map((call) => ({
    id: createId("REC"),
    callId: call.id,
    recordingStatus: "Not Connected" as const,
    recordingUrl: "",
    duration: call.acceptedAt ? getCallDuration(call.acceptedAt, call.endedAt) : "0:00",
    agent: call.assignedAgent ?? "Unassigned",
    client: call.clientName,
    notes: "Recording not connected yet"
  }));
  writeJson(RECORDINGS_KEY, seeded);
  return seeded;
}

export function recognizeClientByPhone(phone: string) {
  const normalizedPhone = phone.replace(/\D/g, "");
  return (
    getCallCenterClients().find(
      (client) => client.phone.replace(/\D/g, "") === normalizedPhone
    ) ?? null
  );
}

export async function processTelephonyWebhook(payload: WebhookPayload) {
  const settings = getTelephonySettings();
  await getProviderAdapter(settings.provider).handleWebhookEvent(payload);

  const now = new Date().toISOString();
  const event = normalizeWebhookEvent(payload.event);
  const fromNumber = payload.fromNumber ?? payload.phone;
  const route = routeCallByInboundNumber(payload.toNumber);
  const client = recognizeClientByPhone(fromNumber);
  const companyId = payload.companyId ?? route?.companyId ?? client?.companyId;
  const companyName = payload.companyName ?? route?.companyName ?? client?.companyName ?? getUnknownCompanyCallLabel();
  const calls = getQueueCalls();
  const existingCall = payload.callId
    ? calls.find((call) => call.id === payload.callId)
    : calls.find((call) => call.phone === fromNumber && call.status !== "Closed");

  if (event === "incoming_call") {
    const call: QueueCall = {
      id: payload.callId ?? createId("QCALL"),
      clientId: client?.id ?? "UNKNOWN",
      companyId,
      companyName,
      clientName: client?.clientName ?? "Unknown Caller",
      phone: fromNumber,
      location: client?.area ?? "Unknown",
      currentBalance: client?.currentBalance ?? 0,
      lastOrder: client ? `${client.lastOrderQuantity} cartons on ${client.lastOrderDate}` : "No history",
      assignedMarketer: client?.assignedMarketer ?? "Unassigned",
      callReason: client ? "Customer Care" : "New Client Prospect",
      status: "Incoming",
      startedAt: now,
      notes: [
        client ? "Client auto-recognized" : "Unknown caller",
        route ? `Routed by inbound number ${payload.toNumber}` : "Unknown Company Call"
      ]
    };
    saveQueueCalls([call, ...calls]);
    return { call, client };
  }

  if (!existingCall) return { call: null, client };

  const updatedCalls = calls.map((call) => {
    if (call.id !== existingCall.id) return call;
    if (event === "call_answered") {
      return { ...call, status: "Active" as const, assignedAgent: payload.agentName ?? call.assignedAgent, acceptedAt: now, companyId: companyId ?? call.companyId, companyName: companyName ?? call.companyName };
    }
    if (event === "call_ended") {
      return { ...call, status: "Closed" as const, endedAt: now };
    }
    if (event === "call_missed") {
      return { ...call, status: "Missed" as const, endedAt: now };
    }
    if (event === "call_transferred") {
      return { ...call, status: "Transferred" as const, transferTo: payload.transferTo };
    }
    return call;
  });

  saveQueueCalls(updatedCalls);

  if (event === "call_answered" && payload.agentName) {
    saveAgents(
      getAgents().map((agent) =>
        agent.name === payload.agentName ? { ...agent, status: "On Call" } : agent
      )
    );
  }

  if (event === "call_ended") {
    addCallLog(
      {
        date: now.slice(0, 10),
        time: new Date(now).toTimeString().slice(0, 5),
        clientId: existingCall.clientId,
        clientName: existingCall.clientName,
        phone: existingCall.phone,
        callType: existingCall.callReason,
        duration: getCallDuration(existingCall.acceptedAt ?? existingCall.startedAt, now),
        outcome: "Closed",
        nextAction: "Ended from webhook simulation"
      },
      {
        id: `USER-${(payload.agentName ?? "Telephony").toUpperCase().replace(/\s+/g, "-")}`,
        username: payload.agentName ?? "Telephony",
        name: payload.agentName ?? "Telephony",
        displayName: payload.agentName ?? "Telephony",
        role: "callcenter",
        companyId: existingCall.companyId ?? "COMP-AGAHOZO",
        companyName: existingCall.companyName ?? "Agahozo Water",
        assignedCompanies: [existingCall.companyId ?? "COMP-AGAHOZO"],
        phone: "",
        email: "",
        status: "active",
        createdAt: now,
        updatedAt: now
      }
    );
  }

  if (event === "recording_available") {
    const recordings = getCallRecordings();
    writeJson(RECORDINGS_KEY, [
      {
        id: createId("REC"),
        callId: existingCall.id,
        recordingStatus: "Ready",
        recordingUrl: payload.recordingUrl ?? "https://recordings.example.com/mock-call.mp3",
        duration: getCallDuration(existingCall.acceptedAt ?? existingCall.startedAt, existingCall.endedAt),
        agent: existingCall.assignedAgent ?? payload.agentName ?? "Unassigned",
        client: existingCall.clientName,
        notes: "Mock recording placeholder"
      },
      ...recordings
    ]);
  }

  return { call: updatedCalls.find((call) => call.id === existingCall.id) ?? null, client };
}

function normalizeWebhookEvent(event: WebhookPayload["event"]) {
  if (event === "answered") return "call_answered";
  if (event === "missed") return "call_missed";
  if (event === "transferred") return "call_transferred";
  if (event === "ended") return "call_ended";
  if (event === "call_recording_ready" || event === "recording_ready") return "recording_available";
  return event;
}

export function updateAgentPhoneType(agentId: string, phoneType: NonNullable<CallCenterAgent["phoneType"]>) {
  return saveAgents(
    getAgents().map((agent) => (agent.id === agentId ? { ...agent, phoneType } : agent))
  );
}
