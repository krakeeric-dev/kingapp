import type { SessionUser } from "@/lib/auth";
import {
  addPendingOrder,
  getAgents,
  getCallbacks,
  getCallCenterClients,
  getCallLogs,
  getComplaints,
  getMissedCalls,
  getPaymentFollowUps,
  getPendingOrders,
  getQueueCalls,
  type CallCenterAgent,
  type CallCenterClient,
  type ComplaintRecord
} from "@/lib/call-center-data";
import {
  getClientOrders,
  getSuppliers,
  saveClientOrders,
  type ClientPortalOrder
} from "@/lib/client-portal-data";
import { getActivePrice, getProducts, type ProductMaster } from "@/lib/products-data";
import { getCallRecordings, type CallRecording } from "@/lib/telephonyService";
import {
  filterByAssignedCompanies,
  getActiveCompanyId,
  getAssignedCompanyIds,
  getCompanies,
  getCompanyWorkspaceId,
  setActiveCompanyId
} from "@/lib/companies-data";

export type CallCenterCompany = {
  id: string;
  name: string;
  industry: string;
  status: "Active" | "Inactive";
};

export type OneClickOrderInput = {
  deliveryDate: string;
  notes: string;
  productName: string;
  quantity: number;
};

export const callCenterCompanies: CallCenterCompany[] = [];

