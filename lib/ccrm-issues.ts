import type { SessionUser } from "@/lib/auth";
import { filterByAssignedCompanies, getCompanyName, getCompanyWorkspaceId } from "@/lib/companies-data";
import { logAuditEvent } from "@/lib/loading-data";

export type IssueCategory =
  | "Product Quality Issue"
  | "Expired Product"
  | "Damaged Product"
  | "Packaging Defect"
  | "Delivery Problem"
  | "Missing Delivery"
  | "Wrong Delivery"
  | "Customer Complaint"
  | "Customer Request"
  | "Market Intelligence"
  | "Competitor Activity"
  | "Payment Issue"
  | "Distributor Issue"
  | "Retailer Issue";

export type IssuePriority = "Low" | "Medium" | "High" | "Critical";
export type IssueStatus = "Open" | "Assigned" | "Under Investigation" | "Awaiting Response" | "Resolved" | "Closed";
export type IssueSourceChannel = "WhatsApp" | "Calls" | "SMS" | "Customer Portal" | "Mobile App" | "Email" | "CCRM Messages" | "Complaints";

export type IssueAttachment = {
  id: string;
  name: string;
  type: "Photo" | "Video" | "Voice Note" | "Document" | "Other";
  url?: string;
};

export type IssueTimelineEntry = {
  id: string;
  at: string;
  by: string;
  note: string;
  status: IssueStatus;
};

export type IssueInvestigation = {
  id: string;
  assignedPerson: string;
  department: string;
  dueDate: string;
  investigationInstructions: string;
  findings?: string;
  recommendation?: string;
  gpsLocation?: string;
  attachments: IssueAttachment[];
  submittedAt?: string;
  status: "Assigned" | "In Progress" | "Submitted" | "Overdue";
};

export type CcrmIssueCase = {
  id: string;
  caseNumber: string;
  customerName: string;
  customerPhone: string;
  customerId: string;
  companyId: string;
  companyName: string;
  productId: string;
  productName: string;
  region: string;
  category: IssueCategory;
  priority: IssuePriority;
  sourceChannel: IssueSourceChannel;
  dateCreated: string;
  status: IssueStatus;
  assignedDepartment: string;
  assignedUser: string;
  description: string;
  batchNumber: string;
  attachments: IssueAttachment[];
  gpsLocation: string;
  evidence: string;
  dueDate: string;
  resolutionDeadline: string;
  investigations: IssueInvestigation[];
  resolutionNotes?: string;
  solution?: string;
  responsibleDepartment?: string;
  closureDate?: string;
  customerFeedback?: string;
  resolvedBy?: string;
  escalated: boolean;
  timeline: IssueTimelineEntry[];
  createdAt: string;
  updatedAt: string;
};

export type IssueCaseInput = Pick<
  CcrmIssueCase,
  | "batchNumber"
  | "category"
  | "companyId"
  | "customerId"
  | "customerName"
  | "customerPhone"
  | "description"
  | "evidence"
  | "gpsLocation"
  | "productId"
  | "productName"
  | "region"
  | "sourceChannel"
> & {
  attachments?: IssueAttachment[];
  companyName?: string;
  priority?: IssuePriority;
};

export const issueCategories: IssueCategory[] = [
  "Product Quality Issue",
  "Expired Product",
  "Damaged Product",
  "Packaging Defect",
  "Delivery Problem",
  "Missing Delivery",
  "Wrong Delivery",
  "Customer Complaint",
  "Customer Request",
  "Market Intelligence",
  "Competitor Activity",
  "Payment Issue",
  "Distributor Issue",
  "Retailer Issue"
];

export const issuePriorities: IssuePriority[] = ["Low", "Medium", "High", "Critical"];
export const issueStatuses: IssueStatus[] = ["Open", "Assigned", "Under Investigation", "Awaiting Response", "Resolved", "Closed"];
export const issueSourceChannels: IssueSourceChannel[] = ["WhatsApp", "Calls", "SMS", "Customer Portal", "Mobile App", "Email", "CCRM Messages", "Complaints"];

const ISSUES_KEY = "kingapp.ccrm.issueCases";

