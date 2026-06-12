"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  MessageCircle,
  PackageCheck,
  Printer,
  RefreshCw,
  Send,
  ShieldCheck,
  UserCheck,
  UsersRound
} from "lucide-react";
import { CallCenterShell } from "@/components/CallCenterShell";
import { getNumbersForUser } from "@/lib/call-center-numbers";
import { getCompanyAgents } from "@/lib/call-center-operations";
import { hasPermission } from "@/lib/permissions";
import { getProducts } from "@/lib/products-data";
import { formatMoney } from "@/lib/sales-data";
import type { SessionUser } from "@/lib/auth";
import {
  assignWhatsAppChat,
  closeWhatsAppChat,
  createWhatsAppComplaint,
  createWhatsAppOrder,
  getWhatsAppAgentPresence,
  getWhatsAppChats,
  getWhatsAppComplaints,
  getWhatsAppCustomers,
  getWhatsAppDashboard,
  getWhatsAppMessages,
  getWhatsAppNotifications,
  getWhatsAppOrders,
  registerInboundWhatsAppChat,
  sendWhatsAppMessage,
  setWhatsAppAgentStatus,
  transferWhatsAppChat,
  updateWhatsAppComplaintStatus,
  whatsappIntegrationProviders,
  whatsappTemplates,
  type WhatsAppChat,
  type WhatsAppChatStatus,
  type WhatsAppComplaintPriority,
  type WhatsAppComplaintStatus,
  type WhatsAppMessageType
} from "@/lib/whatsapp-call-center-data";

const chatStatuses: WhatsAppChatStatus[] = ["New", "Open", "Pending", "Waiting Customer", "Closed"];
const complaintPriorities: WhatsAppComplaintPriority[] = ["Low", "Medium", "High", "Critical"];
const complaintStatuses: WhatsAppComplaintStatus[] = ["Open", "Approved", "Assigned", "Resolved", "Closed"];
const messageTypes: WhatsAppMessageType[] = ["Text", "Image", "PDF", "Invoice", "Dispatch Document", "Delivery Note"];

export default function WhatsAppCallCenterPage() {
  return (
    <CallCenterShell title="WhatsApp Desk" subtitle="Multi-Agent Customer Service">
      {(user) => <WhatsAppDesk user={user} />}
    </CallCenterShell>
  );
}

