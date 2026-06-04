"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellRing,
  BookOpen,
  Box,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  CreditCard,
  Gauge,
  Headphones,
  Home,
  MessageCircle,
  MessageSquare,
  MessageSquareWarning,
  Megaphone,
  MicOff,
  Pause,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  Radio,
  Search,
  ShoppingCart,
  Trophy,
  Truck,
  UserRound,
  UsersRound,
  WalletCards
} from "lucide-react";
import {
  CallCenterMobileBlock,
  useIsMobileScreen
} from "@/components/CallCenterDesktopOnly";
import { ClientAutoPopup } from "@/components/ClientAutoPopup";
import { KingAppLogo } from "@/components/KingAppLogo";
import type { SessionUser } from "@/lib/auth";
import { canAccessRoute } from "@/lib/permissions";
import { formatMoney } from "@/lib/sales-data";
import { getSession } from "@/lib/storage";
import {
  addCallLog,
  addCallback,
  addComplaint,
  addPaymentFollowUp,
  getCallLogs,
  getComplaints,
  getPaymentFollowUps,
  saveClientNotes,
  type CallbackItem,
  type CallCenterAgent,
  type CallCenterClient,
  type CallLog,
  type CallType,
  type PendingOrder,
  type QueueCall
} from "@/lib/call-center-data";
import {
  callCenterCompanies,
  createOneClickOrder,
  getActiveCallCenterCompanyForUser,
  getCompanyClients,
  getCompanyAgents,
  getCompanyCallbacks,
  getCompanyComplaints,
  getCompanyOrders,
  getCompanyPayments,
  getCompanyQueueCalls,
  setActiveCallCenterCompany
} from "@/lib/call-center-operations";
import { sendWhatsAppNotification } from "@/lib/notificationService";
import { getProducts, type ProductMaster } from "@/lib/products-data";
import {
  getAnnouncementsForUser,
  getClientTimeline,
  getMessagingDashboardStats,
  type TeamAnnouncement
} from "@/lib/messageService";

type ActionMode = "order" | "payment" | "complaint" | "delivery" | "callback";
type DetailTab = "orders" | "payments" | "notes";

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const nowTime = () => new Date().toTimeString().slice(0, 5);

const menuItems = [
  { label: "Dashboard", href: "/call-center", icon: Home, badge: "" },
  { label: "Incoming Calls", href: "/call-center/queue", icon: PhoneIncoming, badge: "2" },
  { label: "Softphone", href: "/call-center/softphone", icon: PhoneCall, badge: "" },
  { label: "Live Monitor", href: "/call-center/live-monitor", icon: Bell, badge: "" },
  { label: "Performance", href: "/call-center/performance", icon: Trophy, badge: "" },
  { label: "Clients", href: "#clients", icon: UsersRound, badge: "" },
  { label: "Orders", href: "#orders", icon: ClipboardList, badge: "" },
  { label: "Follow Ups", href: "/call-center/callbacks", icon: CalendarClock, badge: "" },
  { label: "Messages", href: "/call-center/messages", icon: MessageSquare, badge: "" },
  { label: "Chat", href: "/call-center/chat", icon: MessageCircle, badge: "" },
  { label: "Announcements", href: "/call-center/announcements", icon: Megaphone, badge: "" },
  { label: "Complaints", href: "/call-center/complaints", icon: MessageSquareWarning, badge: "" },
  { label: "Payments", href: "#payments", icon: CreditCard, badge: "" },
  { label: "Recordings", href: "/call-center/recordings", icon: Radio, badge: "" },
  { label: "Wallboard", href: "/call-center/wallboard", icon: Gauge, badge: "" },
  { label: "Analytics", href: "/call-center/analytics", icon: BookOpen, badge: "" },
  { label: "Settings", href: "/call-center/settings", icon: UserRound, badge: "" },
  { label: "Go-Live Checklist", href: "/call-center/production-checklist", icon: ClipboardList, badge: "" }
];

const toolItems = [
  { label: "Client Search", href: "#clients", icon: Search },
  { label: "Order Quick Entry", href: "#current-order", icon: Box },
  { label: "Callback List", href: "/call-center/callbacks", icon: PhoneCall },
  { label: "Reminders", href: "#reminders", icon: CalendarClock }
];

export default function CallCenterPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const isMobileScreen = useIsMobileScreen();

  useEffect(() => {
    const session = getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    if (!canAccessRoute(session, "/call-center")) {
      window.sessionStorage.setItem("kingapp.permissionMessage", "You do not have permission to access this operation.");
      router.push("/dashboard");
      return;
    }

    setUser(session);
  }, [router]);

  if (!user) {
    return <main className="min-h-screen bg-slate-950" />;
  }

  if (isMobileScreen) {
    return <CallCenterMobileBlock />;
  }

  return <CallCenterOffice user={user} />;
}

