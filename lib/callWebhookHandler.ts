import { processTelephonyWebhook } from "@/lib/telephonyService";
import type { WebhookPayload } from "@/lib/providerAdapters";

export async function handleMockPhoneWebhook(payload: WebhookPayload) {
  return processTelephonyWebhook(payload);
}