function getCallCenterCompanies() {
  return getCompanies().map((company) => ({
    id: company.id,
    name: company.name,
    industry: company.type,
    status: company.status === "active" ? ("Active" as const) : ("Inactive" as const)
  }));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function companyForIndex(index: number) {
  const companies = getCallCenterCompanies();
  return companies[index % Math.max(companies.length, 1)] ?? null;
}

export function companyForClient(client: Pick<CallCenterClient, "id" | "companyId" | "companyName">) {
  if (client.companyId && client.companyName) {
    return { id: client.companyId, name: client.companyName };
  }
  const digits = Number(client.id.replace(/\D/g, "")) || 1;
  const company = companyForIndex(digits - 1);
  return { id: company?.id ?? "", name: company?.name ?? "No company selected" };
}

export function companyForAgent(agent: Pick<CallCenterAgent, "id" | "companyId" | "companyName">) {
  if (agent.companyId && agent.companyName) {
    return { id: agent.companyId, name: agent.companyName };
  }
  const digits = Number(agent.id.replace(/\D/g, "")) || 1;
  const company = companyForIndex(digits - 1);
  return { id: company?.id ?? "", name: company?.name ?? "No company selected" };
}

function readCompanyId() {
  return getActiveCompanyId({ role: "admin", companyId: "all" });
}

export function getActiveCallCenterCompany() {
  return readCompanyId();
}

export function getActiveCallCenterCompanyForUser(user: SessionUser) {
  return getCompanyWorkspaceId(user);
}

export function getAssignableCallCenterCompanies(user: SessionUser) {
  const assigned = getAssignedCompanyIds(user);
  const companies = getCallCenterCompanies();
  if (assigned.includes("all")) return companies;
  return companies.filter((company) => assigned.includes(company.id));
}

export function setActiveCallCenterCompany(companyId: string) {
  if (typeof window !== "undefined") {
    setActiveCompanyId(companyId);
    window.dispatchEvent(new Event("kingapp:company-switched"));
  }
  return companyId;
}

export function filterByActiveCompany<T extends { companyId?: string; companyName?: string; clientId?: string }>(
  records: T[]
) {
  const activeCompanyId = getActiveCallCenterCompany();
  if (activeCompanyId === "all") return records;

  return records.filter((record) => {
    if (record.companyId) return record.companyId === activeCompanyId;
    if (!record.clientId) return false;
    const client = getCallCenterClients().find((item) => item.id === record.clientId);
    return client ? companyForClient(client).id === activeCompanyId : false;
  });
}

export function filterCallCenterRecordsForUser<T extends { companyId?: string; companyName?: string; clientId?: string }>(
  records: T[],
  user: SessionUser
) {
  return filterByAssignedCompanies(records, user, (record) => {
    if (record.companyId) return record.companyId;
    if (!record.clientId) return undefined;
    const client = getCallCenterClients().find((item) => item.id === record.clientId);
    return client ? companyForClient(client).id : undefined;
  });
}

export function getCompanyClients(user?: SessionUser) {
  const records =
    getCallCenterClients().map((client) => {
      const company = companyForClient(client);
      return { ...client, companyId: company.id, companyName: company.name };
    });
  return user ? filterCallCenterRecordsForUser(records, user) : filterByActiveCompany(records);
}

export function getCompanyAgents(user?: SessionUser) {
  const records =
    getAgents().map((agent) => {
      const company = companyForAgent(agent);
      return { ...agent, companyId: company.id, companyName: company.name };
    });
  return user ? filterCallCenterRecordsForUser(records, user) : filterByActiveCompany(records);
}

export function getCompanyQueueCalls(user?: SessionUser) {
  const clients = getCallCenterClients();
  const records =
    getQueueCalls().map((call) => {
      const client = clients.find((item) => item.id === call.clientId);
      const company = client ? companyForClient(client) : companyForIndex(0);
      return { ...call, companyId: call.companyId ?? company.id, companyName: call.companyName ?? company.name };
    });
  return user ? filterCallCenterRecordsForUser(records, user) : filterByActiveCompany(records);
}

export function getCompanyOrders(user?: SessionUser) {
  return user ? filterCallCenterRecordsForUser(getPendingOrders(), user) : filterByActiveCompany(getPendingOrders());
}

export function getCompanyComplaints(user?: SessionUser) {
  return user ? filterCallCenterRecordsForUser(getComplaints(), user) : filterByActiveCompany(getComplaints());
}

export function getCompanyPayments(user?: SessionUser) {
  return user ? filterCallCenterRecordsForUser(getPaymentFollowUps(), user) : filterByActiveCompany(getPaymentFollowUps());
}

export function getCompanyCallbacks(user?: SessionUser) {
  return user ? filterCallCenterRecordsForUser(getCallbacks(), user) : filterByActiveCompany(getCallbacks());
}

export function getCompanyRecordings(user?: SessionUser): Array<CallRecording & { date: string; outcome: string }> {
  const calls = getCompanyQueueCalls(user);
  const callIds = new Set(calls.map((call) => call.id));
  if (callIds.size === 0) return [];
  return getCallRecordings()
    .filter((recording) => callIds.has(recording.callId))
    .map((recording, index) => ({
      ...recording,
      date: new Date(Date.now() - index * 86_400_000).toISOString().slice(0, 10),
      outcome: recording.recordingStatus === "Ready" ? "Completed" : "Pending Provider"
    }));
}

export function getPerformanceRows(user?: SessionUser) {
  const logs = getCallLogs();
  const orders = getCompanyOrders(user);
  const complaints = getCompanyComplaints(user);
  const payments = getCompanyPayments(user);
  const agents = getCompanyAgents(user);
  const todayDate = today();
  const weekStart = Date.now() - 6 * 86_400_000;

  return agents.map((agent) => {
    const agentLogs = logs.filter((log) => log.agent === agent.name);
    const callsToday = agentLogs.filter((log) => log.date === todayDate).length;
    const callsThisWeek = agentLogs.filter((log) => new Date(log.date).getTime() >= weekStart).length;
    const ordersTaken = orders.filter((order) => order.createdBy === agent.name).length;
    const complaintsResolved =
      complaints.filter((complaint) => complaint.agent === agent.name && ["Resolved", "Closed"].includes(complaint.status)).length;
    const paymentFollowUps = payments.filter((payment) => payment.agent === agent.name).length;
    const performance = Math.min(99, Math.round((ordersTaken * 8 + callsToday * 4 + complaintsResolved * 10 + paymentFollowUps * 3) / 2));

    return {
      agent: agent.name,
      callsToday,
      callsThisWeek,
      ordersTaken,
      complaintsResolved,
      paymentFollowUps,
      averageCallTime: "0:00",
      performance
    };
  });
}

export function getCallCenterSummary(user?: SessionUser) {
  const queueCalls = getCompanyQueueCalls(user);
  const orders = getCompanyOrders(user);
  const complaints = getCompanyComplaints(user);
  const callbacks = getCompanyCallbacks(user);
  const missed = getMissedCalls();
  const performance = getPerformanceRows(user);
  const revenue = orders.reduce((sum, order) => {
    const product = getProducts().find((item) => item.name === order.product);
    return sum + order.quantity * (product?.pricePerCarton ?? 2000);
  }, 0);

  return {
    totalCalls: queueCalls.length + getCallLogs().length,
    totalOrders: orders.length,
    totalComplaints: complaints.length,
    bestAgent: [...performance].sort((first, second) => second.performance - first.performance)[0]?.agent ?? "No agent yet",
    revenueGenerated: revenue,
    openComplaints: complaints.filter((complaint) => !["Resolved", "Closed"].includes(complaint.status)).length,
    waiting: queueCalls.filter((call) => call.status === "Waiting" || call.status === "Incoming").length,
    active: queueCalls.filter((call) => call.status === "Active").length,
    agentsOnline: getCompanyAgents(user).filter((agent) => agent.status !== "Offline").length,
    missedToday: missed.filter((call) => call.date === today()).length,
    callbacksDue: callbacks.filter((callback) => callback.status === "Pending" && callback.callbackDate <= today()).length
  };
}

export function createOneClickOrder(
  client: CallCenterClient,
  input: OneClickOrderInput,
  user: SessionUser
) {
  const product = getProducts().find((item) => item.name === input.productName) ?? getProducts()[0];
  const quantity = Math.max(0, Number(input.quantity) || 0);
  if (!product || quantity <= 0) {
    throw new Error("Select product and quantity.");
  }

  const company = companyForClient(client);
  const orderNotes = `${input.notes || "Created during call"} Company: ${company.name}`.trim();
  const pendingOrders = addPendingOrder(
    { ...client, companyId: company.id, companyName: company.name },
    {
      product: product.name,
      quantity,
      deliveryDate: input.deliveryDate || today(),
      notes: orderNotes
    },
    user
  );

  const supplier = getSuppliers()[0];
  const price = getActivePrice(product.name, product.itemCode);
  const portalOrder: ClientPortalOrder = {
    id: `CCO-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase(),
    companyId: company.id,
    companyName: company.name,
    agentId: user.id,
    clientId: client.id,
    clientName: client.clientName,
    phone: client.phone,
    location: client.area,
    supplier: supplier?.name ?? company.name,
    supplierId: supplier?.id,
    assignedMarketer: client.assignedMarketer,
    lines: [
      {
        productName: product.name,
        itemCode: product.itemCode,
        quantity,
        pricePerCarton: price,
        amount: quantity * price
      }
    ],
    totalQuantity: quantity,
    totalAmount: quantity * price,
    status: "Pending",
    paymentStatus: "Unpaid",
    createdAt: new Date().toISOString(),
    deliveryDate: input.deliveryDate || today(),
    notifications: [
      {
        id: `NTF-${Date.now()}`,
        message: "Order received from Call Center. Waiting for supplier approval.",
        createdAt: new Date().toISOString()
      }
    ]
  };
  saveClientOrders([portalOrder, ...getClientOrders()]);

  return { pendingOrders, portalOrder };
}

export function getComplaintCenterRows(user?: SessionUser) {
  return getCompanyComplaints(user).map((complaint: ComplaintRecord, index) => ({
    ...complaint,
    complaintNumber: complaint.complaintNumber ?? complaint.id.replace("COMP", "CMP"),
    assignedTo: complaint.assignedTo ?? ["Supervisor", "Manager", "Storekeeper"][index % 3],
    status: complaint.status || "Open"
  }));
}

export function getProductsForQuickOrder(): ProductMaster[] {
  return getProducts();
}
