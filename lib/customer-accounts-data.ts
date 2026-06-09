import type { SessionUser } from "@/lib/auth";
import { getClientOrders, getPortalClients, type ClientPortalOrder, type PortalClient } from "@/lib/client-portal-data";
import { canAccessCompany, filterByAssignedCompanies, getCompanyName, getCompanyWorkspaceId } from "@/lib/companies-data";
import { logAuditEvent } from "@/lib/loading-data";
import { getSalesRecords, saveSalesRecords, type ClientSaleLine, type SalesRecord } from "@/lib/sales-data";
import { upsertSupabaseRows } from "@/lib/supabase";

export type CustomerStatus = "Active" | "Blocked" | "On Hold";
export type DebtPaymentStatus = "Paid" | "Partial" | "Unpaid" | "Overdue";
export type PaymentMethod = "Cash" | "Mobile Money" | "Bank" | "Cheque";
export type DebtApprovalStatus =
  | "Pending Debt Approval"
  | "Pending Manager Approval"
  | "Approved Debt"
  | "Supervisor Declined"
  | "Manager Declined"
  | "Correction Requested";

export type CustomerAccount = {
  id: string;
  customerId: string;
  name: string;
  phone: string;
  location: string;
  companyId: string;
  companyName: string;
  creditLimit: number;
  openingBalance: number;
  currentBalance: number;
  status: CustomerStatus;
  createdAt: string;
  updatedAt: string;
};

export type CustomerAccountOverride = {
  id: string;
  customerId: string;
  companyId: string;
  creditLimit: number;
  openingBalance: number;
  status: CustomerStatus;
  updatedAt: string;
};

export type CustomerDebt = {
  id: string;
  companyId: string;
  companyName: string;
  customerId: string;
  customerName: string;
  phone: string;
  location: string;
  sourceType: "order" | "sale";
  orderId?: string;
  salesId?: string;
  amountDue: number;
  amountPaid: number;
  balance: number;
  dueDate: string;
  paymentStatus: DebtPaymentStatus;
  createdAt: string;
  approvalStatus?: DebtApprovalStatus;
};

export type CustomerDebtApproval = {
  id: string;
  debtId: string;
  companyId: string;
  companyName: string;
  date: string;
  marketerUsername: string;
  marketerName: string;
  customerId: string;
  customerName: string;
  phone: string;
  location: string;
  productSummary: string;
  totalAmount: number;
  amountPaid: number;
  debtAmount: number;
  salesId: string;
  clientSaleId: string;
  dueDate: string;
  notes: string;
  status: DebtApprovalStatus;
  supervisorReason?: string;
  managerReason?: string;
  adminReason?: string;
  supervisorReviewedBy?: string;
  managerReviewedBy?: string;
  updatedAt: string;
  createdAt: string;
};