function CallCenterOffice({ user }: { user: SessionUser }) {
  const [clients, setClients] = useState<CallCenterClient[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [payments, setPayments] = useState<ReturnType<typeof getPaymentFollowUps>>([]);
  const [complaints, setComplaints] = useState<ReturnType<typeof getComplaints>>([]);
  const [callbacks, setCallbacks] = useState<CallbackItem[]>([]);
  const [queueCalls, setQueueCalls] = useState<QueueCall[]>([]);
  const [agents, setAgents] = useState<CallCenterAgent[]>([]);
  const [products, setProducts] = useState<ProductMaster[]>([]);
  const [announcements, setAnnouncements] = useState<TeamAnnouncement[]>([]);
  const [activeCompany, setActiveCompany] = useState("all");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [actionMode, setActionMode] = useState<ActionMode>("order");
  const [tab, setTab] = useState<DetailTab>("orders");
  const [noteDraft, setNoteDraft] = useState("");
  const [orderForm, setOrderForm] = useState({
    product: "",
    quantity: "20",
    deliveryDate: today(),
    deliveryTime: "16:00",
    notes: ""
  });
  const [paymentForm, setPaymentForm] = useState({
    amountDue: "",
    daysOutstanding: "",
    promiseToPayDate: today(),
    comment: ""
  });
  const [complaintForm, setComplaintForm] = useState({
    complaintType: "delayed truck",
    product: "",
    quantity: "",
    description: "",
    priority: "Medium"
  });
  const [callbackForm, setCallbackForm] = useState({
    callbackDate: today(),
    callbackTime: "14:00",
    reason: "",
    priority: "Medium"
  });

  useEffect(() => {
    const loadedClients = getCompanyClients(user);
    setClients(loadedClients);
    setSelectedClientId(loadedClients[0]?.id ?? "");
    setCallLogs(getCallLogs().filter((log) => loadedClients.some((client) => client.id === log.clientId)));
    setOrders(getCompanyOrders(user));
    setPayments(getCompanyPayments(user));
    setComplaints(getCompanyComplaints(user));
    setCallbacks(getCompanyCallbacks(user));
    setQueueCalls(getCompanyQueueCalls(user));
    setAgents(getCompanyAgents(user));
    setProducts(getProducts());
    setAnnouncements(getAnnouncementsForUser(user));
    setActiveCompany(getActiveCallCenterCompanyForUser(user));
  }, [user]);

  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? clients[0];
  const currentCall = queueCalls.find((call) => call.status === "Active") ?? queueCalls.find((call) => call.status === "Incoming");
  const agentsOnline = agents.filter((agent) => agent.status !== "Offline").length;
  const callsInQueue = queueCalls.filter((call) => call.status === "Waiting" || call.status === "Incoming").length;
  const todaysLogs = callLogs.filter((record) => record.date === today());
  const pendingOrders = orders.filter((order) => order.status === "Pending Storekeeper");
  const dueCallbacks = callbacks.filter((callback) => callback.status === "Pending");
  const filteredClients = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (!search) {
      return clients;
    }

    return clients.filter((client) =>
      `${client.clientName} ${client.ownerName} ${client.phone} ${client.area}`
        .toLowerCase()
        .includes(search)
    );
  }, [clients, query]);

  const stats = {
    answered: todaysLogs.filter((record) => record.outcome === "Closed").length,
    missed: queueCalls.filter((call) => call.status === "Missed").length,
    ordersTaken: orders.filter((record) => record.createdAt.slice(0, 10) === today()).length,
    followUps: callbacks.filter((record) => record.callbackDate === today()).length,
    complaints: complaints.filter((record) => record.createdAt.slice(0, 10) === today()).length
  };

  const kpis = {
    todayOrders: stats.ordersTaken,
    pendingOrders: pendingOrders.length,
    deliveriesToday: orders.filter((order) => order.deliveryDate === today()).length,
    paymentsDue: payments.filter((payment) => payment.status !== "Closed").reduce((sum, payment) => sum + payment.amountDue, 0)
  };
  const messagingStats = getMessagingDashboardStats(user);

  function requireClient() {
    if (!selectedClient) {
      setMessage("Select a client first.");
      return null;
    }

    return selectedClient;
  }

  function sendOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = requireClient();
    const quantity = Number(orderForm.quantity);

    if (!client || !orderForm.product || !Number.isFinite(quantity) || quantity <= 0) {
      setMessage("Select product and quantity before sending order.");
      return;
    }

    const result = createOneClickOrder(
      client,
      {
        productName: orderForm.product,
        quantity,
        deliveryDate: orderForm.deliveryDate,
        notes: `${orderForm.notes} Delivery time: ${orderForm.deliveryTime}`.trim()
      },
      user
    );
    setOrders(result.pendingOrders);
    sendWhatsAppNotification("Order Received", {
      clientName: client.clientName,
      phone: client.phone,
      orderNumber: result.portalOrder.id
    });
    setMessage("Order sent to Client Orders and Storekeeper Loading Queue.");
  }

  function savePaymentReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = requireClient();

    if (!client) return;

    setPayments(
      addPaymentFollowUp(
        client,
        {
          amountDue: Number(paymentForm.amountDue) || client.currentBalance,
          daysOutstanding: Number(paymentForm.daysOutstanding) || 0,
          promiseToPayDate: paymentForm.promiseToPayDate,
          comment: paymentForm.comment,
          status: "Open"
        },
        user
      )
    );
    setMessage("Payment reminder saved for Accountant.");
  }

  function saveComplaint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = requireClient();

    if (!client) return;

    setComplaints(
      addComplaint(
        client,
        {
          complaintType: complaintForm.complaintType,
          product: complaintForm.product,
          quantity: Number(complaintForm.quantity) || 0,
          description: complaintForm.description,
          priority: complaintForm.priority,
          status: "Open"
        },
        user
      )
    );
    setMessage("Complaint logged for Supervisor/Admin.");
  }

  function scheduleCallback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = requireClient();

    if (!client) return;

    setCallbacks(
      addCallback({
        clientId: client.id,
        clientName: client.clientName,
        phone: client.phone,
        callbackDate: callbackForm.callbackDate,
        callbackTime: callbackForm.callbackTime,
        reason: callbackForm.reason || "Client callback",
        assignedAgent: user.displayName,
        priority: callbackForm.priority as CallbackItem["priority"],
        status: "Pending"
      })
    );
    setMessage("Callback scheduled.");
  }

  function endCurrentCall() {
    const client = requireClient();

    if (!client) return;

    setCallLogs(
      addCallLog(
        {
          date: today(),
          time: nowTime(),
          clientId: client.id,
          clientName: client.clientName,
          phone: client.phone,
          callType: "Customer Care" as CallType,
          duration: "3 min",
          outcome: "Closed",
          nextAction: "Call ended from command center"
        },
        user
      )
    );
    setMessage("Call ended and logged.");
  }

  function saveNote() {
    const client = requireClient();

    if (!client || !noteDraft.trim()) return;

    const updatedClients = saveClientNotes(client.id, [noteDraft.trim(), ...client.notes]);
    setClients(updatedClients);
    setNoteDraft("");
    setMessage("Client note saved.");
  }

  return (
    <main className="min-h-screen bg-[#f3f6fb] text-slate-950">
      <div className="flex min-h-screen">
        <CallCenterSidebar user={user} />
        <section className="min-w-0 flex-1">
          <TopBar
            activeCompany={activeCompany}
            agentsOnline={agentsOnline}
            callsInQueue={callsInQueue}
            onCompanyChange={(companyId) => setActiveCompany(setActiveCallCenterCompany(companyId))}
            user={user}
          />
          <div className="space-y-4 p-4 lg:p-6">
            {message ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                {message}
              </div>
            ) : null}

            {announcements[0] ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
                <Megaphone className="mr-2 inline h-4 w-4" />
                {announcements[0].title}: {announcements[0].body}
              </div>
            ) : null}

            {currentCall ? (
              <ClientAutoPopup
                call={currentCall}
                client={clients.find((client) => client.id === currentCall.clientId) ?? selectedClient}
              />
            ) : null}

            <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <CurrentCallCard call={currentCall} client={selectedClient} onEnd={endCurrentCall} onMessage={setMessage} />
                <QuickActions active={actionMode} onSelect={setActionMode} />
                <CallStats stats={stats} />
              </div>

              <div className="min-w-0 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <KpiCard accent="green" icon={ShoppingCart} label="Today Orders" subtext="+13% vs yesterday" value={kpis.todayOrders.toLocaleString()} />
                  <KpiCard accent="amber" icon={ClipboardList} label="Pending Orders" subtext="View all pending" value={kpis.pendingOrders.toLocaleString()} />
                  <KpiCard accent="blue" icon={Truck} label="Deliveries Today" subtext="On the way: 6" value={kpis.deliveriesToday.toLocaleString()} />
                  <KpiCard accent="red" icon={WalletCards} label="Payments Due" subtext={`From ${payments.length} clients`} value={`${formatMoney(kpis.paymentsDue)} RWF`} />
                  <KpiCard accent="blue" icon={MessageSquare} label="Messages Today" subtext="Internal inbox" value={messagingStats.messagesToday.toLocaleString()} />
                  <KpiCard accent="red" icon={MessageSquareWarning} label="Unread Messages" subtext="Need attention" value={messagingStats.unreadMessages.toLocaleString()} />
                  <KpiCard accent="amber" icon={Megaphone} label="Announcements" subtext="Team broadcasts" value={messagingStats.announcements.toLocaleString()} />
                  <KpiCard accent="red" icon={Bell} label="Urgent Alerts" subtext="Orders, complaints, callbacks" value={messagingStats.urgentAlerts.toLocaleString()} />
                  <KpiCard accent="blue" icon={MessageCircle} label="Active Chats" subtext="Live team rooms" value={messagingStats.activeChats.toLocaleString()} />
                  <KpiCard accent="green" icon={Clock} label="Response Time" subtext="Average today" value={messagingStats.responseTime} />
                </div>

                <Panel id="orders" title="Pending Orders (Real Time)" action={<Link className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-black text-blue-700" href="/loading">View All Orders</Link>}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs font-black uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-3">#</th>
                          <th className="px-3 py-3">Client</th>
                          <th className="px-3 py-3">Items</th>
                          <th className="px-3 py-3">Total</th>
                          <th className="px-3 py-3">Requested Delivery</th>
                          <th className="px-3 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingOrders.slice(0, 6).map((order, index) => (
                          <tr className="border-t border-slate-100" key={order.id}>
                            <td className="px-3 py-3 font-bold">{index + 1}</td>
                            <td className="px-3 py-3 font-black">{order.clientName}</td>
                            <td className="px-3 py-3">{order.quantity} x {order.product}</td>
                            <td className="px-3 py-3">{formatMoney(order.quantity * 2000)}</td>
                            <td className="px-3 py-3">{order.deliveryDate}</td>
                            <td className="px-3 py-3"><StatusPill label="Waiting Loading" tone="amber" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>

                <Panel title="Call Log (Today)">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs font-black uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-3">Time</th>
                          <th className="px-3 py-3">Client</th>
                          <th className="px-3 py-3">Number</th>
                          <th className="px-3 py-3">Type</th>
                          <th className="px-3 py-3">Outcome</th>
                          <th className="px-3 py-3">Agent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {todaysLogs.slice(0, 6).map((record) => (
                          <tr className="border-t border-slate-100" key={record.id}>
                            <td className="px-3 py-3">{record.time}</td>
                            <td className="px-3 py-3 font-black">{record.clientName}</td>
                            <td className="px-3 py-3">{record.phone}</td>
                            <td className="px-3 py-3">{record.callType}</td>
                            <td className="px-3 py-3"><StatusPill label={record.outcome} tone={record.outcome === "Closed" ? "green" : "blue"} /></td>
                            <td className="px-3 py-3">{record.agent}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {todaysLogs.length === 0 ? (
                      <p className="px-3 py-4 text-sm font-semibold text-slate-500">No calls logged today yet.</p>
                    ) : null}
                  </div>
                </Panel>

                <Panel id="reminders" title="Reminders & Callbacks">
                  <div className="divide-y divide-slate-100">
                    {dueCallbacks.slice(0, 4).map((callback) => (
                      <div className="grid gap-3 py-3 sm:grid-cols-[120px_1fr_48px] sm:items-center" key={callback.id}>
                        <div className="rounded-lg bg-purple-50 px-3 py-2 text-sm font-black text-purple-700">
                          {callback.callbackDate === today() ? "Today" : callback.callbackDate}<br />{callback.callbackTime}
                        </div>
                        <div>
                          <p className="font-black">{callback.clientName}</p>
                          <p className="text-sm font-semibold text-slate-500">{callback.reason}</p>
                          <p className="text-xs font-bold text-slate-400">Agent: {callback.assignedAgent}</p>
                        </div>
                        <button className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700" type="button">
                          <PhoneCall className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>

              {selectedClient ? (
                <aside className="space-y-4">
                  <ClientDetailsCard client={selectedClient} onSearch={setQuery} query={query} results={filteredClients} onSelect={setSelectedClientId} />
                  <ClientTabs active={tab} client={selectedClient} orders={orders} payments={payments} onChange={setTab} />
                  <ClientTimeline client={selectedClient} />
                  <CurrentOrderCard
                    actionMode={actionMode}
                    callbackForm={callbackForm}
                    complaintForm={complaintForm}
                    onCallbackChange={setCallbackForm}
                    onCallbackSubmit={scheduleCallback}
                    onComplaintChange={setComplaintForm}
                    onComplaintSubmit={saveComplaint}
                    onOrderChange={setOrderForm}
                    onOrderSubmit={sendOrder}
                    onPaymentChange={setPaymentForm}
                    onPaymentSubmit={savePaymentReminder}
                    orderForm={orderForm}
                    paymentForm={paymentForm}
                    products={products}
                  />
                  <NotesCard client={selectedClient} noteDraft={noteDraft} onNoteChange={setNoteDraft} onSave={saveNote} />
                </aside>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function CallCenterSidebar({ user }: { user: SessionUser }) {
  return (
    <aside className="hidden w-72 shrink-0 flex-col bg-[#061b33] text-white shadow-2xl lg:flex">
      <div className="border-b border-white/10 p-7">
        <div className="flex items-center gap-3">
          <KingAppLogo size={48} />
          <div>
            <h1 className="text-2xl font-black tracking-wide">KINGAPP</h1>
            <p className="text-xs font-semibold text-blue-200">Powering Distribution</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-8 overflow-y-auto p-5">
        <SidebarGroup title="Main">
          {menuItems.filter((item) => canAccessRoute(user, normalizeMenuHref(item.href))).map((item, index) => (
            <SidebarLink active={index === 0} href={item.href} icon={item.icon} key={item.label} label={item.label} badge={item.badge} />
          ))}
        </SidebarGroup>
        <SidebarGroup title="Tools">
          {toolItems.map((item) => (
            <SidebarLink href={item.href} icon={item.icon} key={item.label} label={item.label} />
          ))}
        </SidebarGroup>
      </nav>

      <div className="border-t border-white/10 p-6 text-center">
        <KingAppLogo className="mx-auto mb-3" size={64} />
        <p className="text-xl font-black">KINGAPP</p>
        <p className="text-sm font-semibold text-blue-100">Call Center Module</p>
        <p className="mt-8 text-xs font-semibold text-blue-200">Version 1.0.0</p>
      </div>
    </aside>
  );
}

function normalizeMenuHref(href: string) {
  return href.startsWith("#") ? "/call-center" : href.split("#")[0];
}

function TopBar({
  activeCompany,
  agentsOnline,
  callsInQueue,
  onCompanyChange,
  user
}: {
  activeCompany: string;
  agentsOnline: number;
  callsInQueue: number;
  onCompanyChange: (companyId: string) => void;
  user: SessionUser;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur lg:px-7">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-950">Call Center Office</h2>
          <p className="text-sm font-black text-blue-700">Client Calls Team</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <TopMetric icon={PhoneCall} label="Connected" value="00:03:12" tone="green" />
          <TopMetric label="Calls in Queue" value={callsInQueue.toLocaleString()} />
          <TopMetric label="Agents Online" value={agentsOnline.toLocaleString()} dot />
          {user.role === "admin" || user.role === "manager" ? (
            <select
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black text-slate-700 outline-none"
              onChange={(event) => onCompanyChange(event.target.value)}
              value={activeCompany}
            >
              <option value="all">All Companies</option>
              {callCenterCompanies.map((company) => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          ) : null}
          <button className="relative rounded-lg p-2 text-slate-700 hover:bg-slate-100" type="button">
            <Bell className="h-5 w-5" />
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white">5</span>
          </button>
          <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-sm font-black text-amber-800">
              {user.displayName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-black text-slate-950">{user.displayName}</p>
              <p className="text-xs font-semibold text-slate-500">Call Center Agent</p>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </div>
        </div>
      </div>
    </header>
  );
}

function CurrentCallCard({ call, client, onEnd, onMessage }: { call?: QueueCall; client?: CallCenterClient; onEnd: () => void; onMessage: (message: string) => void }) {
  const displayName = call?.clientName ?? client?.clientName ?? "No active client";
  const phone = call?.phone ?? client?.phone ?? "";
  const location = call?.location ?? client?.area ?? "";

  return (
    <Panel title="Current Call" action={<span className="rounded-md bg-emerald-500 px-2 py-1 text-xs font-black text-white">LIVE</span>}>
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <PhoneCall className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-black">{displayName}</h3>
        <p className="mt-1 font-bold text-slate-700">{phone}</p>
        <p className="text-sm font-semibold text-slate-500">{location}</p>
        <p className="mt-5 flex items-center gap-2 text-sm font-bold text-slate-500">
          <span className="h-2 w-2 rounded-full bg-emerald-300" />
          00:01:24
        </p>
      </div>
      <div className="mt-5 grid gap-2">
        <button className="rounded-lg bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-sm" onClick={() => onMessage("Call marked answered.")} type="button">
          <Phone className="mr-2 inline h-4 w-4" />
          Answered
        </button>
        <button className="secondary-button w-full" onClick={() => onMessage("Call placed on hold.")} type="button"><Pause className="h-4 w-4" /> Hold</button>
        <button className="secondary-button w-full" onClick={() => onMessage("Call muted.")} type="button"><MicOff className="h-4 w-4" /> Mute</button>
        <button className="danger-button w-full" onClick={onEnd} type="button"><PhoneOff className="h-4 w-4" /> End Call</button>
      </div>
    </Panel>
  );
}

function QuickActions({ active, onSelect }: { active: ActionMode; onSelect: (mode: ActionMode) => void }) {
  const actions: Array<{ icon: typeof ShoppingCart; label: string; mode: ActionMode; tone: string }> = [
    { icon: ShoppingCart, label: "New Order", mode: "order", tone: "bg-emerald-500" },
    { icon: BellRing, label: "Payment Reminder", mode: "payment", tone: "bg-amber-500" },
    { icon: MessageSquareWarning, label: "Complaint", mode: "complaint", tone: "bg-red-500" },
    { icon: Truck, label: "Delivery Follow Up", mode: "delivery", tone: "bg-blue-500" },
    { icon: Headphones, label: "Schedule Call Back", mode: "callback", tone: "bg-purple-500" }
  ];

  return (
    <Panel title="Quick Actions">
      <div className="space-y-2">
        {actions.map((action) => (
          <button
            className={`flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left text-sm font-black transition ${
              active === action.mode ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-100 bg-white text-slate-800 hover:bg-slate-50"
            }`}
            key={action.mode}
            onClick={() => onSelect(action.mode)}
            type="button"
          >
            <span className="flex items-center gap-3">
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-white ${action.tone}`}>
                <action.icon className="h-4 w-4" />
              </span>
              {action.label}
            </span>
            <ChevronRight className="h-4 w-4" />
          </button>
        ))}
      </div>
    </Panel>
  );
}

function CallStats({ stats }: { stats: { answered: number; missed: number; ordersTaken: number; followUps: number; complaints: number } }) {
  return (
    <Panel title="Call Stats (Today)">
      <div className="space-y-4 text-sm font-bold">
        <StatLine label="Answered Calls" value={stats.answered} />
        <StatLine label="Missed Calls" value={stats.missed} danger />
        <StatLine label="Orders Taken" value={stats.ordersTaken} />
        <StatLine label="Follow Ups" value={stats.followUps} />
        <StatLine label="Complaints" value={stats.complaints} />
      </div>
    </Panel>
  );
}

function ClientDetailsCard({
  client,
  onSearch,
  onSelect,
  query,
  results
}: {
  client: CallCenterClient;
  onSearch: (value: string) => void;
  onSelect: (id: string) => void;
  query: string;
  results: CallCenterClient[];
}) {
  return (
    <Panel id="clients" title="Client Details" action={<span className="text-xl font-black text-slate-400">...</span>}>
      <label className="mb-4 block">
        <span className="mb-1 block text-xs font-black uppercase text-slate-500">Client Search</span>
        <input className="form-input" onChange={(event) => onSearch(event.target.value)} placeholder="Search client or phone" value={query} />
      </label>
      {query ? (
        <div className="mb-4 max-h-36 space-y-2 overflow-y-auto">
          {results.slice(0, 5).map((result) => (
            <button className="w-full rounded-lg bg-slate-50 px-3 py-2 text-left text-sm font-bold hover:bg-blue-50" key={result.id} onClick={() => onSelect(result.id)} type="button">
              {result.clientName} - {result.phone}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex items-start gap-3">
        <div className="mt-1 h-3 w-3 rounded-full bg-emerald-400" />
        <div>
          <h3 className="font-black">{client.clientName}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-600">{client.phone}</p>
          <p className="text-sm font-semibold text-slate-500">{client.area}</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 divide-x divide-slate-100 border-y border-slate-100 py-4">
        <div>
          <p className="text-xs font-bold text-slate-500">Credit Status</p>
          <p className={`mt-1 font-black ${client.currentBalance > 0 ? "text-red-600" : "text-emerald-600"}`}>
            {formatMoney(client.currentBalance)} RWF
          </p>
          <p className="text-xs font-bold text-slate-500">{client.currentBalance > 0 ? "BALANCE DUE" : "CLEAR"}</p>
        </div>
        <div className="pl-4">
          <p className="text-xs font-bold text-slate-500">Credit Limit</p>
          <p className="mt-1 font-black">500,000 RWF</p>
          <p className="text-xs font-bold text-slate-500">AVAILABLE</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <InfoLine label="Last Order" value={`${client.lastOrderQuantity} cartons`} sub={client.lastOrderDate} />
        <InfoLine label="Last Payment" value={client.lastPaymentDate} sub="Recorded" />
      </div>
      <button className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-black text-white" type="button">View Full Client Profile</button>
    </Panel>
  );
}

function ClientTabs({ active, client, onChange, orders, payments }: { active: DetailTab; client: CallCenterClient; onChange: (tab: DetailTab) => void; orders: PendingOrder[]; payments: ReturnType<typeof getPaymentFollowUps> }) {
  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: "orders", label: "Order History" },
    { id: "payments", label: "Payments" },
    { id: "notes", label: "Notes" }
  ];

  return (
    <Panel>
      <div className="mb-4 flex border-b border-slate-100">
        {tabs.map((item) => (
          <button
            className={`flex-1 border-b-2 px-2 pb-3 text-xs font-black uppercase ${
              active === item.id ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500"
            }`}
            key={item.id}
            onClick={() => onChange(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="space-y-3 text-sm">
        {active === "orders" ? (
          orders.filter((order) => order.clientId === client.id).slice(0, 5).map((order) => (
            <Row key={order.id} left={order.deliveryDate} middle={`${order.quantity} x ${order.product}`} right="Pending" />
          ))
        ) : null}
        {active === "payments" ? (
          payments.filter((payment) => payment.clientId === client.id).slice(0, 5).map((payment) => (
            <Row key={payment.id} left={payment.promiseToPayDate} middle={`${formatMoney(payment.amountDue)} RWF`} right={payment.status} />
          ))
        ) : null}
        {active === "notes" ? client.notes.slice(0, 5).map((note) => <p className="rounded-lg bg-slate-50 px-3 py-2 font-semibold" key={note}>{note}</p>) : null}
      </div>
    </Panel>
  );
}

function ClientTimeline({ client }: { client: CallCenterClient }) {
  const timeline = getClientTimeline(client);

  return (
    <Panel title="Client Conversation Timeline">
      <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
        {timeline.slice(0, 10).map((item) => (
          <article className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm" key={`${item.type}-${item.id}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black text-slate-950">{item.type}: {item.title}</p>
                <p className="mt-1 font-semibold text-slate-600">{item.detail}</p>
              </div>
              <span className="text-xs font-bold text-slate-400">{item.createdAt.slice(0, 10)}</span>
            </div>
          </article>
        ))}
        {timeline.length === 0 ? (
          <p className="text-sm font-semibold text-slate-500">No timeline activity yet.</p>
        ) : null}
      </div>
    </Panel>
  );
}

function CurrentOrderCard(props: {
  actionMode: ActionMode;
  callbackForm: { callbackDate: string; callbackTime: string; reason: string; priority: string };
  complaintForm: { complaintType: string; product: string; quantity: string; description: string; priority: string };
  onCallbackChange: (value: { callbackDate: string; callbackTime: string; reason: string; priority: string }) => void;
  onCallbackSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onComplaintChange: (value: { complaintType: string; product: string; quantity: string; description: string; priority: string }) => void;
  onComplaintSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onOrderChange: (value: { product: string; quantity: string; deliveryDate: string; deliveryTime: string; notes: string }) => void;
  onOrderSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPaymentChange: (value: { amountDue: string; daysOutstanding: string; promiseToPayDate: string; comment: string }) => void;
  onPaymentSubmit: (event: FormEvent<HTMLFormElement>) => void;
  orderForm: { product: string; quantity: string; deliveryDate: string; deliveryTime: string; notes: string };
  paymentForm: { amountDue: string; daysOutstanding: string; promiseToPayDate: string; comment: string };
  products: ProductMaster[];
}) {
  if (props.actionMode === "payment") {
    return (
      <Panel id="payments" title="Payment Reminder">
        <form className="space-y-3" onSubmit={props.onPaymentSubmit}>
          <Field label="Amount Due" onChange={(value) => props.onPaymentChange({ ...props.paymentForm, amountDue: value })} type="number" value={props.paymentForm.amountDue} />
          <Field label="Days Outstanding" onChange={(value) => props.onPaymentChange({ ...props.paymentForm, daysOutstanding: value })} type="number" value={props.paymentForm.daysOutstanding} />
          <Field label="Promise Date" onChange={(value) => props.onPaymentChange({ ...props.paymentForm, promiseToPayDate: value })} type="date" value={props.paymentForm.promiseToPayDate} />
          <Field label="Comment" onChange={(value) => props.onPaymentChange({ ...props.paymentForm, comment: value })} value={props.paymentForm.comment} />
          <button className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-black text-white">Save Reminder</button>
        </form>
      </Panel>
    );
  }

  if (props.actionMode === "complaint" || props.actionMode === "delivery") {
    return (
      <Panel id="complaints" title={props.actionMode === "delivery" ? "Delivery Follow Up" : "Complaint"}>
        <form className="space-y-3" onSubmit={props.onComplaintSubmit}>
          <Field label="Type" onChange={(value) => props.onComplaintChange({ ...props.complaintForm, complaintType: value })} value={props.complaintForm.complaintType} />
          <Field label="Product" onChange={(value) => props.onComplaintChange({ ...props.complaintForm, product: value })} value={props.complaintForm.product} />
          <Field label="Quantity" onChange={(value) => props.onComplaintChange({ ...props.complaintForm, quantity: value })} type="number" value={props.complaintForm.quantity} />
          <Field label="Description" onChange={(value) => props.onComplaintChange({ ...props.complaintForm, description: value })} value={props.complaintForm.description} />
          <button className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-black text-white">Save</button>
        </form>
      </Panel>
    );
  }

  if (props.actionMode === "callback") {
    return (
      <Panel title="Schedule Call Back">
        <form className="space-y-3" onSubmit={props.onCallbackSubmit}>
          <Field label="Date" onChange={(value) => props.onCallbackChange({ ...props.callbackForm, callbackDate: value })} type="date" value={props.callbackForm.callbackDate} />
          <Field label="Time" onChange={(value) => props.onCallbackChange({ ...props.callbackForm, callbackTime: value })} type="time" value={props.callbackForm.callbackTime} />
          <Field label="Reason" onChange={(value) => props.onCallbackChange({ ...props.callbackForm, reason: value })} value={props.callbackForm.reason} />
          <Field label="Priority" onChange={(value) => props.onCallbackChange({ ...props.callbackForm, priority: value })} value={props.callbackForm.priority} />
          <button className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-black text-white">Schedule</button>
        </form>
      </Panel>
    );
  }

  const product = props.products.find((item) => item.name === props.orderForm.product) ?? props.products[0];
  const quantity = Number(props.orderForm.quantity) || 0;
  const total = quantity * (product?.pricePerCarton ?? 0);

  return (
    <Panel id="current-order" title="Current Order (New)">
      <form className="space-y-3" onSubmit={props.onOrderSubmit}>
        <label className="block">
          <span className="mb-1 block text-xs font-black uppercase text-slate-500">Product</span>
          <select className="form-input" onChange={(event) => props.onOrderChange({ ...props.orderForm, product: event.target.value })} value={props.orderForm.product}>
            <option value="">Select product</option>
            {props.products.map((item) => <option key={item.itemCode}>{item.name}</option>)}
          </select>
        </label>
        <Field label="Quantity" onChange={(value) => props.onOrderChange({ ...props.orderForm, quantity: value })} type="number" value={props.orderForm.quantity} />
        <div className="flex items-center justify-between text-sm font-bold">
          <span>{quantity} x {product?.name ?? "Product"}</span>
          <span>{formatMoney(total)} RWF</span>
        </div>
        <Field label="Delivery Date" onChange={(value) => props.onOrderChange({ ...props.orderForm, deliveryDate: value })} type="date" value={props.orderForm.deliveryDate} />
        <Field label="Delivery Time" onChange={(value) => props.onOrderChange({ ...props.orderForm, deliveryTime: value })} type="time" value={props.orderForm.deliveryTime} />
        <Field label="Notes" onChange={(value) => props.onOrderChange({ ...props.orderForm, notes: value })} value={props.orderForm.notes} />
        <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-lg font-black">
          <span>Total</span>
          <span>{formatMoney(total)} RWF</span>
        </div>
        <button className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white">Send Order</button>
      </form>
    </Panel>
  );
}

function NotesCard({ client, noteDraft, onNoteChange, onSave }: { client: CallCenterClient; noteDraft: string; onNoteChange: (value: string) => void; onSave: () => void }) {
  return (
    <Panel title="Notes">
      <div className="space-y-2 text-sm font-semibold text-slate-700">
        {client.notes.slice(0, 3).map((note) => <p key={note}>{note}</p>)}
      </div>
      <div className="mt-4 space-y-2">
        <input className="form-input" onChange={(event) => onNoteChange(event.target.value)} placeholder="Add note" value={noteDraft} />
        <button className="secondary-button w-full" onClick={onSave} type="button">Save Note</button>
      </div>
    </Panel>
  );
}

function SidebarGroup({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div>
      <p className="mb-3 px-3 text-xs font-black uppercase tracking-wide text-blue-200/70">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function SidebarLink({ active = false, badge, href, icon: Icon, label }: { active?: boolean; badge?: string; href: string; icon: typeof Home; label: string }) {
  const content = (
    <span className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm font-black transition ${active ? "bg-blue-600 text-white" : "text-blue-100 hover:bg-white/10 hover:text-white"}`}>
      <span className="flex items-center gap-3">
        <Icon className="h-5 w-5" />
        {label}
      </span>
      {badge ? <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">{badge}</span> : null}
    </span>
  );

  return href.startsWith("#") ? <a href={href}>{content}</a> : <Link href={href}>{content}</Link>;
}

function Panel({ action, children, id, title }: { action?: ReactNode; children: ReactNode; id?: string; title?: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" id={id}>
      {title ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-sm font-black uppercase tracking-normal text-slate-950">{title}</h3>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function KpiCard({ accent, icon: Icon, label, subtext, value }: { accent: "green" | "amber" | "blue" | "red"; icon: typeof ShoppingCart; label: string; subtext: string; value: string }) {
  const color = {
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
    red: "bg-red-100 text-red-700"
  }[accent];

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-slate-500">{label}</p>
          <p className="mt-4 text-2xl font-black">{value}</p>
          <p className={`mt-2 text-xs font-black ${accent === "red" ? "text-slate-500" : "text-emerald-600"}`}>{subtext}</p>
        </div>
        <div className={`rounded-full p-3 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  );
}

function TopMetric({ dot = false, icon: Icon, label, tone, value }: { dot?: boolean; icon?: typeof PhoneCall; label: string; tone?: "green"; value: string }) {
  return (
    <div className="min-w-28 rounded-lg bg-slate-50 px-4 py-2">
      <p className={`flex items-center gap-2 text-xs font-bold ${tone === "green" ? "text-emerald-700" : "text-slate-500"}`}>
        {Icon ? <Icon className="h-4 w-4" /> : null}
        {dot ? <span className="h-2 w-2 rounded-full bg-emerald-500" /> : null}
        {label}
      </p>
      <p className="mt-1 font-black text-slate-950">{value}</p>
    </div>
  );
}

function StatLine({ danger = false, label, value }: { danger?: boolean; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className={danger ? "text-red-600" : "text-slate-700"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function InfoLine({ label, sub, value }: { label: string; sub: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 font-black">{sub}</p>
      <p className="text-xs font-bold text-slate-600">{value}</p>
    </div>
  );
}

function Row({ left, middle, right }: { left: string; middle: string; right: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-semibold text-slate-600">{left}</span>
      <span className="font-black">{middle}</span>
      <StatusPill label={right} tone="green" />
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "green" | "amber" | "blue" }) {
  const styles = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700"
  };

  return <span className={`rounded-md px-2 py-1 text-xs font-black ${styles[tone]}`}>{label}</span>;
}

function Field({ label, onChange, type = "text", value }: { label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black uppercase text-slate-500">{label}</span>
      <input className="form-input" min={type === "number" ? "0" : undefined} onChange={(event) => onChange(event.target.value)} type={type} value={value} />
    </label>
  );
}
