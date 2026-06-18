import type { SessionUser } from "@/lib/auth";
import { getCompanyClients, getCompanyComplaints, getCompanyQueueCalls } from "@/lib/call-center-operations";

export const ccrmMission = [
  "Hear the voice of customers every day",
  "Detect product and service problems early",
  "Protect product quality and company reputation",
  "Improve satisfaction and strengthen relationships"
];

export const productIssueTypes = [
  "Expired Product",
  "Damaged Product",
  "Wrong Delivery",
  "Missing Delivery",
  "Packaging Issue",
  "Product Quality Issue"
];

export function getCcrmIntelligence(user: SessionUser) {
  const complaints = getCompanyComplaints(user);
  const clients = getCompanyClients(user);
  const calls = getCompanyQueueCalls(user);
  const openIssues = complaints.filter((item) => !["Resolved", "Closed"].includes(item.status)).length;
  const resolvedIssues = complaints.filter((item) => ["Resolved", "Closed"].includes(item.status)).length;
  const escalatedIssues = complaints.filter((item) => item.priority === "Urgent" || item.priority === "High").length;
  const productIssues = complaints.filter((item) => productIssueTypes.includes(item.complaintType));
  const vipComplaints = complaints.filter((item) => item.description.toLowerCase().includes("vip"));
  const healthScore = Math.max(0, Math.min(100, 100 - openIssues * 8 - escalatedIssues * 12 + resolvedIssues * 3));
  const satisfactionScore = Math.max(0, Math.min(100, 92 - openIssues * 5 - calls.filter((call) => call.status === "Missed").length * 3));

  return {
    activeInvestigations: openIssues,
    customerHealthScore: healthScore,
    escalatedIssues,
    executiveAlerts: [
      ...(productIssues.length > 1 ? [{ issue: "Multiple product issue reports", severity: "High", action: "Review product batch and region immediately" }] : []),
      ...(complaints.some((item) => item.complaintType === "Expired Product") ? [{ issue: "Expired product reported", severity: "Critical", action: "Start recall-risk investigation" }] : []),
      ...(vipComplaints.length ? [{ issue: "VIP customer complaint", severity: "High", action: "Assign manager follow-up today" }] : [])
    ],
    openIssues,
    productIssueCount: productIssues.length,
    retentionIndicators: clients.length ? Math.max(0, 100 - openIssues * 4) : 0,
    resolvedIssues,
    satisfactionScore
  };
}

export function groupComplaintsByProduct(user: SessionUser) {
  const groups = new Map<string, number>();
  getCompanyComplaints(user).forEach((complaint) => {
    groups.set(complaint.product || "No product recorded", (groups.get(complaint.product || "No product recorded") ?? 0) + 1);
  });
  return Array.from(groups, ([label, value]) => ({ label, value }));
}

export function groupComplaintsByRegion(user: SessionUser) {
  const clientAreaById = new Map(getCompanyClients(user).map((client) => [client.id, client.area]));
  const groups = new Map<string, number>();
  getCompanyComplaints(user).forEach((complaint) => {
    const region = clientAreaById.get(complaint.clientId) || "No region recorded";
    groups.set(region, (groups.get(region) ?? 0) + 1);
  });
  return Array.from(groups, ([label, value]) => ({ label, value }));
}
