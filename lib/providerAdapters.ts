import type { QueueCall } from "@/lib/call-center-data";

export type TelephonyProvider =
  | "3CX"
  | "Twilio"
  | "Asterisk / FreePBX"
  | "Asterisk / SIP"
  | "SIP Provider"
  | "Manual Mode";

export type TelephonyActionResult = {
  ok: boolean;
  provider: TelephonyProvider;
  message: string;
  call?: QueueCall;
};

export type TelephonyWebhookEvent =
  | "incoming_call"
  | "call_answered"
  | "call_ended"
  | "call_missed"
  | "call_transferred"
  | "call_recording_ready"
  | "recording_ready"
  | "recording_available";

export type WebhookPayload = {
  event: TelephonyWebhookEvent;
  phone: string;
  agentName?: string;
  callId?: string;
  transferTo?: QueueCall["transferTo"];
  recordingUrl?: string;
  provider?: string;
  duration?: string;
};

export interface TelephonyAdapter {
  provider: TelephonyProvider;
  makeCall(phone: string): Promise<TelephonyActionResult>;
  answerCall(callId: string): Promise<TelephonyActionResult>;
  endCall(callId: string): Promise<TelephonyActionResult>;
  holdCall(callId: string): Promise<TelephonyActionResult>;
  resumeCall(callId: string): Promise<TelephonyActionResult>;
  transferCall(callId: string, target: string): Promise<TelephonyActionResult>;
  getCallStatus(callId: string): Promise<TelephonyActionResult>;
  listRecordings(): Promise<TelephonyActionResult & { recordings?: unknown[] }>;
  handleWebhookEvent(payload: WebhookPayload): Promise<TelephonyActionResult>;
  handleWebhook(payload: WebhookPayload): Promise<TelephonyActionResult>;
}

function createMockAdapter(provider: TelephonyProvider): TelephonyAdapter {
  const result = (message: string): TelephonyActionResult => {
    console.log(`[KingApp ${provider}] ${message}`);
    return { ok: true, provider, message };
  };

  return {
    provider,
    async makeCall(phone) {
      return result(`Mock makeCall to ${phone}`);
    },
    async answerCall(callId) {
      return result(`Mock answerCall ${callId}`);
    },
    async endCall(callId) {
      return result(`Mock endCall ${callId}`);
    },
    async holdCall(callId) {
      return result(`Mock holdCall ${callId}`);
    },
    async resumeCall(callId) {
      return result(`Mock resumeCall ${callId}`);
    },
    async transferCall(callId, target) {
      return result(`Mock transferCall ${callId} to ${target}`);
    },
    async getCallStatus(callId) {
      return result(`Mock getCallStatus ${callId}`);
    },
    async listRecordings() {
      return { ...result("Mock listRecordings"), recordings: [] };
    },
    async handleWebhookEvent(payload) {
      return result(`Mock handleWebhookEvent ${payload.event}`);
    },
    async handleWebhook(payload) {
      return result(`Mock handleWebhook ${payload.event}`);
    }
  };
}

export class MockProviderAdapter implements TelephonyAdapter {
  private adapter = createMockAdapter("Manual Mode");
  provider = this.adapter.provider;
  makeCall = this.adapter.makeCall;
  answerCall = this.adapter.answerCall;
  endCall = this.adapter.endCall;
  holdCall = this.adapter.holdCall;
  resumeCall = this.adapter.resumeCall;
  transferCall = this.adapter.transferCall;
  getCallStatus = this.adapter.getCallStatus;
  listRecordings = this.adapter.listRecordings;
  handleWebhookEvent = this.adapter.handleWebhookEvent;
  handleWebhook = this.adapter.handleWebhook;
}

export class ManualAdapter extends MockProviderAdapter {}

export class TwilioProviderAdapter implements TelephonyAdapter {
  private adapter = createMockAdapter("Twilio");
  provider = this.adapter.provider;
  makeCall = this.adapter.makeCall;
  answerCall = this.adapter.answerCall;
  endCall = this.adapter.endCall;
  holdCall = this.adapter.holdCall;
  resumeCall = this.adapter.resumeCall;
  transferCall = this.adapter.transferCall;
  getCallStatus = this.adapter.getCallStatus;
  listRecordings = this.adapter.listRecordings;
  handleWebhookEvent = this.adapter.handleWebhookEvent;
  handleWebhook = this.adapter.handleWebhook;
}

export class TwilioAdapter extends TwilioProviderAdapter {}

export class ThreeCXProviderAdapter implements TelephonyAdapter {
  private adapter = createMockAdapter("3CX");
  provider = this.adapter.provider;
  makeCall = this.adapter.makeCall;
  answerCall = this.adapter.answerCall;
  endCall = this.adapter.endCall;
  holdCall = this.adapter.holdCall;
  resumeCall = this.adapter.resumeCall;
  transferCall = this.adapter.transferCall;
  getCallStatus = this.adapter.getCallStatus;
  listRecordings = this.adapter.listRecordings;
  handleWebhookEvent = this.adapter.handleWebhookEvent;
  handleWebhook = this.adapter.handleWebhook;
}

export class ThreeCXAdapter extends ThreeCXProviderAdapter {}

export class AsteriskProviderAdapter implements TelephonyAdapter {
  private adapter = createMockAdapter("Asterisk / FreePBX");
  provider = this.adapter.provider;
  makeCall = this.adapter.makeCall;
  answerCall = this.adapter.answerCall;
  endCall = this.adapter.endCall;
  holdCall = this.adapter.holdCall;
  resumeCall = this.adapter.resumeCall;
  transferCall = this.adapter.transferCall;
  getCallStatus = this.adapter.getCallStatus;
  listRecordings = this.adapter.listRecordings;
  handleWebhookEvent = this.adapter.handleWebhookEvent;
  handleWebhook = this.adapter.handleWebhook;
}

export class AsteriskAdapter extends AsteriskProviderAdapter {}

export function getProviderAdapter(provider: TelephonyProvider): TelephonyAdapter {
  if (provider === "Twilio") return new TwilioProviderAdapter();
  if (provider === "3CX") return new ThreeCXProviderAdapter();
  if (provider === "Asterisk / FreePBX" || provider === "Asterisk / SIP") return new AsteriskProviderAdapter();
  return new MockProviderAdapter();
}
