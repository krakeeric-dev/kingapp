const TELEPHONY_AUDIT_KEY = "kingapp.telephony.audit";

export type TelephonyAuditAction =
  | "call_accepted"
  | "call_transferred"
  | "order_created"
  | "payment_promise_added"
  | "complaint_logged"
  | "note_edited"
  | "recording_accessed"
  | "provider_action";

export type TelephonyAuditEntry = {
  id: string;
  action: TelephonyAuditAction;
  actor: string;
  details: string;
  createdAt: string;
};

function readAudit() {
  if (typeof window === "undefined") return [] as TelephonyAuditEntry[];
  const raw = window.localStorage.getItem(TELEPHONY_AUDIT_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as TelephonyAuditEntry[];
  } catch {
    window.localStorage.removeItem(TELEPHONY_AUDIT_KEY);
    return [];
  }
}

export function getTelephonyAudit() {
  return readAudit();
}

export function appendTelephonyAudit(
  action: TelephonyAuditAction,
  actor: string,
  details: string
) {
  if (typeof window === "undefined") return [] as TelephonyAuditEntry[];

  const entry: TelephonyAuditEntry = {
    id: `TAUD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase(),
    action,
    actor,
    details,
    createdAt: new Date().toISOString()
  };
  const records = [entry, ...readAudit()];
  window.localStorage.setItem(TELEPHONY_AUDIT_KEY, JSON.stringify(records));
  return records;
}
