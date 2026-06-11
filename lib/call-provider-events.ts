export type IncomingProviderCall = {
  callerNumber: string;
  calledNumber: string;
  provider: string;
  callId: string;
  timestamp: string;
};

const incomingCalls: IncomingProviderCall[] = [];

export function addIncomingProviderCall(input: Partial<IncomingProviderCall>) {
  const call: IncomingProviderCall = {
    callerNumber: input.callerNumber?.trim() || "",
    calledNumber: input.calledNumber?.trim() || "",
    provider: input.provider?.trim() || "Manual Provider",
    callId: input.callId?.trim() || `PROVIDER-${Date.now()}`,
    timestamp: input.timestamp || new Date().toISOString()
  };

  incomingCalls.unshift(call);
  incomingCalls.splice(50);
  return call;
}

export function getIncomingProviderCalls() {
  return incomingCalls;
}
