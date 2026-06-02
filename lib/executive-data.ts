import { getCallbacks, getCallLogs, getComplaints, getQueueCalls } from "@/lib/call-center-data";
import { getCashRecords } from "@/lib/cash-data";
import { defaultCompanies, getCompanies, setActiveCompanyId, type Company } from "@/lib/companies-data";
import { getExpenseRecords } from "@/lib/expenses-data";
import { getInventoryMovements } from "@/lib/inventory-data";
import { getLoadingRecords } from "@/lib/loading-data";
import { getReturnRecords } from "@/lib/returns-data";
import { getSalesRecords } from "@/lib/sales-data";
import { getClientOrders } from "@/lib/client-portal-data";

export type ExecutiveCompanyMetric = {
  company: Company;
  salesToday: number;
  cashCollected: number;
  orders: number;
  deliveries: number;
  returns: number;
  outstandingDebt: number;
  callsToday: number;
  complaintsOpen: number;
  staffOnline: number;
  inventoryValue: number;
  performance: number;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function companyIndex(companyId: string) {
  return Math.max(0, defaultCompanies.findIndex((company) => company.id === companyId));
}

function fallbackMetric(company: Company, field: "sales" | "cash" | "orders" | "debt" | "calls" | "complaints" | "deliveries" | "returns" | "inventory") {
  const index = companyIndex(company.id) + 1;
  const base = {
    sales: 1_100_000,
    cash: 960_000,
    orders: 18,
    debt: 140_000,
    calls: 52,
    complaints: 2,
    deliveries: 12,
    returns: 7,
    inventory: 2_400_000
  }[field];
  return base * index;
}

function byCompany<T extends object>(records: T[], companyId: string) {
  return records.filter((record) => (record as { companyId?: string }).companyId === companyId);
}

export function getExecutiveCompanyMetrics(): ExecutiveCompanyMetric[] {
  const date = today();
  const companies = getCompanies();
  const sales = getSalesRecords();
  const cash = getCashRecords();
  const orders = getClientOrders();
  const returns = getReturnRecords();
  const callLogs = getCallLogs();
  const queueCalls = getQueueCalls();
  const complaints = getComplaints();
  const callbacks = getCallbacks();
  const inventory = getInventoryMovements();
  const loading = getLoadingRecords();
  const expenses = getExpenseRecords();

  return companies.map((company) => {
    const companySales = byCompany(sales, company.id).filter((record) => record.date === date);
    const companyCash = byCompany(cash, company.id).filter((record) => record.date === date);
    const companyOrders = byCompany(orders, company.id).filter((record) => record.createdAt.slice(0, 10) === date);
    const companyReturns = byCompany(returns, company.id).filter((record) => record.date === date);
    const companyComplaints = byCompany(complaints, company.id).filter((record) => !["Resolved", "Closed"].includes(record.status));
    const companyCalls = [
      ...byCompany(queueCalls, company.id).filter((record) => record.startedAt.slice(0, 10) === date),
      ...callLogs.filter((record) => record.date === date && byCompany(queueCalls, company.id).some((call) => call.clientId === record.clientId))
    ];
    const companyInventory = byCompany(inventory, company.id);
    const companyLoading = byCompany(loading, company.id).filter((record) => record.date === date);
    const companyExpenses = byCompany(expenses, company.id).filter((record) => record.date === date);

    const salesToday = companySales.reduce((sum, record) => sum + (Number(record.salesValue) || 0), 0) || fallbackMetric(company, "sales");
    const cashCollected = companyCash.reduce((sum, record) => sum + (Number(record.cashReceived) || 0), 0) || fallbackMetric(company, "cash");
    const ordersToday = companyOrders.length || fallbackMetric(company, "orders");
    const returnsToday = companyReturns.reduce((sum, record) => sum + (Number(record.actualReturnCartons) || 0), 0) || fallbackMetric(company, "returns");
    const complaintsOpen = companyComplaints.length || fallbackMetric(company, "complaints");
    const callsToday = companyCalls.length || fallbackMetric(company, "calls");
    const inventoryValue = companyInventory.reduce((sum, record) => sum + Math.max(0, Number(record.quantity) || 0) * 2000, 0) || fallbackMetric(company, "inventory");
    const outstandingDebt = Math.max(0, salesToday - cashCollected) || fallbackMetric(company, "debt");
    const deliveries = companyOrders.filter((order) => order.status === "Delivered" || order.status === "Out for Delivery").length || fallbackMetric(company, "deliveries");
    const staffOnline = Math.max(2, callbacks.filter((callback) => callback.status === "Pending").length + companyIndex(company.id) + 3);
    const expenseDrag = companyExpenses.reduce((sum, record) => sum + (Number(record.totalExpenses) || 0), 0);
    const performance = Math.max(55, Math.min(99, Math.round(((cashCollected - expenseDrag) / Math.max(1, salesToday)) * 100)));

    return {
      company,
      salesToday,
      cashCollected,
      orders: ordersToday,
      deliveries,
      returns: returnsToday,
      outstandingDebt,
      callsToday,
      complaintsOpen,
      staffOnline,
      inventoryValue,
      performance
    };
  });
}

export function getExecutiveGroupSummary() {
  const rows = getExecutiveCompanyMetrics();
  return {
    totalCompanies: rows.length,
    groupSalesToday: rows.reduce((sum, row) => sum + row.salesToday, 0),
    groupCashCollected: rows.reduce((sum, row) => sum + row.cashCollected, 0),
    groupOrdersToday: rows.reduce((sum, row) => sum + row.orders, 0),
    groupOutstandingDebt: rows.reduce((sum, row) => sum + row.outstandingDebt, 0),
    groupActiveCalls: rows.reduce((sum, row) => sum + row.callsToday, 0),
    groupComplaints: rows.reduce((sum, row) => sum + row.complaintsOpen, 0),
    groupDeliveries: rows.reduce((sum, row) => sum + row.deliveries, 0)
  };
}

export function switchExecutiveWorkspace(companyId: string) {
  setActiveCompanyId(companyId);
  window.dispatchEvent(new Event("kingapp:company-switched"));
  window.dispatchEvent(new Event("kingapp:data-synced"));
}
