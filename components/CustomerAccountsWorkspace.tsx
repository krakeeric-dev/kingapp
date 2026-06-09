"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  CreditCard,
  FileSpreadsheet,
  Printer,
  ReceiptText,
  Search,
  UserRound,
  WalletCards
} from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { getCompanies, getCompanyName } from "@/lib/companies-data";
import {
  getCustomerAccounts,
  getCustomerDashboard,
  getCustomerDebts,
  getCustomerPayments,
  getCustomerStatement,
  getDebtApprovals,
  getDebtAging,
  recordCustomerPayment,
  updateCustomerCredit,
  type CustomerAccount,
  type CustomerDebt,
  type CustomerPayment,
  type CustomerStatementLine,
  type CustomerStatus,
  type PaymentMethod
} from "@/lib/customer-accounts-data";
import { logAuditEvent } from "@/lib/loading-data";
import { hasPermission } from "@/lib/permissions";
import { formatMoney } from "@/lib/sales-data";

type CustomerMode = "accounts" | "debts" | "statements" | "payments";

const paymentMethods: PaymentMethod[] = ["Cash", "Mobile Money", "Bank", "Cheque"];
const customerStatuses: CustomerStatus[] = ["Active", "Blocked", "On Hold"];

export function CustomerAccountsWorkspace({
  mode,
  user
}: {
  mode: CustomerMode;
  user: SessionUser;
}) {
  const [accounts, setAccounts] = useState<CustomerAccount[]>([]);
  const [debts, setDebts] = useState<CustomerDebt[]>([]);
  const [payments, setPayments] = useState<CustomerPayment[]>([]);
  const [query, setQuery] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState("");

  function refresh() {
    setAccounts(getCustomerAccounts(user));
    setDebts(getCustomerDebts(user));
    setPayments(
      getCustomerPayments().filter((payment) =>
        user.role === "admin" || user.assignedCompanies?.includes("all")
          ? true
          : payment.companyId === user.companyId || user.assignedCompanies?.includes(payment.companyId)
      )
    );
  }

  useEffect(() => {
    refresh();
  }, []);

  const dashboard = getCustomerDashboard(user);
  const filteredAccounts = useMemo(() => {
    const search = query.toLowerCase();
    return accounts.filter((account) => {
      if (companyId && account.companyId !== companyId) return false;
      if (!search) return true;
      return `${account.name} ${account.phone} ${account.location}`.toLowerCase().includes(search);
    });
  }, [accounts, companyId, query]);
  const filteredDebts = useMemo(() => {
    const search = query.toLowerCase();
    return debts.filter((debt) => {
      if (companyId && debt.companyId !== companyId) return false;
      if (!search) return true;
      return `${debt.customerName} ${debt.phone} ${debt.orderId ?? ""} ${debt.salesId ?? ""}`.toLowerCase().includes(search);
    });
  }, [companyId, debts, query]);
  const filteredPayments = useMemo(() => {
    const search = query.toLowerCase();
    return payments.filter((payment) => {
      if (companyId && payment.companyId !== companyId) return false;
      if (!search) return true;
      return `${payment.customerName} ${payment.referenceNumber} ${payment.paymentMethod}`.toLowerCase().includes(search);
    });
  }, [companyId, payments, query]);
  const selectedCustomer = accounts.find((account) => account.customerId === selectedCustomerId) ?? filteredAccounts[0];
  const statementLines = selectedCustomer
    ? getCustomerStatement({
        companyId: companyId || selectedCustomer.companyId,
        customerId: selectedCustomer.customerId,
        dateFrom,
        dateTo
      })
    : [];

  function handlePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const customer = accounts.find((account) => account.customerId === String(form.get("customerId")));
    if (!customer) {
      setMessage("Select a customer before recording payment.");
      return;
    }

    recordCustomerPayment(
      {
        date: String(form.get("date") ?? ""),
        companyId: customer.companyId,
        companyName: customer.companyName,
        customerId: customer.customerId,
        customerName: customer.name,
        amountPaid: Number(form.get("amountPaid")) || 0,
        paymentMethod: String(form.get("paymentMethod") ?? "Cash") as PaymentMethod,
        referenceNumber: String(form.get("referenceNumber") ?? ""),
        notes: String(form.get("notes") ?? "")
      },
      user
    );
    event.currentTarget.reset();
    setMessage("Payment recorded and customer balance updated.");
    refresh();
  }

  function handleCreditUpdate(event: FormEvent<HTMLFormElement>, customer: CustomerAccount) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    updateCustomerCredit(
      {
        companyId: customer.companyId,
        customerId: customer.customerId,
        creditLimit: Number(form.get("creditLimit")) || 0,
        openingBalance: Number(form.get("openingBalance")) || 0,
        status: String(form.get("status") ?? customer.status) as CustomerStatus
      },
      user
    );
    setMessage("Customer credit control updated.");
    refresh();
  }

  function handleStatementExport(kind: "print" | "pdf" | "excel") {
    if (!selectedCustomer) return;
    logAuditEvent({
      action: kind === "print" ? "statement_printed" : "statement_exported",
      companyId: selectedCustomer.companyId,
      companyName: selectedCustomer.companyName,
      module: "Customer Statements",
      recordId: selectedCustomer.customerId,
      reason: `Customer statement ${kind}`,
      status: "success",
      user
    });

    if (kind === "print" || kind === "pdf") {
      window.print();
      return;
    }

    const csv = [
      ["Date", "Type", "Reference", "Description", "Debit", "Credit", "Balance"],
      ...statementLines.map((line) => [
        line.date,
        line.type,
        line.reference,
        line.description,
        String(line.debit),
        String(line.credit),
        String(line.balance)
      ])
    ].map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selectedCustomer.name}-statement.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <section className="app-card-soft p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-brand-50 p-3 text-brand-700">
              <WalletCards className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-normal text-brand-700">Customer Accounts</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">Debt, credit control, payments, and statements</h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Track customer credit exposure, unpaid invoices, payments, and printable statements by customer and company.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Tab href="/customers" label="Customers" />
            <Tab href="/customers/debts" label="Debts" />
            <Tab href="/customers/statements" label="Statements" />
            <Tab href="/customers/payments" label="Payments" />
          </div>
        </div>
      </section>

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={WalletCards} label="Total Customer Debt" value={`${formatMoney(dashboard.totalDebt)} RWF`} />
        <Metric danger icon={AlertTriangle} label="Overdue Debt" value={`${formatMoney(dashboard.overdueDebt)} RWF`} />
        <Metric danger={dashboard.overCreditLimit > 0} icon={CreditCard} label="Over Credit Limit" value={dashboard.overCreditLimit} />
        <Metric icon={Banknote} label="Payments Today" value={`${formatMoney(dashboard.paymentsToday)} RWF`} />
      </div>

      <Filters companyId={companyId} query={query} setCompanyId={setCompanyId} setQuery={setQuery} />

      {mode === "accounts" ? (
        <CustomersTable accounts={filteredAccounts} canManageCredit={hasPermission(user, "customers.credit.manage")} onCreditUpdate={handleCreditUpdate} />
      ) : null}

      {mode === "debts" ? (
        <DebtsView debts={filteredDebts} />
      ) : null}

      {mode === "payments" ? (
        <PaymentsView accounts={filteredAccounts} onPayment={handlePayment} payments={filteredPayments} />
      ) : null}

      {mode === "statements" ? (
        <StatementsView
          accounts={filteredAccounts}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFrom={setDateFrom}
          onDateTo={setDateTo}
          onExport={handleStatementExport}
          onSelectCustomer={setSelectedCustomerId}
          selectedCustomer={selectedCustomer}
          selectedCustomerId={selectedCustomer?.customerId ?? ""}
          statementLines={statementLines}
        />
      ) : null}
    </div>
  );
}