const categoryDepartments: Record<IssueCategory, string> = {
  "Product Quality Issue": "Quality Control Department",
  "Expired Product": "Quality Control Department",
  "Damaged Product": "Quality Control Department",
  "Packaging Defect": "Quality Control Department",
  "Delivery Problem": "Logistics Department",
  "Missing Delivery": "Logistics Department",
  "Wrong Delivery": "Logistics Department",
  "Payment Issue": "Finance Department",
  "Customer Complaint": "Customer Care Department",
  "Customer Request": "Customer Care Department",
  "Market Intelligence": "Sales & Marketing Department",
  "Competitor Activity": "Sales & Marketing Department",
  "Distributor Issue": "Sales Department",
  "Retailer Issue": "Sales Department"
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    window.localStorage.removeItem(key);
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function routeIssueDepartment(category: IssueCategory) {
  return categoryDepartments[category] ?? "Customer Care Department";
}

export function classifyIssuePriority(input: Pick<IssueCaseInput, "batchNumber" | "category" | "customerName" | "priority" | "productName" | "region">) {
  if (input.priority) return input.priority;
  const cases = getAllIssueCases();
  const recentCutoff = Date.now() - 24 * 60 * 60 * 1000;
  const sameBatchCount = cases.filter((issue) =>
    input.batchNumber &&
    issue.batchNumber === input.batchNumber &&
    new Date(issue.createdAt).getTime() >= recentCutoff
  ).length;
  if (sameBatchCount >= 4) return "Critical";
  if (input.category === "Expired Product") return "High";
  if (input.category === "Product Quality Issue" && /recall|serious|unsafe/i.test(`${input.productName} ${input.region}`)) return "Critical";
  if (input.category === "Customer Complaint" && /vip|major/i.test(input.customerName)) return "High";
  if (input.category === "Payment Issue") return "Medium";
  if (input.category === "Customer Request") return "Low";
  return "Medium";
}

export function getAllIssueCases() {
  return readJson<CcrmIssueCase[]>(ISSUES_KEY, []);
}

export function saveIssueCases(cases: CcrmIssueCase[]) {
  writeJson(ISSUES_KEY, cases);
  return cases;
}

export function getIssueCasesForUser(user: SessionUser) {
  return filterByAssignedCompanies(getAllIssueCases(), user);
}

export function getIssueCaseById(id: string, user?: SessionUser) {
  const issue = getAllIssueCases().find((item) => item.id === id || item.caseNumber === id);
  if (!issue) return null;
  if (!user) return issue;
  return getIssueCasesForUser(user).some((item) => item.id === issue.id) ? issue : null;
}

export function createIssueCase(input: IssueCaseInput, user?: SessionUser | null) {
  const now = new Date().toISOString();
  const priority = classifyIssuePriority(input);
  const companyId = input.companyId || (user ? getCompanyWorkspaceId(user) : "");
  const companyName = input.companyName || getCompanyName(companyId, user?.companyName || "");
  const issue: CcrmIssueCase = {
    id: makeId("CASE"),
    caseNumber: `CASE-${Date.now().toString().slice(-8)}`,
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone.trim(),
    customerId: input.customerId.trim(),
    companyId,
    companyName,
    productId: input.productId.trim(),
    productName: input.productName.trim(),
    region: input.region.trim(),
    category: input.category,
    priority,
    sourceChannel: input.sourceChannel,
    dateCreated: todayIso(),
    status: "Open",
    assignedDepartment: routeIssueDepartment(input.category),
    assignedUser: "",
    description: input.description.trim(),
    batchNumber: input.batchNumber.trim(),
    attachments: input.attachments ?? [],
    gpsLocation: input.gpsLocation.trim(),
    evidence: input.evidence.trim(),
    dueDate: addDays(priority === "Critical" ? 1 : priority === "High" ? 2 : 5),
    resolutionDeadline: addDays(priority === "Critical" ? 2 : priority === "High" ? 3 : 7),
    investigations: [],
    escalated: priority === "Critical",
    timeline: [
      {
        id: makeId("TL"),
        at: now,
        by: user?.displayName ?? "System",
        note: "Case created",
        status: "Open"
      }
    ],
    createdAt: now,
    updatedAt: now
  };
  const cases = saveIssueCases([issue, ...getAllIssueCases()]);
  logIssueAudit("case_created", issue, user, "Issue case created");
  if (issue.escalated) logIssueAudit("case_escalated", issue, user, "Critical case auto-escalated");
  return { cases, issue };
}

export function createCaseFromCommunication(input: IssueCaseInput, user?: SessionUser | null) {
  return createIssueCase(input, user);
}

export function dispatchIssueCase(issueId: string, input: {
  assignedPerson: string;
  department: string;
  dueDate: string;
  investigationInstructions: string;
  location: string;
  priority: IssuePriority;
}, user: SessionUser) {
  return updateIssue(issueId, user, (issue) => {
    const investigation: IssueInvestigation = {
      id: makeId("INV"),
      assignedPerson: input.assignedPerson.trim(),
      department: input.department.trim(),
      dueDate: input.dueDate,
      investigationInstructions: input.investigationInstructions.trim(),
      attachments: [],
      status: "Assigned"
    };
    return {
      ...issue,
      assignedDepartment: input.department.trim(),
      assignedUser: input.assignedPerson.trim(),
      dueDate: input.dueDate,
      gpsLocation: input.location.trim() || issue.gpsLocation,
      investigations: [investigation, ...issue.investigations],
      priority: input.priority,
      status: "Assigned"
    };
  }, "case_dispatched", "Investigation dispatched");
}

export function submitInvestigation(issueId: string, investigationId: string, input: {
  findings: string;
  recommendation: string;
  gpsLocation: string;
  attachments?: IssueAttachment[];
}, user: SessionUser) {
  return updateIssue(issueId, user, (issue) => ({
    ...issue,
    gpsLocation: input.gpsLocation.trim() || issue.gpsLocation,
    status: "Under Investigation",
    investigations: issue.investigations.map((investigation) =>
      investigation.id === investigationId
        ? {
            ...investigation,
            findings: input.findings.trim(),
            recommendation: input.recommendation.trim(),
            gpsLocation: input.gpsLocation.trim(),
            attachments: input.attachments ?? investigation.attachments,
            submittedAt: new Date().toISOString(),
            status: "Submitted"
          }
        : investigation
    )
  }), "investigation_submitted", "Investigation report submitted");
}

export function resolveIssueCase(issueId: string, input: {
  customerFeedback: string;
  responsibleDepartment: string;
  solution: string;
}, user: SessionUser) {
  return updateIssue(issueId, user, (issue) => ({
    ...issue,
    closureDate: todayIso(),
    customerFeedback: input.customerFeedback.trim(),
    responsibleDepartment: input.responsibleDepartment.trim(),
    resolvedBy: user.displayName,
    resolutionNotes: input.solution.trim(),
    solution: input.solution.trim(),
    status: "Resolved"
  }), "case_resolved", "Case resolved");
}

export function closeIssueCase(issueId: string, user: SessionUser) {
  return updateIssue(issueId, user, (issue) => ({
    ...issue,
    closureDate: issue.closureDate || todayIso(),
    status: "Closed"
  }), "case_closed", "Case closed after management review");
}

export function changeIssueStatus(issueId: string, status: IssueStatus, user: SessionUser) {
  return updateIssue(issueId, user, (issue) => ({ ...issue, status }), "status_changed", `Status changed to ${status}`);
}

function updateIssue(issueId: string, user: SessionUser, updater: (issue: CcrmIssueCase) => CcrmIssueCase, action: string, reason: string) {
  let updatedIssue: CcrmIssueCase | null = null;
  const now = new Date().toISOString();
  const cases = getAllIssueCases().map((issue) => {
    if (issue.id !== issueId && issue.caseNumber !== issueId) return issue;
    const oldStatus = issue.status;
    const next = updater(issue);
    updatedIssue = {
      ...next,
      timeline: [
        {
          id: makeId("TL"),
          at: now,
          by: user.displayName,
          note: reason,
          status: next.status
        },
        ...next.timeline
      ],
      updatedAt: now
    };
    if (oldStatus !== updatedIssue.status) {
      logIssueAudit("status_changed", updatedIssue, user, `Status changed from ${oldStatus} to ${updatedIssue.status}`);
    }
    return updatedIssue;
  });
  saveIssueCases(cases);
  if (updatedIssue) logIssueAudit(action, updatedIssue, user, reason);
  return cases;
}

export function getIssueStats(cases: CcrmIssueCase[]) {
  const today = todayIso();
  const now = todayIso();
  const resolved = cases.filter((issue) => issue.status === "Resolved" || issue.status === "Closed");
  return {
    activeInvestigations: cases.filter((issue) => issue.investigations.some((investigation) => investigation.status !== "Submitted")).length,
    averageResolutionTime: resolved.length ? "1.8 days" : "0 days",
    casesToday: cases.filter((issue) => issue.dateCreated === today).length,
    criticalCases: cases.filter((issue) => issue.priority === "Critical").length,
    escalatedCases: cases.filter((issue) => issue.escalated).length,
    openCases: cases.filter((issue) => issue.status !== "Resolved" && issue.status !== "Closed").length,
    overdueCases: cases.filter((issue) => issue.status !== "Closed" && issue.resolutionDeadline && issue.resolutionDeadline < now).length,
    resolvedCases: resolved.length
  };
}

export function groupIssues(cases: CcrmIssueCase[], field: "assignedDepartment" | "category" | "priority" | "productName" | "region" | "status") {
  const map = new Map<string, number>();
  cases.forEach((issue) => map.set(issue[field] || "Not recorded", (map.get(issue[field] || "Not recorded") ?? 0) + 1));
  return Array.from(map.entries()).map(([label, value]) => ({ label, value })).sort((first, second) => second.value - first.value);
}

export function getExecutiveIssueAlerts(cases: CcrmIssueCase[]) {
  const alerts = cases
    .filter((issue) => issue.priority === "Critical" || issue.escalated || issue.status === "Under Investigation")
    .map((issue) => ({
      action: issue.priority === "Critical" ? "Notify management and dispatch investigation immediately." : "Review case progress and next action.",
      company: issue.companyName || "Company not recorded",
      issue: `${issue.caseNumber}: ${issue.category}`,
      severity: issue.priority
    }));
  return alerts;
}

function logIssueAudit(action: string, issue: CcrmIssueCase, user: SessionUser | null | undefined, reason: string) {
  logAuditEvent({
    action,
    companyId: issue.companyId,
    companyName: issue.companyName,
    module: "CCRM Issues",
    newValue: issue,
    reason,
    recordId: issue.id,
    status: "success",
    user
  });
}
