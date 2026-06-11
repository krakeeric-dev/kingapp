import { NextResponse } from "next/server";
import type { WebhookPayload } from "@/lib/providerAdapters";
import { processTelephonyWebhook } from "@/lib/telephonyService";
import { verifyTelephonySignature } from "@/lib/telephonySecurity";

const supportedEvents = [
  "incoming_call",
  "answered",
  "missed",
  "transferred",
  "ended",
  "call_answered",
  "call_ended",
  "call_missed",
  "call_transferred",
  "recording_available",
  "call_recording_ready",
  "recording_ready"
];

export async function POST(request: Request) {
  const bodyText = await request.text();
  const signature =
    request.headers.get("x-kingapp-signature") ||
    request.headers.get("x-twilio-signature") ||
    request.headers.get("x-3cx-token") ||
    request.headers.get("x-asterisk-signature");
  const verification = verifyTelephonySignature(bodyText, signature);

  if (!verification.ok) {
    return NextResponse.json(
      { ok: false, message: verification.message },
      { status: 401 }
    );
  }

  let payload: WebhookPayload;

  try {
    payload = JSON.parse(bodyText || "{}") as WebhookPayload;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid webhook payload." },
      { status: 400 }
    );
  }

  if (!payload.event || !payload.phone) {
    return NextResponse.json(
      { ok: false, message: "Webhook event and phone number are required." },
      { status: 400 }
    );
  }

  if (!supportedEvents.includes(payload.event)) {
    return NextResponse.json(
      { ok: false, message: "Unsupported webhook event." },
      { status: 400 }
    );
  }
  const result = await processTelephonyWebhook(payload);

  return NextResponse.json({
    ok: true,
    verificationMode: verification.mode,
    message: verification.message,
    audit: {
      action: "webhook_received",
      provider: payload.provider ?? "manual",
      event: payload.event,
      callId: payload.callId ?? "",
      fromNumber: payload.fromNumber ?? payload.phone,
      toNumber: payload.toNumber ?? "",
      companyId: payload.companyId ?? "",
      agentId: payload.agentId ?? "",
      clientId: payload.clientId ?? "",
      status: payload.status ?? payload.event,
      receivedAt: payload.timestamp ?? new Date().toISOString()
    },
    result
  });
}