export type CustomerPayment = {
  id: string;
  date: string;
  companyId: string;
  companyName: string;
  customerId: string;
  customerName: string;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  referenceNumber: string;
  notes: string;
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomerStatementLine = {
  date: string;
  type: "Opening Balance" | "Purchase" | "Payment" | "Return/Credit" | "Closing Balance";
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

const CUSTOMER_OVERRIDES_KEY = "kingapp.customerAccount.overrides";
const CUSTOMER_PAYMENTS_KEY = "kingapp.customerAccount.payments";
const CUSTOMER_DEBT_APPROVALS_KEY = "kingapp.customerAccount.debtApprovals";
const DEFAULT_CREDIT_LIMIT = 250_000;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const rawValue = window.localStorage.getItem(key);
  if (!rawValue) return fallback;

  try {
    return JSON.parse(rawValue) as T;
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

function addDays(dateValue: string, days: number) {
  const date = new Date(dateValue);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalizePhone(value?: string) {
  return (value ?? "").replace(/\D/g, "");
}

function customerKey(companyId?: string, phone?: string, name?: string) {
  const phoneKey = normalizePhone(phone);
  return `${companyId || "COMP-AGAHOZO"}-${phoneKey || (name ?? "customer").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function getCustomerId(companyId?: string, phone?: string, name?: string) {
  return customerKey(companyId, phone, name);
}

export function getCustomerOverrides() {
  return readJson<CustomerAccountOverride[]>(CUSTOMER_OVERRIDES_KEY, []);
}

export function saveCustomerOverrides(records: CustomerAccountOverride[]) {
  writeJson(CUSTOMER_OVERRIDES_KEY, records);
  void upsertSupabaseRows(
    "customer_accounts",
    records,
    (record) => record.id,
    (record) => record.updatedAt
  );
  return records;
}

export function getCustomerPayments() {
  return readJson<CustomerPayment[]>(CUSTOMER_PAYMENTS_KEY, []);
}

export function saveCustomerPayments(records: CustomerPayment[]) {
  writeJson(CUSTOMER_PAYMENTS_KEY, records);
  void upsertSupabaseRows(
    "customer_payments",
    records,
    (record) => record.id,
    (record) => record.updatedAt
  );
  return records;
}

export function getDebtApprovals() {
  return readJson<CustomerDebtApproval[]>(CUSTOMER_DEBT_APPROVALS_KEY, []);
}

export function saveDebtApprovals(records: CustomerDebtApproval[]) {
  writeJson(CUSTOMER_DEBT_APPROVALS_KEY, records);
  void upsertSupabaseRows(
    "customer_debts",
    records,
    (record) => record.id,
    (record) => record.updatedAt
  );
  return records;
}

function getOrderCustomer(order: ClientPortalOrder): CustomerAccount {
  const id = customerKey(order.companyId, order.phone, order.clientName);
  return {
    id,
    customerId: id,
    name: order.clientName,
    phone: order.phone,
    location: order.location,
    companyId: order.companyId ?? "COMP-AGAHOZO",
    companyName: order.companyName ?? getCompanyName(order.companyId),
    creditLimit: DEFAULT_CREDIT_LIMIT,
    openingBalance: 0,
    currentBalance: 0,
    status: "Active",
    createdAt: order.createdAt,
    updatedAt: order.createdAt
  };
}

function getPortalCustomer(client: PortalClient): CustomerAccount {
  const id = customerKey("COMP-AGAHOZO", client.phone, client.clientName);
  return {
    id,
    customerId: id,
    name: client.clientName,
    phone: client.phone,
    location: client.location,
    companyId: "COMP-AGAHOZO",
    companyName: getCompanyName("COMP-AGAHOZO"),
    creditLimit: DEFAULT_CREDIT_LIMIT,
    openingBalance: 0,
    currentBalance: 0,
    status: "Active",
    createdAt: client.createdAt ?? new Date().toISOString(),
    updatedAt: client.createdAt ?? new Date().toISOString()
  };
}

function getSalesCustomer(record: SalesRecord, line: ClientSaleLine): CustomerAccount {
  const companyId = (record as SalesRecord & { companyId?: string }).companyId ?? "COMP-AGAHOZO";
  const id = customerKey(companyId, line.clientPhone, line.clientName);
  return {
    id,
    customerId: id,
    name: line.clientName,
    phone: line.clientPhone,
    location: line.clientLocation,
    companyId,
    companyName: getCompanyName(companyId),
    creditLimit: DEFAULT_CREDIT_LIMIT,
    openingBalance: 0,
    currentBalance: 0,
    status: "Active",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function getBaseCustomers() {
  const map = new Map<string, CustomerAccount>();

  getPortalClients().forEach((client) => {
    const account = getPortalCustomer(client);
    map.set(account.customerId, account);
  });

  getClientOrders().forEach((order) => {
    const account = getOrderCustomer(order);
    map.set(account.customerId, { ...(map.get(account.customerId) ?? account), ...account });
  });

  getSalesRecords().forEach((record) => {
    (record.clientSales ?? []).forEach((line) => {
      const account = getSalesCustomer(record, line);
      map.set(account.customerId, { ...(map.get(account.customerId) ?? account), ...account });
    });
  });

  return Array.from(map.values());
}

function applyOverrides(account: CustomerAccount) {
  const override = getCustomerOverrides().find((item) => item.customerId === account.customerId);
  if (!override) return account;
  return {
    ...account,
    creditLimit: override.creditLimit,
    openingBalance: override.openingBalance,
    status: override.status,
    updatedAt: override.updatedAt
  };
}

function getSourceDebts() {
  const debts: CustomerDebt[] = [];

  getClientOrders().forEach((order) => {
    if (order.paymentStatus === "Paid") return;
    const account = getOrderCustomer(order);
    const amountPaid = order.paymentStatus === "Partial" ? 0 : 0;
    debts.push({
      id: `DEBT-${order.id}`,
      companyId: account.companyId,
      companyName: account.companyName,
      customerId: account.customerId,
      customerName: account.name,
      phone: account.phone,
      location: account.location,
      sourceType: "order",
      orderId: order.id,
      amountDue: order.totalAmount,
      amountPaid,
      balance: order.totalAmount - amountPaid,
      dueDate: addDays(order.createdAt, 14),
      paymentStatus: "Unpaid",
      createdAt: order.createdAt
    });
  });

  getSalesRecords().forEach((record) => {
    (record.clientSales ?? []).forEach((line) => {
      if ((Number(line.balance) || 0) <= 0) return;
      const account = getSalesCustomer(record, line);
      const debtId = `DEBT-${record.id}-${line.id}`;
      const approval = getDebtApprovals().find((item) => item.debtId === debtId);
      if (approval?.status !== "Approved Debt") return;
      debts.push({
        id: debtId,
        companyId: account.companyId,
        companyName: account.companyName,
        customerId: account.customerId,
        customerName: account.name,
        phone: account.phone,
        location: account.location,
        sourceType: "sale",
        salesId: record.id,
        amountDue: line.totalAmount,
        amountPaid: line.amountPaid,
        balance: line.balance,
        dueDate: addDays(record.date, 7),
        paymentStatus: line.amountPaid > 0 ? "Partial" : "Unpaid",
        createdAt: record.createdAt,
        approvalStatus: approval.status
      });
    });
  });

  return debts;
}

export function submitDebtApprovalRequests({
  clientSales,
  salesRecord,
  user
}: {
  clientSales: ClientSaleLine[];
  salesRecord: SalesRecord;
  user: SessionUser;
}) {
  const existing = getDebtApprovals();
  const now = new Date().toISOString();
  const companyId = (salesRecord as SalesRecord & { companyId?: string }).companyId ?? user.companyId ?? "COMP-AGAHOZO";
  const companyName = getCompanyName(companyId, user.companyName);
  const createdOrUpdated: CustomerDebtApproval[] = clientSales
    .filter((line) => (Number(line.balance) || 0) > 0)
    .map((line) => {
      const debtId = `DEBT-${salesRecord.id}-${line.id}`;
      const previous = existing.find((item) => item.debtId === debtId);
      const productSummary = line.productQuantities
        ? Object.entries(line.productQuantities)
            .filter(([, quantity]) => Number(quantity) > 0)
            .map(([product, quantity]) => `${quantity} x ${product}`)
            .join(", ")
        : `${line.quantityCartons} x ${line.productName}`;
      return {
        id: previous?.id ?? makeId("DAPR"),
        debtId,
        companyId,
        companyName,
        date: line.saleDate ?? salesRecord.date,
        marketerUsername: salesRecord.marketerUsername,
        marketerName: salesRecord.marketerName,
        customerId: getCustomerId(companyId, line.clientPhone, line.clientName),
        customerName: line.clientName,
        phone: line.clientPhone,
        location: line.clientLocation,
        productSummary,
        totalAmount: line.totalAmount,
        amountPaid: line.amountPaid,
        debtAmount: line.balance,
        salesId: salesRecord.id,
        clientSaleId: line.id,
        dueDate: addDays(line.saleDate ?? salesRecord.date, 7),
        notes: line.notes,
        status: "Pending Debt Approval" as const,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now
      };
    });

  const updated = [
    ...createdOrUpdated,
    ...existing.filter((item) => !createdOrUpdated.some((next) => next.debtId === item.debtId))
  ];
  saveDebtApprovals(updated);

  createdOrUpdated.forEach((record) => {
    logAuditEvent({
      action: "debt_submitted",
      companyId: record.companyId,
      companyName: record.companyName,
      module: "Customer Debt Approval",
      newValue: record,
      recordId: record.id,
      reason: "Marketer submitted unpaid customer sale for supervisor approval",
      status: "success",
      user
    });
  });

  return updated;
}

export function reviewDebtApproval({
  approvalId,
  action,
  reason,
  user
}: {
  approvalId: string;
  action: "supervisor_approve" | "manager_approve" | "supervisor_decline" | "manager_decline" | "request_correction" | "admin_override";
  reason: string;
  user: SessionUser;
}) {
  const approvals = getDebtApprovals();
  const oldRecord = approvals.find((item) => item.id === approvalId);
  if (!oldRecord) return approvals;

  const now = new Date().toISOString();
  const nextStatus: DebtApprovalStatus =
    action === "supervisor_approve"
      ? "Pending Manager Approval"
      : action === "manager_approve" || action === "admin_override"
        ? "Approved Debt"
        : action === "request_correction"
          ? "Correction Requested"
          : action === "supervisor_decline"
            ? "Supervisor Declined"
            : "Manager Declined";
  const updatedRecord: CustomerDebtApproval = {
    ...oldRecord,
    status: nextStatus,
    supervisorReason: user.role === "supervisor" || action === "supervisor_approve" ? reason : oldRecord.supervisorReason,
    managerReason: user.role === "manager" || action === "manager_approve" ? reason : oldRecord.managerReason,
    adminReason: action === "admin_override" ? reason : oldRecord.adminReason,
    supervisorReviewedBy: action === "supervisor_approve" ? user.displayName : oldRecord.supervisorReviewedBy,
    managerReviewedBy: action === "manager_approve" || action === "admin_override" ? user.displayName : oldRecord.managerReviewedBy,
    updatedAt: now
  };
  const updated = approvals.map((item) => (item.id === approvalId ? updatedRecord : item));
  saveDebtApprovals(updated);

  if (nextStatus === "Correction Requested") {
    saveSalesRecords(
      getSalesRecords().map((record) =>
        record.id === updatedRecord.salesId
          ? { ...record, locked: false, updatedAt: now }
          : record
      )
    );
  }

  logAuditEvent({
    action:
      action === "supervisor_approve"
        ? "supervisor_approved_debt"
        : action === "manager_approve"
          ? "manager_approved_debt"
          : action === "request_correction"
            ? "debt_correction_requested"
            : action === "admin_override"
              ? "admin_override_debt"
              : action === "supervisor_decline"
                ? "supervisor_declined_debt"
                : "manager_declined_debt",
    companyId: updatedRecord.companyId,
    companyName: updatedRecord.companyName,
    module: "Customer Debt Approval",
    oldValue: oldRecord,
    newValue: updatedRecord,
    recordId: updatedRecord.id,
    reason,
    status: "success",
    user
  });

  return updated;
}

function allocatePaymentsToDebts(debts: CustomerDebt[], payments: CustomerPayment[]) {
  const paidByCustomer = new Map<string, number>();
  payments.forEach((payment) => {
    paidByCustomer.set(payment.customerId, (paidByCustomer.get(payment.customerId) ?? 0) + payment.amountPaid);
  });

  return debts
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((debt) => {
      const available = paidByCustomer.get(debt.customerId) ?? 0;
      const extraPaid = Math.min(available, debt.balance);
      paidByCustomer.set(debt.customerId, Math.max(0, available - extraPaid));
      const amountPaid = debt.amountPaid + extraPaid;
      const balance = Math.max(0, debt.amountDue - amountPaid);
      const paymentStatus: DebtPaymentStatus =
        balance <= 0
          ? "Paid"
          : debt.dueDate < today()
            ? "Overdue"
            : amountPaid > 0
              ? "Partial"
              : "Unpaid";
      return { ...debt, amountPaid, balance, paymentStatus };
    });
}

export function getCustomerDebts(user?: SessionUser | null) {
  const records = allocatePaymentsToDebts(getSourceDebts(), getCustomerPayments());
  if (!user) return records;
  if (user.role === "client") return records.filter((record) => record.customerId === user.id);
  return filterByAssignedCompanies(records, user);
}

export function getCustomerAccounts(user?: SessionUser | null) {
  const debts = getCustomerDebts();
  const payments = getCustomerPayments();
  const accounts = getBaseCustomers().map(applyOverrides).map((account) => {
    const debtTotal = debts
      .filter((debt) => debt.customerId === account.customerId)
      .reduce((sum, debt) => sum + debt.balance, 0);
    const overpaid = Math.max(
      0,
      payments
        .filter((payment) => payment.customerId === account.customerId)
        .reduce((sum, payment) => sum + payment.amountPaid, 0) -
        getSourceDebts()
          .filter((debt) => debt.customerId === account.customerId)
          .reduce((sum, debt) => sum + debt.balance, 0)
    );
    return {
      ...account,
      currentBalance: Math.max(0, account.openingBalance + debtTotal - overpaid)
    };
  });

  if (!user) return accounts;
  if (user.role === "client") return accounts.filter((account) => account.customerId === user.id || normalizePhone(account.phone) === normalizePhone(user.phone));
  return filterByAssignedCompanies(accounts, user);
}

export function updateCustomerCredit(input: Pick<CustomerAccountOverride, "customerId" | "companyId" | "creditLimit" | "openingBalance" | "status">, user: SessionUser) {
  const now = new Date().toISOString();
  const existing = getCustomerOverrides().find((record) => record.customerId === input.customerId);
  const record: CustomerAccountOverride = {
    ...input,
    id: existing?.id ?? makeId("CUS"),
    updatedAt: now
  };
  const records = existing
    ? getCustomerOverrides().map((item) => (item.customerId === input.customerId ? record : item))
    : [record, ...getCustomerOverrides()];
  saveCustomerOverrides(records);
  logAuditEvent({
    action: existing?.status !== record.status ? "customer_blocked_unblocked" : "credit_limit_changed",
    companyId: record.companyId,
    companyName: getCompanyName(record.companyId, user.companyName),
    module: "Customers",
    oldValue: existing,
    newValue: record,
    recordId: record.customerId,
    reason: "Customer credit control updated",
    status: "success",
    user
  });
  return getCustomerAccounts(user);
}

export function recordCustomerPayment(input: Omit<CustomerPayment, "id" | "createdAt" | "updatedAt" | "recordedBy">, user: SessionUser) {
  const now = new Date().toISOString();
  const record: CustomerPayment = {
    ...input,
    id: makeId("PAY"),
    recordedBy: user.displayName,
    createdAt: now,
    updatedAt: now
  };
  saveCustomerPayments([record, ...getCustomerPayments()]);
  logAuditEvent({
    action: "payment_recorded",
    companyId: record.companyId,
    companyName: record.companyName,
    module: "Customer Payments",
    newValue: record,
    recordId: record.id,
    reason: "Customer payment recorded",
    status: "success",
    user
  });
  return record;
}

export function getCustomerStatement({
  companyId,
  customerId,
  dateFrom,
  dateTo
}: {
  companyId?: string;
  customerId: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const account = getCustomerAccounts().find((item) => item.customerId === customerId);
  if (!account) return [];

  const from = dateFrom || "1900-01-01";
  const to = dateTo || "2999-12-31";
  let balance = account.openingBalance;
  const lines: CustomerStatementLine[] = [
    {
      date: from,
      type: "Opening Balance",
      reference: "OPENING",
      description: "Opening balance",
      debit: account.openingBalance,
      credit: 0,
      balance
    }
  ];

  const purchases = getSourceDebts()
    .filter((debt) => debt.customerId === customerId && (!companyId || debt.companyId === companyId))
    .filter((debt) => debt.createdAt.slice(0, 10) >= from && debt.createdAt.slice(0, 10) <= to)
    .map((debt) => ({
      date: debt.createdAt.slice(0, 10),
      type: "Purchase" as const,
      reference: debt.orderId ?? debt.salesId ?? debt.id,
      description: `${debt.sourceType === "order" ? "Order" : "Sales"} purchase`,
      debit: debt.amountDue,
      credit: 0
    }));

  const payments = getCustomerPayments()
    .filter((payment) => payment.customerId === customerId && (!companyId || payment.companyId === companyId))
    .filter((payment) => payment.date >= from && payment.date <= to)
    .map((payment) => ({
      date: payment.date,
      type: "Payment" as const,
      reference: payment.referenceNumber || payment.id,
      description: `${payment.paymentMethod} payment`,
      debit: 0,
      credit: payment.amountPaid
    }));

  [...purchases, ...payments]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((line) => {
      balance += line.debit - line.credit;
      lines.push({ ...line, balance });
    });

  lines.push({
    date: to,
    type: "Closing Balance",
    reference: "CLOSING",
    description: "Closing balance",
    debit: 0,
    credit: 0,
    balance
  });

  return lines;
}

export function getCustomerDashboard(user?: SessionUser | null) {
  const accounts = getCustomerAccounts(user);
  const debts = getCustomerDebts(user);
  const payments = getCustomerPayments().filter((payment) => {
    if (!user) return true;
    if (user.role === "client") return payment.customerId === user.id;
    return canAccessCompany(user, payment.companyId);
  });
  return {
    totalDebt: debts.reduce((sum, debt) => sum + debt.balance, 0),
    overdueDebt: debts.filter((debt) => debt.paymentStatus === "Overdue").reduce((sum, debt) => sum + debt.balance, 0),
    overCreditLimit: accounts.filter((account) => account.currentBalance > account.creditLimit).length,
    paymentsToday: payments.filter((payment) => payment.date === today()).reduce((sum, payment) => sum + payment.amountPaid, 0)
  };
}

export function getDebtAging(debts: CustomerDebt[]) {
  const buckets = {
    "0-7 days": 0,
    "8-14 days": 0,
    "15-30 days": 0,
    "31+ days": 0
  };
  debts.forEach((debt) => {
    const age = Math.max(0, Math.floor((Date.now() - new Date(debt.createdAt).getTime()) / 86_400_000));
    if (age <= 7) buckets["0-7 days"] += debt.balance;
    else if (age <= 14) buckets["8-14 days"] += debt.balance;
    else if (age <= 30) buckets["15-30 days"] += debt.balance;
    else buckets["31+ days"] += debt.balance;
  });
  return buckets;
}

export function getCustomersForWorkspace(user: SessionUser) {
  const workspaceId = getCompanyWorkspaceId(user);
  return getCustomerAccounts(user).filter((account) => workspaceId === "all" || account.companyId === workspaceId);
}
