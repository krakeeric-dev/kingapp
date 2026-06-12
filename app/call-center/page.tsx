"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellRing,
  BookOpen,
  Box,
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Copy,
  CreditCard,
  FileText,
  Gauge,
  Headphones,
  Home,
  Keyboard,
  MessageCircle,
  MessageSquare,
  MessageSquareWarning,
  Megaphone,
  LogOut,
  MicOff,
  MoreHorizontal,
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
  Volume2,
  WalletCards
} from "lucide-react";
import {
  CallCenterMobileBlock,
  useIsMobileScreen
} from "@/components/CallCenterDesktopOnly";
import { ClientAutoPopup } from "@/components/ClientAutoPopup";
import { CallCenterLogoutDialog } from "@/components/CallCenterLogoutDialog";
import { KingAppLogo } from "@/components/KingAppLogo";
import type { SessionUser } from "@/lib/auth";
import { canAccessRoute } from "@/lib/permissions";
import { formatMoney } from "@/lib/sales-data";
import { clearSession, getSession } from "@/lib/storage";
import { setActiveCompanyId } from "@/lib/companies-data";
import { roleLabels } from "@/lib/auth";
import {
  addCallLog,
  addCallback,
  addComplaint,
  addPaymentFollowUp,
  acceptQueueCall,
  getAgents,
  getCallLogs,
  getComplaints,
  getPaymentFollowUps,
  getQueueCalls,
  markCallMissed,
  saveClientNotes,
  saveAgents,
  saveQueueCalls,
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
  getAssignableCallCenterCompanies,
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
import { getNumbersForUser, type CallCenterNumber } from "@/lib/call-center-numbers";
import { importIncomingProviderCalls } from "@/lib/call-provider-client";
import {
  getAnnouncementsForUser,
  getClientTimeline,
  getMessagingDashboardStats,
  type TeamAnnouncement
} from "@/lib/messageService";
import { filterDeliveriesForUser, getDeliveryRecords, type DeliveryRecord } from "@/lib/delivery-data";
import { getCustomerAccounts, getCustomerDebts, getCustomerPayments } from "@/lib/customer-accounts-data";

type ActionMode = "order" | "payment" | "complaint" | "delivery" | "callback";
type DetailTab = "orders" | "payments" | "notes";
type MtnCallForm = {
  callerPhone: string;
  clientName: string;
  companyId: string;
  reason: CallType;
  notes: string;
};

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const nowTime = () => new Date().toTimeString().slice(0, 5);
const normalizePhone = (value: string) => value.replace(/\D/g, "");

const menuItems = [
  { label: "Dashboard", href: "/call-center", icon: Home, badge: "" },
  { label: "Live Calls", href: "/call-center/softphone", icon: PhoneCall, badge: "" },
  { label: "Call Queue", href: "/call-center/queue", icon: PhoneIncoming, badge: "1" },
  { label: "Messages", href: "/call-center/messages", icon: MessageSquare, badge: "" },
  { label: "Client Orders", href: "#orders", icon: ClipboardList, badge: "" },
  { label: "Complaints", href: "/call-center/complaints", icon: MessageSquareWarning, badge: "" },
  { label: "Callbacks", href: "/call-center/callbacks", icon: CalendarClock, badge: "" },
  { label: "Clients", href: "#clients", icon: UsersRound, badge: "" },
  { label: "Performance", href: "/call-center/performance", icon: Trophy, badge: "" },
  { label: "Recordings", href: "/call-center/recordings", icon: Radio, badge: "" },
  { label: "Reports", href: "/call-center/analytics", icon: BookOpen, badge: "" },
  { label: "Settings", href: "/call-center/settings", icon: UserRound, badge: "" }
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
  const [logoutOpen, setLogoutOpen] = useState(false);
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

  function finishLogout() {
    clearSession();
    setActiveCompanyId("all");
    window.sessionStorage.removeItem("kingapp.permissionMessage");
    window.sessionStorage.removeItem("kingapp.callCenter.session");
    setUser(null);
    setLogoutOpen(false);
    router.replace("/login");
  }

  if (!user) {
    return <main className="min-h-screen bg-slate-950" />;
  }

  if (isMobileScreen) {
    return (
      <>
        <CallCenterMobileBlock onLogout={() => setLogoutOpen(true)} user={user} />
        {logoutOpen ? (
          <CallCenterLogoutDialog
            onCancel={() => setLogoutOpen(false)}
            onLogout={finishLogout}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <CallCenterOffice onLogout={() => setLogoutOpen(true)} user={user} />
      {logoutOpen ? (
        <CallCenterLogoutDialog onCancel={() => setLogoutOpen(false)} onLogout={finishLogout} />
      ) : null}
    </>
  );
}

function CallCenterOffice({ onLogout, user }: { onLogout: () => void; user: SessionUser }) {
  const [clients, setClients] = useState<CallCenterClient[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [payments, setPayments] = useState<ReturnType<typeof getPaymentFollowUps>>([]);
  const [complaints, setComplaints] = useState<ReturnType<typeof getComplaints>>([]);
  const [callbacks, setCallbacks] = useState<CallbackItem[]>([]);
  const [queueCalls, setQueueCalls] = useState<QueueCall[]>([]);
  const [agents, setAgents] = useState<CallCenterAgent[]>([]);
  const [assignedNumbers, setAssignedNumbers] = useState<CallCenterNumber[]>([]);
  const [products, setProducts] = useState<ProductMaster[]>([]);
  const [announcements, setAnnouncements] = useState<TeamAnnouncement[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [activeCompany, setActiveCompany] = useState("all");
  const [focusedCallId, setFocusedCallId] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [actionMode, setActionMode] = useState<ActionMode>("order");
  const [tab, setTab] = useState<DetailTab>("orders");
  const [mtnFormOpen, setMtnFormOpen] = useState(false);
  const [mtnForm, setMtnForm] = useState<MtnCallForm>({
    callerPhone: "",
    clientName: "",
    companyId: user.companyId === "all" ? "COMP-AGAHOZO" : user.companyId,
    reason: "Customer Care",
    notes: ""
  });
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
    refreshDesk();
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    async function pollIncomingCalls() {
      try {
        const importedCalls = await importIncomingProviderCalls(user);
        if (cancelled) return;
        if (importedCalls.length) {
          updateCurrentAgentStatus("Ringing");
          setFocusedCallId(importedCalls[0].id);
          setQueueCalls(getCompanyQueueCalls(user));
          setMessage("Incoming call received from provider webhook.");
        }
      } catch (error) {
        console.warn("[KingApp] Incoming call polling failed", error);
      }
    }

    void pollIncomingCalls();
    const interval = window.setInterval(pollIncomingCalls, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [user]);

  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? clients[0];
  const focusedCall = queueCalls.find((call) => call.id === focusedCallId && (call.status === "Incoming" || call.status === "Active"));
  const currentCall = focusedCall ?? queueCalls.find((call) => call.status === "Active") ?? queueCalls.find((call) => call.status === "Incoming");
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
    deliveriesToday: deliveries.filter((delivery) => delivery.date === today()).length,
    paymentsDue: payments.filter((payment) => payment.status !== "Closed").reduce((sum, payment) => sum + payment.amountDue, 0)
  };
  const messagingStats = getMessagingDashboardStats(user);
  const availableCompanies = getAssignableCallCenterCompanies(user);
  const activeCompanyName =
    activeCompany === "all"
      ? "All Companies"
      : availableCompanies.find((company) => company.id === activeCompany)?.name ?? user.companyName;
  const missedCalls = queueCalls.filter((call) => call.status === "Missed").length;
  const clientMessages = messagingStats.unreadMessages;
  const displayQueueCount = queueCalls.filter((call) => call.status === "Waiting" || call.status === "Incoming").length;
  const activeCallsCount = queueCalls.filter((call) => call.status === "Active").length;
  const mtnMatchedClient = useMemo(() => {
    const phone = normalizePhone(mtnForm.callerPhone);
    const name = mtnForm.clientName.trim().toLowerCase();

    return clients.find((client) => {
      const phoneMatches = phone && normalizePhone(client.phone).includes(phone);
      const nameMatches = name && `${client.clientName} ${client.ownerName}`.toLowerCase().includes(name);
      return phoneMatches || nameMatches;
    }) ?? null;
  }, [clients, mtnForm.callerPhone, mtnForm.clientName]);
  const mtnClientSuggestions = useMemo(() => {
    const search = `${mtnForm.callerPhone} ${mtnForm.clientName}`.trim().toLowerCase();
    if (!search) return clients.slice(0, 4);
    return clients
      .filter((client) =>
        `${client.clientName} ${client.ownerName} ${client.phone} ${client.area}`.toLowerCase().includes(search)
      )
      .slice(0, 5);
  }, [clients, mtnForm.callerPhone, mtnForm.clientName]);

  function refreshDesk() {
    const loadedClients = getCompanyClients(user);
    setClients(loadedClients);
    setSelectedClientId((current) => current || (loadedClients[0]?.id ?? ""));
    setCallLogs(getCallLogs().filter((log) => loadedClients.some((client) => client.id === log.clientId)));
    setOrders(getCompanyOrders(user));
    setPayments(getCompanyPayments(user));
    setComplaints(getCompanyComplaints(user));
    setCallbacks(getCompanyCallbacks(user));
    setQueueCalls(getCompanyQueueCalls(user));
    setAgents(getCompanyAgents(user));
    setDeliveries(filterDeliveriesForUser(getDeliveryRecords(), user));
    setAssignedNumbers(getNumbersForUser(user));
    setProducts(getProducts());
    setAnnouncements(getAnnouncementsForUser(user));
    setActiveCompany(getActiveCallCenterCompanyForUser(user));
  }

  function updateCurrentAgentStatus(status: CallCenterAgent["status"]) {
    const existingAgents = getAgents();
    const matchingAgent = existingAgents.find((agent) => agent.name === user.displayName);
    const updatedAgents = matchingAgent
      ? existingAgents.map((agent) => agent.name === user.displayName ? { ...agent, status } : agent)
      : [
          {
            id: `AG-${user.username.toUpperCase()}`,
            companyId: user.companyId,
            companyName: user.companyName,
            name: user.displayName,
            extension: "WEB",
            status,
            phoneType: "Browser Softphone" as const
          },
          ...existingAgents
        ];
    saveAgents(updatedAgents);
    setAgents(getCompanyAgents(user));
  }

  function answerCall(call: QueueCall) {
    acceptQueueCall(call.id, user.displayName);
    updateCurrentAgentStatus("On Call");
    setQueueCalls(getCompanyQueueCalls(user));
    setFocusedCallId(call.id);
    setMessage("Call answered. Agent status changed to On Call.");
  }

  function rejectCall(call: QueueCall) {
    markCallMissed(call.id, "Rejected from Call Center desk");
    updateCurrentAgentStatus("Available");
    setQueueCalls(getCompanyQueueCalls(user));
    setFocusedCallId("");
    setMessage("Call rejected and saved as missed.");
  }

  function saveMtnPhysicalCall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!mtnForm.callerPhone.trim()) {
      setMessage("Enter caller phone number.");
      return;
    }

    const companyName =
      callCenterCompanies.find((company) => company.id === mtnForm.companyId)?.name ??
      mtnMatchedClient?.companyName ??
      user.companyName;
    const clientName = mtnMatchedClient?.clientName ?? (mtnForm.clientName.trim() || "Unknown Caller");
    const phone = mtnMatchedClient?.phone ?? mtnForm.callerPhone.trim();

    setCallLogs(
      addCallLog(
        {
          date: today(),
          time: nowTime(),
          clientId: mtnMatchedClient?.id ?? `MTN-${Date.now()}`,
          clientName,
          phone,
          callType: mtnForm.reason,
          duration: "Manual MTN line",
          outcome: "Closed",
          nextAction: mtnForm.notes || `Logged from MTN physical line for ${companyName}`
        },
        user
      )
    );

    if (mtnMatchedClient) {
      setSelectedClientId(mtnMatchedClient.id);
      setQuery(mtnMatchedClient.clientName);
    }

    setMtnFormOpen(false);
    setMessage(
      mtnMatchedClient
        ? "MTN physical line call logged. Client profile is open for order, complaint, payment follow-up, or callback."
        : "MTN physical line call logged as Unknown Caller."
    );
  }

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
    if (currentCall) {
      const endedAt = new Date().toISOString();
      saveQueueCalls(
        getQueueCalls().map((call) =>
          call.id === currentCall.id
            ? { ...call, status: "Closed", endedAt, notes: ["Call ended from Call Center desk", ...call.notes] }
            : call
        )
      );
      updateCurrentAgentStatus("Available");
      setQueueCalls(getCompanyQueueCalls(user));
      setFocusedCallId("");
      setCallLogs(
        addCallLog(
          {
            date: today(),
            time: nowTime(),
            clientId: currentCall.clientId,
            clientName: currentCall.clientName,
            phone: currentCall.phone,
            callType: currentCall.callReason,
            duration: "Completed",
            outcome: "Closed",
            nextAction: "Call ended from command center"
          },
          user
        )
      );
      setMessage("Call ended and logged.");
      return;
    }

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
        <CallCenterSidebar activeCompany={activeCompany} onLogout={onLogout} user={user} />
        <section className="min-w-0 flex-1">
          <PremiumCallCenterHeader
            activeCalls={activeCallsCount}
            activeCompany={activeCompany}
            activeCompanyName={activeCompanyName}
            callbacks={dueCallbacks.length}
            companies={availableCompanies}
            messages={clientMessages}
            missedCalls={missedCalls}
            onCompanyChange={(companyId) => setActiveCompany(setActiveCallCenterCompany(companyId))}
            user={user}
            waitingQueue={displayQueueCount}
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
                client={clients.find((client) => client.id === currentCall.clientId)}
                onAccept={() => answerCall(currentCall)}
                onAddNewClient={() => setMessage("Unknown caller captured. Client creation workflow can be opened from Client Management.")}
                onCreateOrder={() => setActionMode("order")}
                onLogComplaint={() => setActionMode("complaint")}
                onReject={() => rejectCall(currentCall)}
                onScheduleCallback={() => setActionMode("callback")}
              />
            ) : null}

            {mtnFormOpen ? (
              <MtnCallLogger
                clients={mtnClientSuggestions}
                form={mtnForm}
                matchedClient={mtnMatchedClient}
                onChange={setMtnForm}
                onClose={() => setMtnFormOpen(false)}
                onSubmit={saveMtnPhysicalCall}
              />
            ) : null}

            <div className="grid min-h-[calc(100vh-132px)] gap-4 xl:grid-cols-[360px_minmax(0,1fr)_360px]">
              <CustomerCallList
                activeId={selectedClient?.id ?? ""}
                clients={filteredClients}
                complaints={complaints}
                onLogMtn={() => setMtnFormOpen((current) => !current)}
                onSearch={setQuery}
                onSelect={setSelectedClientId}
                orders={orders}
                query={query}
                queueCalls={queueCalls}
              />

              <CustomerWorkspace
                activeTab={tab}
                client={selectedClient}
                onTabChange={setTab}
                orders={orders}
                payments={payments}
              />

              <aside className="space-y-4">
                <ActiveCallPanel
                  call={currentCall}
                  client={selectedClient}
                  onEnd={endCurrentCall}
                  onMessage={setMessage}
                />
                <QuickActionGrid
                  active={actionMode}
                  onSelect={setActionMode}
                />
                {selectedClient ? (
                  <>
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
                  </>
                ) : (
                  <Panel title="Quick Actions">
                    <p className="text-sm font-semibold text-slate-500">Select a customer to create orders, payments, complaints, callbacks, or notes.</p>
                  </Panel>
                )}
              </aside>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function CallCenterSidebar({
  activeCompany,
  onLogout,
  user
}: {
  activeCompany: string;
  onLogout: () => void;
  user: SessionUser;
}) {
  const companyName =
    activeCompany === "all"
      ? "All Companies"
      : callCenterCompanies.find((company) => company.id === activeCompany)?.name ?? user.companyName;

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

      <div className="border-t border-white/10 p-5">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-black text-white">{user.displayName}</p>
          <p className="mt-1 text-xs font-semibold text-blue-100">{roleLabels[user.role]}</p>
          <p className="mt-1 text-xs font-semibold text-blue-100">{companyName}</p>
          <button
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-black text-white transition hover:bg-red-600"
            onClick={onLogout}
            type="button"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
        <p className="mt-4 text-center text-xs font-semibold text-blue-200">Version 1.0.0</p>
      </div>
    </aside>
  );
}

function PremiumCallCenterHeader({
  activeCalls,
  activeCompany,
  activeCompanyName,
  callbacks,
  companies,
  messages,
  missedCalls,
  onCompanyChange,
  user,
  waitingQueue
}: {
  activeCalls: number;
  activeCompany: string;
  activeCompanyName: string;
  callbacks: number;
  companies: Array<{ id: string; name: string }>;
  messages: number;
  missedCalls: number;
  onCompanyChange: (companyId: string) => void;
  user: SessionUser;
  waitingQueue: number;
}) {
  const canSwitchCompany = user.role === "admin";

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur lg:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-64 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] font-black uppercase text-slate-400">Current Company</p>
          <div className="mt-1 flex items-center gap-3">
            <Building2 className="h-5 w-5 text-blue-700" />
            {canSwitchCompany ? (
              <select
                className="w-full bg-transparent text-sm font-black uppercase text-slate-950 outline-none"
                onChange={(event) => onCompanyChange(event.target.value)}
                value={activeCompany}
              >
                <option value="all">All Companies</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            ) : (
              <p className="text-sm font-black uppercase text-slate-950">{activeCompanyName}</p>
            )}
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </div>
        </div>
        <HeaderMetric icon={PhoneCall} label="Active Calls" value={activeCalls} tone="green" />
        <HeaderMetric icon={UsersRound} label="Waiting Queue" value={waitingQueue} tone="amber" />
        <HeaderMetric icon={PhoneOff} label="Missed Calls" value={missedCalls} tone="red" />
        <HeaderMetric icon={MessageSquare} label="Messages" value={messages} tone="blue" />
        <HeaderMetric icon={CalendarClock} label="Callbacks" value={callbacks} tone="purple" />
        <div className="ml-auto flex items-center gap-4">
          <button className="relative rounded-lg p-2 text-slate-700 hover:bg-slate-100" type="button">
            <Bell className="h-5 w-5" />
            <span className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white">
              {messages + missedCalls}
            </span>
          </button>
          <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-sm font-black text-white">
              {user.displayName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-black text-slate-950">{user.displayName}</p>
              <p className="text-xs font-semibold text-slate-500">{roleLabels[user.role]}</p>
            </div>
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </div>
        </div>
      </div>
    </header>
  );
}