function Tab({ href, label }: { href: string; label: string }) {
  return <Link className="secondary-button" href={href}>{label}</Link>;
}

function Metric({
  danger = false,
  icon: Icon,
  label,
  value
}: {
  danger?: boolean;
  icon: typeof WalletCards;
  label: string;
  value: number | string;
}) {
  return (
    <article className="app-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-500">{label}</p>
          <p className={`mt-3 text-2xl font-black ${danger ? "text-red-700" : "text-brand-800"}`}>{value}</p>
        </div>
        <div className={`rounded-lg p-2 ${danger ? "bg-red-50 text-red-700" : "bg-brand-50 text-brand-700"}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  );
}

function Filters({
  companyId,
  query,
  setCompanyId,
  setQuery
}: {
  companyId: string;
  query: string;
  setCompanyId: (value: string) => void;
  setQuery: (value: string) => void;
}) {
  return (
    <section className="app-card p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="form-input pl-10" onChange={(event) => setQuery(event.target.value)} placeholder="Search customer, phone, location, order, or reference..." value={query} />
        </label>
        <select className="form-input" onChange={(event) => setCompanyId(event.target.value)} value={companyId}>
          <option value="">All Companies</option>
          {getCompanies().map((company) => (
            <option key={company.id} value={company.id}>{company.name}</option>
          ))}
        </select>
      </div>
    </section>
  );
}

function CustomersTable({
  accounts,
  canManageCredit,
  onCreditUpdate
}: {
  accounts: CustomerAccount[];
  canManageCredit: boolean;
  onCreditUpdate: (event: FormEvent<HTMLFormElement>, customer: CustomerAccount) => void;
}) {
  return (
    <section className="app-card p-5">
      <h3 className="text-lg font-black text-slate-950">Customer Account List</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer ID</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Location</th>
              <th>Company</th>
              <th>Credit Limit</th>
              <th>Opening Balance</th>
              <th>Current Balance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.customerId}>
                <td className="font-black text-slate-950">{account.customerId}</td>
                <td>{account.name}</td>
                <td>{account.phone}</td>
                <td>{account.location}</td>
                <td>{account.companyName}</td>
                <td>{formatMoney(account.creditLimit)} RWF</td>
                <td>{formatMoney(account.openingBalance)} RWF</td>
                <td className={account.currentBalance > account.creditLimit ? "font-black text-red-700" : "font-black text-brand-800"}>{formatMoney(account.currentBalance)} RWF</td>
                <td><StatusBadge label={account.status} /></td>
              </tr>
            ))}
            {!accounts.length ? <tr><td colSpan={9}>No customer accounts yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
      {canManageCredit ? (
        <div className="mt-5 grid gap-4">
          {accounts.map((account) => (
            <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-5" key={`credit-${account.customerId}`} onSubmit={(event) => onCreditUpdate(event, account)}>
              <div>
                <p className="font-black text-slate-950">{account.name}</p>
                <p className="text-sm text-slate-500">{account.phone}</p>
              </div>
              <Input defaultValue={String(account.creditLimit)} label="Credit Limit" name="creditLimit" type="number" />
              <Input defaultValue={String(account.openingBalance)} label="Opening Balance" name="openingBalance" type="number" />
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Status</span>
                <select className="form-input" defaultValue={account.status} name="status">
                  {customerStatuses.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
              <button className="secondary-button">Save Credit Control</button>
            </form>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function DebtsView({ debts }: { debts: CustomerDebt[] }) {
  const aging = getDebtAging(debts);
  const approvals = getDebtApprovals();
  const pendingApprovals = approvals.filter((approval) => approval.status === "Pending Debt Approval" || approval.status === "Pending Manager Approval").length;
  const approvedApprovals = approvals.filter((approval) => approval.status === "Approved Debt").length;
  const rejectedApprovals = approvals.filter((approval) => approval.status === "Debt Rejected").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={WalletCards} label="Pending Approval" value={pendingApprovals} />
        <Metric icon={WalletCards} label="Approved Debt" value={approvedApprovals} />
        <Metric danger icon={AlertTriangle} label="Rejected Debt" value={rejectedApprovals} />
        <Metric danger icon={AlertTriangle} label="Overdue Debt" value={debts.filter((debt) => debt.paymentStatus === "Overdue").length} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(aging).map(([label, value]) => (
          <Metric danger={label === "31+ days" && value > 0} icon={AlertTriangle} key={label} label={label} value={`${formatMoney(value)} RWF`} />
        ))}
      </div>
      <section className="app-card p-5">
        <h3 className="text-lg font-black text-slate-950">Debt Tracking</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Reference</th>
                <th>Amount Due</th>
                <th>Amount Paid</th>
                <th>Balance</th>
                <th>Due Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {debts.map((debt) => (
                <tr key={debt.id}>
                  <td className="font-black text-slate-950">{debt.customerName}</td>
                  <td>{debt.phone}</td>
                  <td>{debt.orderId ?? debt.salesId}</td>
                  <td>{formatMoney(debt.amountDue)} RWF</td>
                  <td>{formatMoney(debt.amountPaid)} RWF</td>
                  <td className="font-black text-red-700">{formatMoney(debt.balance)} RWF</td>
                  <td>{debt.dueDate}</td>
                  <td><StatusBadge label={debt.paymentStatus} /></td>
                </tr>
              ))}
              {!debts.length ? <tr><td colSpan={8}>No customer debts yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PaymentsView({
  accounts,
  onPayment,
  payments
}: {
  accounts: CustomerAccount[];
  onPayment: (event: FormEvent<HTMLFormElement>) => void;
  payments: CustomerPayment[];
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <section className="app-card p-5">
        <h3 className="text-lg font-black text-slate-950">Record Payment Receipt</h3>
        <form className="mt-4 grid gap-3" onSubmit={onPayment}>
          <Input defaultValue={new Date().toISOString().slice(0, 10)} label="Date" name="date" type="date" />
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Customer</span>
            <select className="form-input" name="customerId" required>
              <option value="">Select customer</option>
              {accounts.map((account) => (
                <option key={account.customerId} value={account.customerId}>{account.name} - {account.phone}</option>
              ))}
            </select>
          </label>
          <Input label="Amount Paid" name="amountPaid" type="number" />
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Payment Method</span>
            <select className="form-input" name="paymentMethod">
              {paymentMethods.map((method) => <option key={method}>{method}</option>)}
            </select>
          </label>
          <Input label="Reference Number" name="referenceNumber" />
          <Input label="Notes" name="notes" />
          <button className="primary-button">Record Payment</button>
        </form>
      </section>
      <section className="app-card p-5">
        <h3 className="text-lg font-black text-slate-950">Payment Receipts</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Recorded By</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.date}</td>
                  <td className="font-black text-slate-950">{payment.customerName}</td>
                  <td>{formatMoney(payment.amountPaid)} RWF</td>
                  <td>{payment.paymentMethod}</td>
                  <td>{payment.referenceNumber || payment.id}</td>
                  <td>{payment.recordedBy}</td>
                  <td>{payment.notes}</td>
                </tr>
              ))}
              {!payments.length ? <tr><td colSpan={7}>No customer payments yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatementsView({
  accounts,
  dateFrom,
  dateTo,
  onDateFrom,
  onDateTo,
  onExport,
  onSelectCustomer,
  selectedCustomer,
  selectedCustomerId,
  statementLines
}: {
  accounts: CustomerAccount[];
  dateFrom: string;
  dateTo: string;
  onDateFrom: (value: string) => void;
  onDateTo: (value: string) => void;
  onExport: (kind: "print" | "pdf" | "excel") => void;
  onSelectCustomer: (value: string) => void;
  selectedCustomer?: CustomerAccount;
  selectedCustomerId: string;
  statementLines: CustomerStatementLine[];
}) {
  return (
    <section className="app-card p-5">
      <div className="no-print grid gap-3 md:grid-cols-[1fr_180px_180px_auto] md:items-end">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Customer</span>
          <select className="form-input" onChange={(event) => onSelectCustomer(event.target.value)} value={selectedCustomerId}>
            {accounts.map((account) => (
              <option key={account.customerId} value={account.customerId}>{account.name} - {account.phone}</option>
            ))}
          </select>
        </label>
        <Input label="From" name="dateFrom" onChange={onDateFrom} type="date" value={dateFrom} />
        <Input label="To" name="dateTo" onChange={onDateTo} type="date" value={dateTo} />
        <div className="flex flex-wrap gap-2">
          <button className="secondary-button" onClick={() => onExport("print")} type="button"><Printer className="h-4 w-4" /> Print</button>
          <button className="secondary-button" onClick={() => onExport("pdf")} type="button"><ReceiptText className="h-4 w-4" /> PDF</button>
          <button className="secondary-button" onClick={() => onExport("excel")} type="button"><FileSpreadsheet className="h-4 w-4" /> Excel</button>
        </div>
      </div>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase text-brand-700">KingApp Customer Statement</p>
            <h3 className="mt-1 text-2xl font-black text-slate-950">{selectedCustomer?.name ?? "No customer"}</h3>
            <p className="mt-1 text-sm text-slate-600">{selectedCustomer?.phone} - {selectedCustomer?.location}</p>
          </div>
          <div className="text-sm font-bold text-slate-600 sm:text-right">
            <p>{selectedCustomer?.companyName}</p>
            <p>{dateFrom} to {dateTo}</p>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Reference</th>
                <th>Description</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {statementLines.map((line, index) => (
                <tr key={`${line.reference}-${index}`}>
                  <td>{line.date}</td>
                  <td>{line.type}</td>
                  <td>{line.reference}</td>
                  <td>{line.description}</td>
                  <td>{formatMoney(line.debit)} RWF</td>
                  <td>{formatMoney(line.credit)} RWF</td>
                  <td className="font-black text-slate-950">{formatMoney(line.balance)} RWF</td>
                </tr>
              ))}
              {!statementLines.length ? <tr><td colSpan={7}>No statement records for this customer.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function StatusBadge({ label }: { label: string }) {
  const tone = label === "Blocked" || label === "Overdue"
    ? "border-red-200 bg-red-50 text-red-700"
    : label === "On Hold" || label === "Partial" || label === "Unpaid"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return <span className={`status-badge ${tone}`}>{label}</span>;
}

function Input({
  defaultValue,
  label,
  name,
  onChange,
  type = "text",
  value
}: {
  defaultValue?: string;
  label: string;
  name: string;
  onChange?: (value: string) => void;
  type?: string;
  value?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</span>
      <input
        className="form-input"
        defaultValue={value === undefined ? defaultValue : undefined}
        min={type === "number" ? "0" : undefined}
        name={name}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        type={type}
        value={value}
      />
    </label>
  );
}
