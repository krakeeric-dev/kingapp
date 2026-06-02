import { createHmac, timingSafeEqual } from "crypto";

export function signTelephonyPayload(body: string, secret: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function verifyTelephonySignature(body: string, signature: string | null) {
  const secret =
    process.env.TELEPHONY_WEBHOOK_SECRET ||
    process.env.TWILIO_WEBHOOK_SECRET ||
    process.env.THREE_CX_WEBHOOK_SECRET ||
    process.env.ASTERISK_WEBHOOK_SECRET;

  if (!secret) {
    return {
      ok: true,
      mode: "mock",
      message: "Webhook secret is not configured. Mock webhook accepted."
    };
  }

  if (!signature) {
    return { ok: false, mode: "real", message: "Missing webhook signature." };
  }

  const expected = signTelephonyPayload(body, secret);
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(signature.replace(/^sha256=/, ""), "hex");

  if (receivedBuffer.length === 0 || expectedBuffer.length !== receivedBuffer.length) {
    return { ok: false, mode: "real", message: "Invalid webhook signature." };
  }

  return {
    ok: timingSafeEqual(expectedBuffer, receivedBuffer),
    mode: "real",
    message: "Webhook signature verified."
  };
}
