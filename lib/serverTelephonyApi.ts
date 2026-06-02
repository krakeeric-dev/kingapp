import { getProviderAdapter, type TelephonyProvider } from "@/lib/providerAdapters";

type CallAction =
  | "make-call"
  | "answer-call"
  | "end-call"
  | "hold-call"
  | "resume-call"
  | "status"
  | "recordings"
  | "transfer-call";

export type CallActionBody = {
  provider?: TelephonyProvider;
  phone?: string;
  callId?: string;
  target?: string;
};

function getProvider(provider?: TelephonyProvider) {
  const envProvider = process.env.TELEPHONY_PROVIDER;
  if (envProvider === "mock") return "Manual Mode";
  return provider ?? (envProvider as TelephonyProvider | undefined) ?? "Manual Mode";
}

export async function runServerCallAction(action: CallAction, body: CallActionBody) {
  const adapter = getProviderAdapter(getProvider(body.provider));

  try {
    if (action === "make-call") {
      if (!body.phone) {
        return { status: 400, data: { ok: false, message: "Enter a valid phone number." } };
      }
      return { status: 200, data: await adapter.makeCall(body.phone) };
    }

    if (action === "recordings") {
      return { status: 200, data: await adapter.listRecordings() };
    }

    if (!body.callId) {
      return { status: 400, data: { ok: false, message: "Missing call ID." } };
    }

    if (action === "answer-call") return { status: 200, data: await adapter.answerCall(body.callId) };
    if (action === "end-call") return { status: 200, data: await adapter.endCall(body.callId) };
    if (action === "hold-call") return { status: 200, data: await adapter.holdCall(body.callId) };
    if (action === "resume-call") return { status: 200, data: await adapter.resumeCall(body.callId) };
    if (action === "status") return { status: 200, data: await adapter.getCallStatus(body.callId) };
    if (action === "transfer-call") {
      if (!body.target) {
        return { status: 400, data: { ok: false, message: "Select transfer target." } };
      }
      return { status: 200, data: await adapter.transferCall(body.callId, body.target) };
    }

    return { status: 400, data: { ok: false, message: "Unsupported call action." } };
  } catch (error) {
    return {
      status: 502,
      data: {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Phone provider is disconnected or unavailable."
      }
    };
  }
}
