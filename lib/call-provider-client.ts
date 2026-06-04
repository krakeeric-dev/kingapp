import type { SessionUser } from "@/lib/auth";
import {
  getQueueCalls,
  saveQueueCalls,
  type QueueCall
} from "@/lib/call-center-data";
import { getCompanyClients } from "@/lib/call-center-operations";
import { getCallCenterNumbers } from "@/lib/call-center-numbers";

type ProviderPollResponse = {
  ok: boolean;
  calls?: Array<{
    callerNumber: string;
    calledNumber: string;
    provider: string;
    callId: string;
    timestamp: string;
  }>;
};

function phoneKey(value: string) {
  return value.replace(/\D/g, "");
}

export async function importIncomingProviderCalls(user: SessionUser) {
  const response = await fetch("/api/call-center/incoming-call", {
    cache: "no-store"
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as ProviderPollResponse;
  const providerCalls = payload.calls ?? [];
  const existingCalls = getQueueCalls();
  const existingIds = new Set(existingCalls.map((call) => call.id));
  const clients = getCompanyClients(user);
  const numbers = getCallCenterNumbers();
  const importedCalls: QueueCall[] = [];

  providerCalls.forEach((providerCall) => {
    const callId = providerCall.callId || `PROVIDER-${providerCall.timestamp}`;
    if (existingIds.has(callId)) return;

    const client = clients.find((item) => phoneKey(item.phone) === phoneKey(providerCall.callerNumber));
    const calledNumber = numbers.find((item) => phoneKey(item.phoneNumber) === phoneKey(providerCall.calledNumber));
    const companyId = client?.companyId ?? calledNumber?.companyId ?? user.companyId;
    const companyName = client?.companyName ?? calledNumber?.companyName ?? user.companyName;
    const call: QueueCall = {
      id: callId,
      companyId,
      companyName,
      clientId: client?.id ?? `UNKNOWN-${callId}`,
      clientName: client?.clientName ?? "Unknown Caller",
      phone: providerCall.callerNumber,
      location: client?.area ?? "Unknown location",
      currentBalance: client?.currentBalance ?? 0,
      lastOrder: client ? `${client.lastOrderQuantity} cartons on ${client.lastOrderDate}` : "No order history",
      assignedMarketer: client?.assignedMarketer ?? "Unassigned",
      callReason: client ? "Customer Care" : "New Client Prospect",
      status: "Incoming",
      startedAt: providerCall.timestamp || new Date().toISOString(),
      notes: [
        `Provider: ${providerCall.provider || "Unknown Provider"}`,
        `Called number: ${providerCall.calledNumber}`,
        client ? "Client matched by phone number" : "Unknown caller"
      ]
    };
    importedCalls.push(call);
    existingIds.add(call.id);
  });

  if (importedCalls.length) {
    saveQueueCalls([...importedCalls, ...existingCalls]);
  }

  return importedCalls;
}
