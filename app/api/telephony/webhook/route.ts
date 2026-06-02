import { NextResponse } from "next/server";
import type { WebhookPayload } from "@/lib/providerAdapters";
import { processTelephonyWebhook } from "@/lib/telephonyService";
import { verifyTelephonySignature } from "@/lib/telephonySecurity";

export async function POST(request: Request) {
  const bodyText = await request.text();
  const signature = request.headers.get("x-kingapp-signature");
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
  const result = await processTelephonyWebhook(payload);

  return NextResponse.json({
    ok: true,
    verificationMode: verification.mode,
    message: verification.message,
    result
  });
}