function HeaderMetric({
  icon: Icon,
  label,
  tone,
  value
}: {
  icon: typeof PhoneCall;
  label: string;
  tone: "green" | "amber" | "red" | "blue" | "purple";
  value: number;
}) {
  const colors = {
    amber: "text-orange-600",
    blue: "text-blue-600",
    green: "text-emerald-600",
    purple: "text-purple-600",
    red: "text-red-600"
  };

  return (
    <article className="min-w-36 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${colors[tone]}`} />
        <div>
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-black text-slate-950">{value.toLocaleString()}</p>
        </div>
      </div>
    </article>
  );
}

function CustomerCallList({
  activeId,
  clients,
  complaints,
  onLogMtn,
  onSearch,
  onSelect,
  orders,
  query,
  queueCalls
}: {
  activeId: string;
  clients: CallCenterClient[];
  complaints: ReturnType<typeof getComplaints>;
  onLogMtn: () => void;
  onSearch: (value: string) => void;
  onSelect: (id: string) => void;
  orders: PendingOrder[];
  query: string;
  queueCalls: QueueCall[];
}) {
  const [tab, setTab] = useState<"all" | "calls" | "messages">("all");
  const filteredClients = clients.filter((client) => {
    if (tab === "calls") return queueCalls.some((call) => call.clientId === client.id);
    if (tab === "messages") return client.notes.length > 0;
    return true;
  });

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="form-input pl-9"
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search client, phone, or order"
              value={query}
            />
          </div>
          <button className="secondary-button !px-3" onClick={onLogMtn} type="button">
            <Phone className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-sm font-black">
          {[
            ["all", "All"],
            ["calls", "Calls"],
            ["messages", "Messages"]
          ].map(([id, label]) => (
            <button
              className={`rounded-lg px-3 py-2 ${tab === id ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-600"}`}
              key={id}
              onClick={() => setTab(id as "all" | "calls" | "messages")}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-[calc(100vh-240px)] overflow-y-auto">
        {filteredClients.map((client) => {
          const call = queueCalls.find((item) => item.clientId === client.id);
          const order = orders.find((item) => item.clientId === client.id);
          const complaint = complaints.find((item) => item.clientId === client.id);
          const status = call?.status === "Incoming"
            ? "Incoming call"
            : complaint
              ? "Complaint"
              : order
                ? "Order request"
                : client.currentBalance > 0
                  ? "Payment inquiry"
                  : "Client profile";

          return (
            <button
              className={`flex w-full items-start gap-3 border-b border-slate-100 p-4 text-left transition ${
                activeId === client.id ? "border-l-4 border-l-emerald-500 bg-blue-50/70" : "hover:bg-slate-50"
              }`}
              key={client.id}
              onClick={() => onSelect(client.id)}
              type="button"
            >
              <CustomerAvatar name={client.clientName} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-black text-slate-950">{client.clientName}</p>
                  <span className="text-xs font-semibold text-slate-500">{call?.startedAt ? new Date(call.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                </div>
                <p className="text-sm font-semibold text-slate-600">{client.phone}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">{client.companyName}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-500">{status}</span>
                  {call?.status === "Incoming" ? <PhoneCall className="h-4 w-4 text-emerald-600" /> : null}
                  {client.notes.length ? <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-black text-white">{client.notes.length}</span> : null}
                </div>
              </div>
            </button>
          );
        })}
        {!filteredClients.length ? (
          <div className="p-4">
            <EmptyDeskState text="No customer records yet." />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CustomerWorkspace({
  client,
  orders,
  payments
}: {
  activeTab: DetailTab;
  client?: CallCenterClient;
  onTabChange: (tab: DetailTab) => void;
  orders: PendingOrder[];
  payments: ReturnType<typeof getPaymentFollowUps>;
}) {
  const [tab, setTab] = useState<"overview" | "history" | "orders" | "payments" | "complaints" | "notes" | "files">("overview");

  if (!client) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <EmptyDeskState text="No customer selected." />
      </section>
    );
  }

  const account = getCustomerAccounts().find((item) => item.phone.replace(/\D/g, "") === client.phone.replace(/\D/g, ""));
  const customerPayments = account ? getCustomerPayments().filter((payment) => payment.customerId === account.customerId) : [];
  const customerDebts = account ? getCustomerDebts().filter((debt) => debt.customerId === account.customerId) : [];
  const currentBalance = account?.currentBalance ?? client.currentBalance;
  const creditLimit = account?.creditLimit ?? 500_000;
  const totalPayments = customerPayments.reduce((sum, payment) => sum + payment.amountPaid, 0);
  const clientOrders = orders.filter((order) => order.clientId === client.id);
  const timeline = getClientTimeline(client);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <CustomerAvatar large name={client.clientName} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-black text-slate-950">{client.clientName}</h2>
              {currentBalance === 0 ? <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">VIP</span> : null}
            </div>
            <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-600">
              {client.phone}
              <Copy className="h-3.5 w-3.5 text-slate-400" />
            </p>
            <p className="text-sm font-black uppercase text-slate-700">{client.companyName}</p>
          </div>
          <SummaryTile label="Outstanding Balance" value={`${formatMoney(currentBalance)} RWF`} danger={currentBalance > 0} />
          <SummaryTile label="Last Order" value={client.lastOrderDate || "Not recorded"} />
          <SummaryTile label="Last Payment" value={customerPayments[0]?.date ?? client.lastPaymentDate ?? "Not recorded"} />
        </div>
      </div>

      <div className="border-b border-slate-100 px-5">
        <div className="flex gap-5 overflow-x-auto">
          {[
            ["overview", "Overview"],
            ["history", "History"],
            ["orders", "Orders"],
            ["payments", "Payments"],
            ["complaints", "Complaints"],
            ["notes", "Notes"],
            ["files", "Files"]
          ].map(([id, label]) => (
            <button
              className={`border-b-2 py-4 text-sm font-black ${tab === id ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500"}`}
              key={id}
              onClick={() => setTab(id as typeof tab)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 p-5 xl:grid-cols-[1fr_1fr]">
        {tab === "overview" ? (
          <>
            <Panel title="Customer Information">
              <div className="divide-y divide-slate-100">
                <DeskInfo label="Customer Type" value="Retail customer" />
                <DeskInfo label="Phone" value={client.phone} />
                <DeskInfo label="Alternative Phone" value="Not recorded" />
                <DeskInfo label="Email" value="Not recorded" />
                <DeskInfo label="Address" value={client.area} />
              </div>
            </Panel>
            <Panel title="Statistics This Month">
              <div className="divide-y divide-slate-100">
                <DeskInfo label="Total Orders" value={clientOrders.length.toLocaleString()} />
                <DeskInfo label="Total Amount" value={`${formatMoney(clientOrders.reduce((sum, order) => sum + order.quantity * 2000, 0))} RWF`} />
                <DeskInfo label="Total Payments" value={`${formatMoney(totalPayments)} RWF`} />
                <DeskInfo label="Outstanding" value={`${formatMoney(currentBalance)} RWF`} danger={currentBalance > 0} />
                <DeskInfo label="Credit Limit" value={`${formatMoney(creditLimit)} RWF`} />
              </div>
            </Panel>
            <div className="xl:col-span-2">
              <RecentOrdersTable orders={clientOrders} />
            </div>
            <Panel title="Recent Notes">
              <div className="space-y-2">
                {client.notes.slice(0, 4).map((note) => (
                  <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700" key={note}>{note}</p>
                ))}
                {!client.notes.length ? <EmptyDeskState text="No notes recorded yet." /> : null}
              </div>
            </Panel>
          </>
        ) : null}

        {tab === "history" ? (
          <div className="xl:col-span-2">
            <Panel title="Unified Timeline">
              <div className="space-y-3">
                {timeline.map((item) => (
                  <article className="rounded-lg border border-slate-100 bg-slate-50 p-3" key={`${item.type}-${item.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950">{item.type}: {item.title}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-600">{item.detail}</p>
                      </div>
                      <span className="text-xs font-bold text-slate-400">{item.createdAt.slice(0, 10)}</span>
                    </div>
                  </article>
                ))}
                {!timeline.length ? <EmptyDeskState text="No timeline activity yet." /> : null}
              </div>
            </Panel>
          </div>
        ) : null}

        {tab === "orders" ? <div className="xl:col-span-2"><RecentOrdersTable orders={clientOrders} /></div> : null}
        {tab === "payments" ? (
          <Panel title="Payments">
            <div className="space-y-2">
              {payments.filter((payment) => payment.clientId === client.id).map((payment) => (
                <Row key={payment.id} left={payment.promiseToPayDate} middle={`${formatMoney(payment.amountDue)} RWF`} right={payment.status} />
              ))}
              {!payments.filter((payment) => payment.clientId === client.id).length ? <EmptyDeskState text="No payment records yet." /> : null}
            </div>
          </Panel>
        ) : null}
        {tab === "complaints" ? <Panel title="Complaints"><EmptyDeskState text={customerDebts.length ? "Debt records are available under Payments." : "No complaints recorded yet."} /></Panel> : null}
        {tab === "notes" ? <Panel title="Notes"><div className="space-y-2">{client.notes.map((note) => <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold" key={note}>{note}</p>)}{!client.notes.length ? <EmptyDeskState text="No notes recorded yet." /> : null}</div></Panel> : null}
        {tab === "files" ? <Panel title="Files"><EmptyDeskState text="No files uploaded yet." /></Panel> : null}
      </div>
    </section>
  );
}

function ActiveCallPanel({ call, client, onEnd, onMessage }: { call?: QueueCall; client?: CallCenterClient; onEnd: () => void; onMessage: (message: string) => void }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const displayName = call?.clientName ?? client?.clientName ?? "No active call";
  const phone = call?.phone ?? client?.phone ?? "";
  const timerStart = call?.acceptedAt ?? call?.startedAt;
  const timerLabel = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:${String(elapsedSeconds % 60).padStart(2, "0")}`;

  useEffect(() => {
    if (!timerStart || !call || !["Incoming", "Active"].includes(call.status)) {
      setElapsedSeconds(0);
      return;
    }
    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - new Date(timerStart).getTime()) / 1000)));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [call, timerStart]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="rounded-lg bg-gradient-to-r from-[#061b33] to-[#0b2b52] px-4 py-3 text-white">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-black uppercase">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            {call?.status === "Incoming" ? "Incoming Call" : call?.status === "Active" ? "Active Call" : "Call Controls"}
          </p>
          <p className="font-black">{timerLabel}</p>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-5 text-center">
        <p className="text-sm font-black text-emerald-700">{call ? "In Call" : "Ready"}</p>
        <h3 className="mt-2 text-xl font-black text-slate-950">{displayName}</h3>
        <p className="mt-1 font-semibold text-slate-600">{phone || "No number selected"}</p>
        <p className="mt-1 text-lg font-black text-emerald-600">{timerLabel}</p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <CallControl icon={Pause} label="Hold" onClick={() => onMessage("Call placed on hold.")} />
        <CallControl icon={MicOff} label="Mute" onClick={() => onMessage("Call muted.")} />
        <CallControl icon={Volume2} label="Speaker" onClick={() => onMessage("Speaker enabled.")} primary />
        <CallControl icon={PhoneIncoming} label="Transfer" onClick={() => onMessage("Transfer panel opened.")} />
        <CallControl icon={FileText} label="Add Note" onClick={() => onMessage("Add note from the notes panel.")} />
        <CallControl icon={Radio} label="Record" onClick={() => onMessage("Recording marked for provider integration.")} />
        <CallControl icon={Keyboard} label="Keypad" onClick={() => onMessage("Keypad opened.")} />
        <CallControl icon={UsersRound} label="Contacts" onClick={() => onMessage("Contacts opened.")} />
        <CallControl icon={MoreHorizontal} label="More" onClick={() => onMessage("More actions opened.")} />
      </div>
      <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-4 text-sm font-black text-white shadow-sm hover:bg-red-600" onClick={onEnd} type="button">
        <PhoneOff className="h-4 w-4" />
        End Call
      </button>
    </section>
  );
}

function QuickActionGrid({ active, onSelect }: { active: ActionMode; onSelect: (mode: ActionMode) => void }) {
  const actions: Array<{ icon: typeof ShoppingCart; label: string; mode: ActionMode }> = [
    { icon: ShoppingCart, label: "Create Order", mode: "order" },
    { icon: CreditCard, label: "Receive Payment", mode: "payment" },
    { icon: MessageSquareWarning, label: "Register Complaint", mode: "complaint" },
    { icon: CalendarClock, label: "Create Callback", mode: "callback" },
    { icon: MessageSquare, label: "Send Message", mode: "delivery" }
  ];

  return (
    <Panel title="Quick Actions">
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => (
          <button
            className={`flex items-center gap-2 rounded-lg border px-3 py-3 text-left text-xs font-black ${
              active === action.mode ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
            key={action.label}
            onClick={() => onSelect(action.mode)}
            type="button"
          >
            <action.icon className="h-4 w-4" />
            {action.label}
          </button>
        ))}
        <Link className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3 text-xs font-black text-slate-700 hover:bg-slate-50" href="/customers">
          <UserRound className="h-4 w-4" />
          View Customer
        </Link>
      </div>
    </Panel>
  );
}

function MtnCallLogger({
  clients,
  form,
  matchedClient,
  onChange,
  onClose,
  onSubmit
}: {
  clients: CallCenterClient[];
  form: MtnCallForm;
  matchedClient: CallCenterClient | null;
  onChange: (form: MtnCallForm) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-950">Log Incoming MTN Call</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">MTN Physical Line - Manual Logging</p>
        </div>
        <button className="secondary-button" onClick={onClose} type="button">Close</button>
      </div>
      <form className="grid gap-4 lg:grid-cols-5" onSubmit={onSubmit}>
        <Field label="Caller Phone" onChange={(value) => onChange({ ...form, callerPhone: value })} value={form.callerPhone} />
        <Field label="Client Name" onChange={(value) => onChange({ ...form, clientName: value })} value={form.clientName} />
        <label className="block">
          <span className="mb-1 block text-xs font-black uppercase text-slate-500">Reason</span>
          <select className="form-input" onChange={(event) => onChange({ ...form, reason: event.target.value as CallType })} value={form.reason}>
            {["New Order", "Reorder", "Complaint", "Payment Follow-up", "Customer Care", "New Client Prospect"].map((reason) => (
              <option key={reason} value={reason}>{reason}</option>
            ))}
          </select>
        </label>
        <div className="lg:col-span-2">
          <Field label="Notes" onChange={(value) => onChange({ ...form, notes: value })} value={form.notes} />
        </div>
        <div className="lg:col-span-5">
          {matchedClient ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
              Client found: {matchedClient.clientName} - {matchedClient.phone} - {matchedClient.companyName}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
              No exact client match yet. This will be saved as an unknown caller unless you choose a suggestion.
            </div>
          )}
          {clients.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {clients.map((client) => (
                <button
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50"
                  key={client.id}
                  onClick={() => onChange({ ...form, callerPhone: client.phone, clientName: client.clientName, companyId: client.companyId ?? form.companyId })}
                  type="button"
                >
                  {client.clientName} - {client.phone}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button className="primary-button lg:col-span-5" type="submit">Save MTN Call</button>
      </form>
    </section>
  );
}

function CustomerAvatar({ large = false, name }: { large?: boolean; name: string }) {
  const initials =
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "KA";

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-blue-700 font-black text-white shadow-sm ${
        large ? "h-16 w-16 text-2xl" : "h-12 w-12 text-base"
      }`}
    >
      {initials}
    </div>
  );
}

function SummaryTile({ danger = false, label, value }: { danger?: boolean; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <p className={`mt-2 text-lg font-black ${danger ? "text-red-600" : "text-slate-950"}`}>{value}</p>
    </div>
  );
}

function DeskInfo({ danger = false, label, value }: { danger?: boolean; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-3 text-sm last:border-b-0">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className={`text-right font-black ${danger ? "text-red-600" : "text-slate-800"}`}>{value}</span>
    </div>
  );
}

function RecentOrdersTable({ orders }: { orders: PendingOrder[] }) {
  if (!orders.length) {
    return <EmptyDeskState text="No orders recorded yet" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-3">Date</th>
            <th className="px-3 py-3">Order No</th>
            <th className="px-3 py-3">Items</th>
            <th className="px-3 py-3">Amount</th>
            <th className="px-3 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.slice(0, 4).map((order) => (
            <tr className="border-t border-slate-100" key={order.id}>
              <td className="px-3 py-3 font-semibold text-slate-600">{order.deliveryDate}</td>
              <td className="px-3 py-3 font-black text-slate-900">{order.id}</td>
              <td className="px-3 py-3 font-semibold text-slate-700">{order.product} ({order.quantity}ctn)</td>
              <td className="px-3 py-3 font-black text-slate-900">{formatMoney(order.quantity * 2000)}</td>
              <td className="px-3 py-3">
                <StatusPill label={order.status} tone="blue" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CallControl({
  icon: Icon,
  label,
  onClick,
  primary = false
}: {
  icon: typeof PhoneCall;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      className={`flex min-h-16 flex-col items-center justify-center gap-2 rounded-lg border px-3 py-3 text-xs font-black shadow-sm ${
        primary ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
      onClick={onClick}
      type="button"
    >
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );
}

function EmptyDeskState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-bold text-slate-500">
      {text}
    </div>
  );
}

function normalizeMenuHref(href: string) {
  return href.startsWith("#") ? "/call-center" : href.split("#")[0];
}

function TopBar({
  activeCompany,
  assignedNumbers,
  agentsOnline,
  callsInQueue,
  onCompanyChange,
  user
}: {
  activeCompany: string;
  assignedNumbers: CallCenterNumber[];
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
          <TopMetric label="Assigned Number" value={assignedNumbers[0]?.phoneNumber ?? "Not assigned"} />
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
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const displayName = call?.clientName ?? client?.clientName ?? "No active client";
  const phone = call?.phone ?? client?.phone ?? "";
  const location = call?.location ?? client?.area ?? "";
  const timerStart = call?.acceptedAt ?? call?.startedAt;
  const statusLabel = call?.status === "Incoming" ? "Ringing" : call?.status === "Active" ? "On Call" : call?.status ?? "Ready";
  const timerLabel = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:${String(elapsedSeconds % 60).padStart(2, "0")}`;

  useEffect(() => {
    if (!timerStart || !call || !["Incoming", "Active"].includes(call.status)) {
      setElapsedSeconds(0);
      return;
    }
    const startedAt = timerStart;

    function updateTimer() {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)));
    }

    updateTimer();
    const interval = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(interval);
  }, [call, timerStart]);

  return (
    <Panel title="Current Call" action={<span className="rounded-md bg-emerald-500 px-2 py-1 text-xs font-black text-white">{statusLabel}</span>}>
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <PhoneCall className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-black">{displayName}</h3>
        <p className="mt-1 font-bold text-slate-700">{phone}</p>
        <p className="text-sm font-semibold text-slate-500">{location}</p>
        <p className="mt-5 flex items-center gap-2 text-sm font-bold text-slate-500">
          <span className="h-2 w-2 rounded-full bg-emerald-300" />
          {timerLabel}
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

function AssignedNumbersCard({ numbers }: { numbers: CallCenterNumber[] }) {
  return (
    <Panel title="Assigned Numbers">
      <div className="space-y-3">
        {numbers.map((number) => (
          <article className="rounded-lg border border-slate-100 bg-slate-50 p-3" key={number.id}>
            <p className="text-sm font-black text-slate-950">{number.phoneNumber}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">{number.companyName} - {number.label}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusPill label={number.purpose} tone="blue" />
              <StatusPill label={number.status} tone={number.status === "Active" ? "green" : "amber"} />
            </div>
          </article>
        ))}
        {!numbers.length ? (
          <p className="text-sm font-semibold text-slate-500">No call center number assigned.</p>
        ) : null}
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
  const account = getCustomerAccounts().find((item) => item.phone.replace(/\D/g, "") === client.phone.replace(/\D/g, ""));
  const debts = account ? getCustomerDebts().filter((debt) => debt.customerId === account.customerId) : [];
  const overdueAmount = debts.filter((debt) => debt.paymentStatus === "Overdue").reduce((sum, debt) => sum + debt.balance, 0);
  const lastPayment = account ? getCustomerPayments().find((payment) => payment.customerId === account.customerId) : null;
  const currentBalance = account?.currentBalance ?? client.currentBalance;
  const creditLimit = account?.creditLimit ?? 500_000;
  const creditStatus = account?.status ?? (currentBalance > creditLimit ? "Blocked" : "Active");

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
          <p className={`mt-1 font-black ${currentBalance > 0 ? "text-red-600" : "text-emerald-600"}`}>
            {formatMoney(currentBalance)} RWF
          </p>
          <p className="text-xs font-bold text-slate-500">{creditStatus} {overdueAmount > 0 ? `- ${formatMoney(overdueAmount)} overdue` : ""}</p>
        </div>
        <div className="pl-4">
          <p className="text-xs font-bold text-slate-500">Credit Limit</p>
          <p className="mt-1 font-black">{formatMoney(creditLimit)} RWF</p>
          <p className="text-xs font-bold text-slate-500">AVAILABLE</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <InfoLine label="Last Order" value={`${client.lastOrderQuantity} cartons`} sub={client.lastOrderDate} />
        <InfoLine label="Last Payment" value={lastPayment ? `${formatMoney(lastPayment.amountPaid)} RWF` : client.lastPaymentDate} sub={lastPayment?.date ?? "Recorded"} />
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