function WhatsAppDesk({ user }: { user: SessionUser }) {
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<WhatsAppChatStatus | "All">("All");
  const [messageBody, setMessageBody] = useState("");
  const [messageType, setMessageType] = useState<WhatsAppMessageType>("Text");
  const [fileName, setFileName] = useState("");
  const [notice, setNotice] = useState("");

  function refresh() {
    const nextChats = getWhatsAppChats(user);
    setChats(nextChats);
    setSelectedChatId((current) => current || nextChats[0]?.id || "");
  }

  useEffect(() => {
    refresh();
    setWhatsAppAgentStatus(user.role === "callcenter" ? "Online" : "Away", user);
  }, []);

  const selectedChat = chats.find((chat) => chat.id === selectedChatId) ?? chats[0];
  const messages = selectedChat ? getWhatsAppMessages(user, selectedChat.id).slice().reverse() : [];
  const customers = getWhatsAppCustomers(user);
  const orders = getWhatsAppOrders(user);
  const complaints = getWhatsAppComplaints(user);
  const notifications = getWhatsAppNotifications(user);
  const dashboard = getWhatsAppDashboard(user);
  const agents = getCompanyAgents(user);
  const agentPresence = getWhatsAppAgentPresence(user);
  const numbers = getNumbersForUser(user);
  const products = getProducts().filter(
    (product) =>
      product.status !== "Inactive" &&
      !product.deletedAt &&
      (user.assignedCompanies?.includes("all") || !product.companyId || product.companyId === user.companyId || user.assignedCompanies?.includes(product.companyId))
  );
  const selectedCustomer = customers.find((customer) => customer.id === selectedChat?.customerId);
  const canManage = hasPermission(user, "callcenter.whatsapp.manage");
  const canReply = hasPermission(user, "callcenter.whatsapp.reply") || user.role === "admin";

  const filteredChats = useMemo(() => {
    const search = query.toLowerCase();
    return chats.filter((chat) => {
      if (statusFilter !== "All" && chat.status !== statusFilter) return false;
      if (!search) return true;
      return `${chat.customerName} ${chat.phone} ${chat.lastMessage} ${chat.assignedAgentName}`.toLowerCase().includes(search);
    });
  }, [chats, query, statusFilter]);

  function handleRegisterChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const chat = registerInboundWhatsAppChat({
      address: String(form.get("address") ?? ""),
      businessNumber: String(form.get("businessNumber") ?? numbers[0]?.phoneNumber ?? ""),
      category: String(form.get("category") ?? "General") as WhatsAppChat["category"],
      customerName: String(form.get("customerName") ?? ""),
      customerType: String(form.get("customerType") ?? ""),
      initialMessage: String(form.get("initialMessage") ?? ""),
      location: String(form.get("location") ?? ""),
      phone: String(form.get("phone") ?? ""),
      user
    });
    event.currentTarget.reset();
    setNotice("WhatsApp conversation registered.");
    refresh();
    setSelectedChatId(chat.id);
  }

  function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedChat || !messageBody.trim()) return;
    sendWhatsAppMessage({
      body: messageBody,
      chatId: selectedChat.id,
      fileName,
      type: messageType,
      user
    });
    setMessageBody("");
    setFileName("");
    setNotice("Message saved to conversation history.");
    refresh();
  }

  function handleAssign(agentName: string, transfer = false) {
    if (!selectedChat) return;
    if (transfer) {
      transferWhatsAppChat(selectedChat.id, agentName, user);
      setNotice("Chat transferred.");
    } else {
      assignWhatsAppChat(selectedChat.id, agentName, user);
      setNotice("Chat assigned.");
    }
    refresh();
  }

  function handleCloseChat() {
    if (!selectedChat) return;
    closeWhatsAppChat(selectedChat.id, user);
    setNotice("Chat closed.");
    refresh();
  }

  function handleOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedChat) return;
    const form = new FormData(event.currentTarget);
    const itemCode = String(form.get("itemCode") ?? "");
    const product = products.find((item) => item.itemCode === itemCode);
    createWhatsAppOrder({
      chatId: selectedChat.id,
      deliveryAddress: String(form.get("deliveryAddress") ?? selectedCustomer?.address ?? selectedCustomer?.location ?? ""),
      itemCode,
      notes: String(form.get("notes") ?? ""),
      paymentMethod: String(form.get("paymentMethod") ?? "Cash"),
      productName: product?.name ?? "",
      quantity: Number(form.get("quantity")) || 0,
      user
    });
    event.currentTarget.reset();
    setNotice("Order sent to Store and client order queue.");
    refresh();
  }

  function handleComplaint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedChat) return;
    const form = new FormData(event.currentTarget);
    createWhatsAppComplaint({
      category: String(form.get("category") ?? ""),
      chatId: selectedChat.id,
      description: String(form.get("description") ?? ""),
      priority: String(form.get("priority") ?? "Medium") as WhatsAppComplaintPriority,
      user
    });
    event.currentTarget.reset();
    setNotice("Complaint sent to Supervisor queue.");
    refresh();
  }

  function exportReport(kind: "print" | "csv") {
    if (kind === "print") {
      window.print();
      return;
    }
    const rows = [
      ["Customer", "Phone", "Status", "Assigned Agent", "Unread", "Last Message"],
      ...filteredChats.map((chat) => [
        chat.customerName,
        chat.phone,
        chat.status,
        chat.assignedAgentName,
        String(chat.unreadCount),
        chat.lastMessage
      ])
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "kingapp-whatsapp-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800">
          {notice}
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Kpi label="Total Active Chats" value={dashboard.activeChats} />
        <Kpi label="Waiting Chats" tone="warning" value={dashboard.waitingChats} />
        <Kpi label="Assigned Chats" value={dashboard.assignedChats} />
        <Kpi label="Closed Chats" value={dashboard.closedChats} />
        <Kpi label="Unread Messages" tone="danger" value={dashboard.unreadMessages} />
        <Kpi label="Today's Orders" value={dashboard.todayOrders} />
        <Kpi label="Today's Complaints" tone="warning" value={dashboard.todayComplaints} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[360px_1fr_360px]">
        <aside className="space-y-4">
          <Panel title="WhatsApp Business Numbers">
            <div className="space-y-2">
              {numbers.map((number) => (
                <div className="rounded-lg border border-slate-200 bg-white p-3" key={number.id}>
                  <p className="font-black text-slate-950">{number.phoneNumber}</p>
                  <p className="text-xs font-bold text-slate-500">{number.label} - {number.purpose}</p>
                </div>
              ))}
              {!numbers.length ? <EmptyState text="No WhatsApp business number assigned yet." /> : null}
            </div>
          </Panel>

          <Panel title="Register Incoming WhatsApp Chat">
            <form className="grid gap-3" onSubmit={handleRegisterChat}>
              <Input label="Customer Name" name="customerName" required />
              <Input label="Phone Number" name="phone" required />
              <Input label="Location" name="location" />
              <Input label="Address" name="address" />
              <Input label="Customer Type" name="customerType" placeholder="Retailer, wholesaler, hotel..." />
              <Select label="Conversation Category" name="category" options={["General", "Order", "Payment", "Complaint", "Dispatch"]} />
              <Select label="Business Number" name="businessNumber" options={numbers.map((number) => number.phoneNumber)} />
              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase text-slate-500">Customer Message</span>
                <textarea className="form-input min-h-24" name="initialMessage" required />
              </label>
              <button className="primary-button" type="submit">Register Chat</button>
            </form>
          </Panel>

          <Panel title="Chat List">
            <div className="mb-3 grid gap-2">
              <input className="form-input" onChange={(event) => setQuery(event.target.value)} placeholder="Search customer, phone, or message" value={query} />
              <select className="form-input" onChange={(event) => setStatusFilter(event.target.value as WhatsAppChatStatus | "All")} value={statusFilter}>
                <option>All</option>
                {chatStatuses.map((status) => <option key={status}>{status}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              {filteredChats.map((chat) => (
                <button
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selectedChat?.id === chat.id ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                  key={chat.id}
                  onClick={() => setSelectedChatId(chat.id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{chat.customerName}</p>
                      <p className="text-xs font-bold text-slate-500">{chat.phone}</p>
                    </div>
                    <StatusBadge status={chat.status} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-600">{chat.lastMessage}</p>
                  <div className="mt-2 flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>{chat.assignedAgentName}</span>
                    <span>{new Date(chat.lastMessageAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </button>
              ))}
              {!filteredChats.length ? <EmptyState text="No WhatsApp conversations recorded yet." /> : null}
            </div>
          </Panel>
        </aside>

        <main className="space-y-4">
          <Panel
            action={
              <div className="flex flex-wrap gap-2">
                <button className="secondary-button !px-3 !py-2" onClick={refresh} type="button"><RefreshCw className="h-4 w-4" /> Refresh</button>
                <button className="secondary-button !px-3 !py-2" onClick={() => exportReport("print")} type="button"><Printer className="h-4 w-4" /> Print</button>
                <button className="secondary-button !px-3 !py-2" onClick={() => exportReport("csv")} type="button"><Download className="h-4 w-4" /> Excel</button>
              </div>
            }
            title={selectedChat ? selectedChat.customerName : "Conversation"}
          >
            {selectedChat ? (
              <div className="space-y-4">
                <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
                  <Info label="Phone" value={selectedChat.phone} />
                  <Info label="Company" value={selectedChat.companyName} />
                  <Info label="Assigned Agent" value={selectedChat.assignedAgentName} />
                  <Info label="Business Number" value={selectedChat.businessNumber || "Not assigned"} />
                  <Info label="Chat Lock" value={selectedChat.lockedByAgentName || "Unlocked"} />
                  <Info label="Status" value={selectedChat.status} />
                </div>

                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <select className="form-input max-w-xs" onChange={(event) => event.target.value && handleAssign(event.target.value)} defaultValue="">
                      <option value="">Assign to agent</option>
                      {agents.map((agent) => <option key={agent.id} value={agent.name}>{agent.name}</option>)}
                    </select>
                    <select className="form-input max-w-xs" onChange={(event) => event.target.value && handleAssign(event.target.value, true)} defaultValue="">
                      <option value="">Transfer chat</option>
                      {agents.map((agent) => <option key={`transfer-${agent.id}`} value={agent.name}>{agent.name}</option>)}
                    </select>
                    <button className="secondary-button" onClick={() => handleAssign(user.displayName, true)} type="button">
                      <ShieldCheck className="h-4 w-4" />
                      Supervisor Takeover
                    </button>
                    <button className="danger-button" onClick={handleCloseChat} type="button">Close Chat</button>
                  </div>
                ) : null}

                <div className="max-h-[430px] space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4">
                  {messages.map((message) => (
                    <div
                      className={`max-w-[85%] rounded-xl px-4 py-3 ${
                        message.direction === "outbound"
                          ? "ml-auto bg-brand-700 text-white"
                          : message.direction === "system"
                            ? "mx-auto bg-slate-100 text-center text-slate-600"
                            : "bg-slate-100 text-slate-900"
                      }`}
                      key={message.id}
                    >
                      <p className="text-sm font-semibold">{message.body}</p>
                      {message.fileName ? <p className="mt-2 text-xs font-black">Attachment: {message.fileName}</p> : null}
                      <p className="mt-2 text-[11px] font-bold opacity-75">
                        {message.senderName} - {new Date(message.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                  {!messages.length ? <EmptyState text="No messages yet." /> : null}
                </div>

                <form className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4" onSubmit={handleSendMessage}>
                  <div className="grid gap-3 md:grid-cols-[160px_1fr_180px]">
                    <select className="form-input" disabled={!canReply} onChange={(event) => setMessageType(event.target.value as WhatsAppMessageType)} value={messageType}>
                      {messageTypes.map((type) => <option key={type}>{type}</option>)}
                    </select>
                    <input className="form-input" disabled={!canReply} onChange={(event) => setMessageBody(event.target.value)} placeholder="Type reply or choose a quick template" value={messageBody} />
                    <input className="form-input" disabled={!canReply} onChange={(event) => setFileName(event.target.value)} placeholder="File name" value={fileName} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {whatsappTemplates.map((template) => (
                      <button className="secondary-button !px-3 !py-2 !text-xs" disabled={!canReply} key={template.name} onClick={() => setMessageBody(template.body)} type="button">
                        {template.name}
                      </button>
                    ))}
                    <button className="primary-button ml-auto" disabled={!canReply} type="submit"><Send className="h-4 w-4" /> Send Message</button>
                  </div>
                </form>
              </div>
            ) : (
              <EmptyState text="Select or register a WhatsApp conversation." />
            )}
          </Panel>

          <section className="grid gap-4 xl:grid-cols-2">
            <Panel title="Create Order">
              <form className="grid gap-3" onSubmit={handleOrder}>
                <Select label="Product" name="itemCode" options={products.map((product) => product.itemCode)} renderLabel={(code) => products.find((product) => product.itemCode === code)?.name ?? code} />
                <Input label="Quantity" name="quantity" required type="number" />
                <Input label="Delivery Address" name="deliveryAddress" defaultValue={selectedCustomer?.address || selectedCustomer?.location || ""} />
                <Select label="Payment Method" name="paymentMethod" options={["Cash", "Mobile Money", "Bank", "Cheque", "Credit"]} />
                <Input label="Notes" name="notes" />
                <button className="primary-button" disabled={!selectedChat || !canManage} type="submit">
                  <PackageCheck className="h-4 w-4" />
                  Send to Store
                </button>
              </form>
            </Panel>

            <Panel title="Create Complaint">
              <form className="grid gap-3" onSubmit={handleComplaint}>
                <Input label="Complaint Category" name="category" required />
                <Select label="Priority" name="priority" options={complaintPriorities} />
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase text-slate-500">Description</span>
                  <textarea className="form-input min-h-24" name="description" required />
                </label>
                <button className="primary-button" disabled={!selectedChat || !canManage} type="submit">
                  <AlertTriangle className="h-4 w-4" />
                  Create Complaint
                </button>
              </form>
            </Panel>
          </section>
        </main>

        <aside className="space-y-4">
          <Panel title="Customer Profile">
            {selectedCustomer ? (
              <div className="space-y-3">
                <Info label="Name" value={selectedCustomer.name} />
                <Info label="Phone" value={selectedCustomer.phone} />
                <Info label="Location" value={selectedCustomer.location || "Not recorded"} />
                <Info label="Customer Type" value={selectedCustomer.customerType || "Not recorded"} />
                <Info label="Debt Status" value={selectedCustomer.debtStatus} />
                <Info label="Total Orders" value={selectedCustomer.totalOrders.toLocaleString()} />
                <Info label="Last Contact" value={selectedCustomer.lastContactDate} />
                <Info label="Assigned Agent" value={selectedCustomer.assignedAgent || "Unassigned"} />
                <Info label="Products Purchased" value={selectedCustomer.productsPurchased.join(", ") || "No purchases recorded"} />
              </div>
            ) : (
              <EmptyState text="No customer profile selected." />
            )}
          </Panel>

          <Panel title="Agent Status">
            <div className="grid gap-2">
              {agentPresence.map((agent) => (
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3" key={agent.id}>
                  <span className="font-black text-slate-950">{agent.agentName}</span>
                  <span className="text-xs font-black text-slate-500">{agent.status}</span>
                </div>
              ))}
              {!agentPresence.length ? <EmptyState text="No agent presence recorded yet." /> : null}
            </div>
          </Panel>

          <Panel title="AI Auto Replies">
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-center gap-2 text-blue-800">
                <Bot className="h-5 w-5" />
                <p className="font-black">Optional assistant ready</p>
              </div>
              <p className="mt-2 text-sm font-semibold text-blue-700">
                The assistant can answer prices, stock availability, office hours, delivery status, contacts, and FAQs when configured. Unknown questions remain assigned to a human agent.
              </p>
            </div>
          </Panel>

          <Panel title="Notifications">
            <div className="space-y-2">
              {notifications.slice(0, 6).map((notification) => (
                <div className="rounded-lg border border-slate-200 bg-white p-3" key={notification.id}>
                  <p className="font-black text-slate-950">{notification.title}</p>
                  <p className="text-sm font-semibold text-slate-600">{notification.body}</p>
                </div>
              ))}
              {!notifications.length ? <EmptyState text="No WhatsApp notifications yet." /> : null}
            </div>
          </Panel>
        </aside>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel title="WhatsApp Orders">
          <SimpleTable
            empty="No WhatsApp orders recorded yet."
            headers={["Date", "Customer", "Product", "Qty", "Total", "Status"]}
            rows={orders.map((order) => [
              order.createdAt.slice(0, 10),
              order.customerName,
              order.productName,
              order.quantity.toLocaleString(),
              `${formatMoney(order.totalAmount)} RWF`,
              order.status
            ])}
          />
        </Panel>
        <Panel title="Complaint Management">
          <div className="space-y-3">
            {complaints.map((complaint) => (
              <div className="rounded-xl border border-slate-200 bg-white p-4" key={complaint.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{complaint.complaintNumber}</p>
                    <p className="text-sm font-semibold text-slate-600">{complaint.customerName} - {complaint.category}</p>
                  </div>
                  <span className="status-badge border-amber-200 bg-amber-50 text-amber-700">{complaint.priority}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-600">{complaint.description}</p>
                {canManage ? (
                  <select
                    className="form-input mt-3"
                    onChange={(event) => {
                      updateWhatsAppComplaintStatus(complaint.id, event.target.value as WhatsAppComplaintStatus, user);
                      refresh();
                      setNotice("Complaint status updated.");
                    }}
                    value={complaint.status}
                  >
                    {complaintStatuses.map((status) => <option key={status}>{status}</option>)}
                  </select>
                ) : (
                  <p className="mt-2 text-xs font-black text-slate-500">{complaint.status}</p>
                )}
              </div>
            ))}
            {!complaints.length ? <EmptyState text="No WhatsApp complaints recorded yet." /> : null}
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel title="Reports">
          <SimpleTable
            empty="No report rows yet."
            headers={["Metric", "Value"]}
            rows={[
              ["Daily chat report", dashboard.activeChats.toLocaleString()],
              ["Agent performance", `${dashboard.assignedChats} assigned chats`],
              ["Unread response queue", dashboard.unreadMessages.toLocaleString()],
              ["Closed tickets", dashboard.closedChats.toLocaleString()],
              ["Orders from WhatsApp", dashboard.todayOrders.toLocaleString()],
              ["Complaints report", dashboard.todayComplaints.toLocaleString()],
              ["Customer satisfaction", "Ready for rating capture"]
            ]}
          />
        </Panel>
        <Panel title="Future API Readiness">
          <div className="grid gap-3 sm:grid-cols-2">
            {whatsappIntegrationProviders.map((provider) => (
              <div className="rounded-xl border border-slate-200 bg-white p-4" key={provider}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-brand-700" />
                  <p className="font-black text-slate-950">{provider}</p>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-600">Adapter-ready provider structure.</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}

function Kpi({ label, tone = "default", value }: { label: string; tone?: "default" | "warning" | "danger"; value: number }) {
  const toneClass =
    tone === "danger"
      ? "bg-red-50 text-red-700"
      : tone === "warning"
        ? "bg-amber-50 text-amber-700"
        : "bg-emerald-50 text-emerald-700";
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className={`mt-3 inline-flex rounded-lg px-3 py-1 text-2xl font-black ${toneClass}`}>{value.toLocaleString()}</p>
    </article>
  );
}

function Panel({ action, children, title }: { action?: React.ReactNode; children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-black text-slate-950">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-800">{value || "Not recorded"}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: WhatsAppChatStatus }) {
  const className =
    status === "Closed"
      ? "border-slate-200 bg-slate-50 text-slate-600"
      : status === "New"
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : status === "Waiting Customer"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return <span className={`status-badge ${className}`}>{status}</span>;
}

function Input({
  defaultValue,
  label,
  name,
  placeholder,
  required = false,
  type = "text"
}: {
  defaultValue?: string;
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black uppercase text-slate-500">{label}</span>
      <input className="form-input" defaultValue={defaultValue} min={type === "number" ? "0" : undefined} name={name} placeholder={placeholder} required={required} type={type} />
    </label>
  );
}

function Select({
  label,
  name,
  options,
  renderLabel
}: {
  label: string;
  name: string;
  options: string[];
  renderLabel?: (value: string) => string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black uppercase text-slate-500">{label}</span>
      <select className="form-input" name={name}>
        {options.map((option) => <option key={option} value={option}>{renderLabel ? renderLabel(option) : option}</option>)}
      </select>
    </label>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-bold text-slate-500">
      {text}
    </div>
  );
}

function SimpleTable({ empty, headers, rows }: { empty: string; headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.join("-")}-${index}`}>
              {row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`}>{cell}</td>)}
            </tr>
          ))}
          {!rows.length ? <tr><td colSpan={headers.length}>{empty}</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
