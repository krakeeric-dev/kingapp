import type { QueueCall } from "@/lib/call-center-data";

export type TelephonyProvider =
  | "3CX"
  | "Twilio"
  | "Asterisk / FreePBX"
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
  | "recording_ready";

export type WebhookPayload = {
  event: TelephonyWebhookEvent;
  phone: string;
  agentName?: string;
  callId?: string;
  transferTo?: QueueCall["transferTo"];
  recordingUrl?: string;
};

export interface TelephonyAdapter {
  provider: TelephonyProvider;
  makeCall(phone: string): Promise<TelephonyActionResult>;
  answerCall(callId: string): Promise<TelephonyActionResult>;
  endCall(callId: string): Promise<TelephonyActionResult>;
  holdCall(callId: string): Promise<TelephonyActionResult>;
  transferCall(callId: string, target: string): Promise<TelephonyActionResult>;
  getCallStatus(callId: string): Promise<TelephonyActionResult>;
  handleWebhookEvent(payload: WebhookPayload): Promise<TelephonyActionResult>;
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
    async transferCall(callId, target) {
      return result(`Mock transferCall ${callId} to ${target}`);
    },
    async getCallStatus(callId) {
      return result(`Mock getCallStatus ${callId}`);
    },
    async handleWebhookEvent(payload) {
      return result(`Mock handleWebhookEvent ${payload.event}`);
    }
  };
}

export class ManualAdapter implements TelephonyAdapter {
  private adapter = createMockAdapter("Manual Mode");
  provider = this.adapter.provider;
  makeCall = this.adapter.makeCall;
  answerCall = this.adapter.answerCall;
  endCall = this.adapter.endCall;
  holdCall = this.adapter.holdCall;
  transferCall = this.adapter.transferCall;
  getCallStatus = this.adapter.getCallStatus;
  handleWebhookEvent = this.adapter.handleWebhookEvent;
}

export class TwilioAdapter implements TelephonyAdapter {
  private adapter = createMockAdapter("Twilio");
  provider = this.adapter.provider;
  makeCall = this.adapter.makeCall;
  answerCall = this.adapter.answerCall;
  endCall = this.adapter.endCall;
  holdCall = this.adapter.holdCall;
  transferCall = this.adapter.transferCall;
  getCallStatus = this.adapter.getCallStatus;
  handleWebhookEvent = this.adapter.handleWebhookEvent;
}

export class ThreeCXAdapter implements TelephonyAdapter {
  private adapter = createMockAdapter("3CX");
  provider = this.adapter.provider;
  makeCall = this.adapter.makeCall;
  answerCall = this.adapter.answerCall;
  endCall = this.adapter.endCall;
  holdCall = this.adapter.holdCall;
  transferCall = this.adapter.transferCall;
  getCallStatus = this.adapter.getCallStatus;
  handleWebhookEvent = this.adapter.handleWebhookEvent;
}

export class AsteriskAdapter implements TelephonyAdapter {
  private adapter = createMockAdapter("Asterisk / FreePBX");
  provider = this.adapter.provider;
  makeCall = this.adapter.makeCall;
  answerCall = this.adapter.answerCall;
  endCall = this.adapter.endCall;
  holdCall = this.adapter.holdCall;
  transferCall = this.adapter.transferCall;
  getCallStatus = this.adapter.getCallStatus;
  handleWebhookEvent = this.adapter.handleWebhookEvent;
}

export function getProviderAdapter(provider: TelephonyProvider): TelephonyAdapter {
  if (provider === "Twilio") return new TwilioAdapter();
  if (provider === "3CX") return new ThreeCXAdapter();
  if (provider === "Asterisk / FreePBX") return new AsteriskAdapter();
  return new ManualAdapter();
}
