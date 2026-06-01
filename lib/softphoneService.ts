import { getProviderAdapter } from "@/lib/providerAdapters";
import { getTelephonySettings } from "@/lib/telephonyService";

export type SoftphoneState = {
  callerId: string;
  status: "Idle" | "Dialing" | "Ringing" | "Connected" | "Hold" | "Muted" | "Ended";
  timer: string;
  agentStatus: string;
};

export const defaultSoftphoneState: SoftphoneState = {
  callerId: "",
  status: "Idle",
  timer: "00:00:00",
  agentStatus: "Available"
};

export async function mockSoftphoneAction(action: string, phoneOrCallId = "") {
  const settings = getTelephonySettings();
  const adapter = getProviderAdapter(settings.provider);

  if (action === "dial") return adapter.makeCall(phoneOrCallId);
  if (action === "answer") return adapter.answerCall(phoneOrCallId || "mock-call");
  if (action === "hold") return adapter.holdCall(phoneOrCallId || "mock-call");
  if (action === "transfer") return adapter.transferCall(phoneOrCallId || "mock-call", "Supervisor");
  if (action === "end") return adapter.endCall(phoneOrCallId || "mock-call");

  console.log(`[KingApp Softphone] Mock ${action}`);
  return { ok: true, provider: settings.provider, message: `Mock ${action}` };
}
