import type { SessionUser } from "@/lib/auth";
import { getCompanyClients, getCompanyComplaints, getCompanyOrders, getCompanyQueueCalls } from "@/lib/call-center-operations";
import { getMessagesForStaff } from "@/lib/clientMessageService";

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
  "Packaging Defect",
  "Packaging Issue",
  "Quality Concern",
  "Product Quality Issue",
  "Recall Issue"
];

export type CcrmTicket = {
  id: string;
  assignedDepartment: string;
  batchNumber: string;
  channel: string;
  company: string;
  customer: string;
  date: string;
  evidence: string[];
  issueType: string;
  phone: string;
  priority: string;
  product: string;
  region: string;
  status: string;
  time: string;
};

function departmentForIssue(issueType: string) {
  const value = issueType.toLowerCase();
  if (value.includes("expired") || value.includes("quality") || value.includes("packaging") || value.includes("recall") || value.includes("damaged")) return "Quality";
  if (value.includes("delivery") || value.includes("missing") || value.includes("wrong")) return "Logistics";
  if (value.includes("payment")) return "Finance";
  if (value.includes("market") || value.includes("competitor") || value.includes("shortage")) return "Sales";
  if (value.includes("request") || value.includes("inquiry")) return "Customer Care";
  return "Customer Care";
}

function priorityForIssue(issueType: string, currentPriority?: string) {
  if (currentPriority) return currentPriority;
  const value = issueType.toLowerCase();
  if (value.includes("recall") || value.includes("expired")) return "Critical";
  if (value.includes("quality") || value.includes("damaged")) return "High";
  return "Medium";
}

export function getCcrmTickets(user: SessionUser): CcrmTicket[] {
  const clientById = new Map(getCompanyClients(user).map((client) => [client.id, client]));
  const complaintTickets = getCompanyComplaints(user).map((complaint) => {
    const client = clientById.get(complaint.clientId);
    const issueType = complaint.complaintType || "Complaint";
    return {
      id: complaint.complaintNumber ?? complaint.id,
      assignedDepartment: complaint.assignedTo || departmentForIssue(issueType),
      batchNumber: "Not recorded",
      channel: "Complaint",
      company: complaint.companyName ?? client?.companyName ?? user.companyName,
      customer: complaint.clientName,
      date: complaint.createdAt.slice(0, 10),
      evidence: ["Photos", "Videos", "Voice Notes", "Documents"],
      issueType,
      phone: client?.phone ?? "",
      priority: priorityForIssue(issueType, complaint.priority),
      product: complaint.product || "Not recorded",
      region: client?.area ?? "Not recorded",
      status: complaint.status,
      time: new Date(complaint.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    } satisfies CcrmTicket;
  });
  const callTickets = getCompanyQueueCalls(user).map((call) => ({
    id: `TKT-${call.id}`,
    assignedDepartment: departmentForIssue(call.callReason),
    batchNumber: "Not recorded",
    channel: "Phone Call",
    company: call.companyName ?? user.companyName,
    customer: call.clientName,
    date: call.startedAt.slice(0, 10),
    evidence: [],
    issueType: call.callReason,
    phone: call.phone,
    priority: priorityForIssue(call.callReason),
    product: "Not recorded",
    region: call.location || "Not recorded",
    status: call.status,
    time: new Date(call.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  } satisfies CcrmTicket));
  const messageTickets = getMessagesForStaff(user).map((message) => ({
    id: `TKT-${message.threadId}`,
    assignedDepartment: departmentForIssue(message.messageType),
    batchNumber: "Not recorded",
    channel: "Web Portal Message",
    company: message.companyName,
    customer: message.clientName,
    date: message.createdAt.slice(0, 10),
    evidence: message.attachmentName ? ["Documents"] : [],
    issueType: message.messageType,
    phone: message.phone,
    priority: priorityForIssue(message.messageType),
    product: message.orderId ?? "Not recorded",
    region: "Not recorded",
    status: message.status,
    time: new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  } satisfies CcrmTicket));

  return [...complaintTickets, ...callTickets, ...messageTickets].sort((first, second) => `${second.date} ${second.time}`.localeCompare(`${first.date} ${first.time}`));
}

export function getCcrmIntelligence(user: SessionUser) {
  const complaints = getCompanyComplaints(user);
  const clients = getCompanyClients(user);
  const calls = getCompanyQueueCalls(user);
  const tickets = getCcrmTickets(user);
  const orders = getCompanyOrders(user);
  const openIssues = complaints.filter((item) => !["Resolved", "Closed"].includes(item.status)).length;
  const resolvedIssues = complaints.filter((item) => ["Resolved", "Closed"].includes(item.status)).length;
  const escalatedIssues = complaints.filter((item) => item.priority === "Urgent" || item.priority === "High").length;
  const productIssues = complaints.filter((item) => productIssueTypes.includes(item.complaintType));
  const vipComplaints = complaints.filter((item) => item.description.toLowerCase().includes("vip"));
  const healthScore = Math.max(0, Math.min(100, 100 - openIssues * 8 - escalatedIssues * 12 + resolvedIssues * 3));
  const satisfactionScore = Math.max(0, Math.min(100, 92 - openIssues * 5 - calls.filter((call) => call.status === "Missed").length * 3));
  const productHealthScore = Math.max(0, Math.min(100, 95 - productIssues.length * 10 - escalatedIssues * 6));

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
    openTickets: tickets.filter((ticket) => !["Resolved", "Closed", "Delivered"].includes(ticket.status)).length,
    productHealthScore,
    productIssueCount: productIssues.length,
    recallRisks: tickets.filter((ticket) => ticket.issueType.toLowerCase().includes("recall") || ticket.issueType.toLowerCase().includes("expired")).length,
    retentionIndicators: clients.length ? Math.max(0, 100 - openIssues * 4) : 0,
    resolvedIssues,
    satisfactionScore,
    totalTickets: tickets.length,
    marketOpportunities: tickets.filter((ticket) => ticket.issueType === "Market Feedback" || ticket.issueType === "Product Inquiry").length + orders.filter((order) => order.notes.toLowerCase().includes("request")).length
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
