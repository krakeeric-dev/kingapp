import { getActivePrice, getProducts } from "@/lib/products-data";
import { logAuditEvent } from "@/lib/loading-data";

export type ClientOrderStatus =
  | "Pending"
  | "Approved"
  | "Dispatched"
  | "Rejected"
  | "Loaded"
  | "Out for Delivery"
  | "Delivered"
  | "Paid";

export type PortalSupplier = {
  id: string;
  username: string;
  password: string;
  name: string;
  phone: string;
  location: string;
  status: "active" | "inactive";
  notes: string;
  createdAt: string;
};

export type PortalClient = {
  id: string;
  username: string;
  password: string;
  clientName: string;
  ownerName: string;
  phone: string;
  location: string;
  supplier: string;
  assignedMarketer: string;
  productPrices: Record<string, number>;
  status?: "active" | "inactive";
  createdAt?: string;
};

export type SupplierClientLink = {
  id: string;
  supplierId: string;
  clientId: string;
  active: boolean;
  assignedMarketer: string;
  productPrices: Record<string, number>;
  createdAt: string;
};

export type ClientOrderLine = {
  productName: string;
  itemCode: string;
  quantity: number;
  pricePerCarton: number;
  amount: number;
};

export type ClientOrderNotification = {
  id: string;
  message: string;
  createdAt: string;
};

export type ClientPortalOrder = {
  id: string;
  companyId?: string;
  companyName?: string;
  agentId?: string;
  clientId: string;
  clientName: string;
  phone: string;
  location: string;
  supplier: string;
  supplierId?: string;
  assignedMarketer: string;
  lines: ClientOrderLine[];
  totalQuantity: number;
  totalAmount: number;
  status: ClientOrderStatus;
  paymentStatus: "Unpaid" | "Partial" | "Paid";
  createdAt: string;
  deliveryDate?: string;
  deliveryTruck?: string;
  deliveryDriver?: string;
  deliveryPerson?: string;
  deliveredAt?: string;
  estimatedArrivalTime?: string;
  estimatedArrivalEndTime?: string;
  driverMinutesAway?: number;
  notifications?: ClientOrderNotification[];
  rejectionReason?: string;
};

const CLIENTS_KEY = "kingapp.clientPortal.clients";
const SUPPLIERS_KEY = "kingapp.clientPortal.suppliers";
const LINKS_KEY = "kingapp.clientPortal.supplierClients";
const ORDERS_KEY = "kingapp.clientPortal.orders";
const SESSION_KEY = "kingapp.clientPortal.session";
const SUPPLIER_SESSION_KEY = "kingapp.clientPortal.supplierSession";

const mainSupplierId = "SUP-001";

const defaultSuppliers: PortalSupplier[] = [
  {
    id: mainSupplierId,
    username: "supplier1",
    password: "supplier123",
    name: "KingApp Beverage Pro",
    phone: "0788999000",
    location: "Kigali",
    status: "active",
    notes: "Main beverage supplier",
    createdAt: "2026-05-30T00:00:00.000Z"
  },
  {
    id: "SUP-002",
    username: "supplier2",
    password: "supplier123",
    name: "Premium Water Depot",
    phone: "0788999001",
    location: "Gasabo",
    status: "active",
    notes: "Secondary supplier for private client relationships",
    createdAt: "2026-05-30T00:00:00.000Z"
  }
];

const defaultPrices = {
  "WT-500": 1999,
  "WT-1000": 2500,
  "WT-1500": 3000,
  "WT-5000": 5000
};

const defaultClients: PortalClient[] = [
  {
    id: "PORTAL-CL-001",
    username: "kigalimart",
    password: "client123",
    clientName: "Kigali Mart",
    ownerName: "Jean Bosco",
    phone: "0788000001",
    location: "Nyamirambo",
    supplier: "KingApp Beverage Pro",
    assignedMarketer: "Marketer 1",
    productPrices: defaultPrices,
    status: "active",
    createdAt: "2026-05-30T00:00:00.000Z"
  },
  {
    id: "PORTAL-CL-002",
    username: "sunrise",
    password: "client123",
    clientName: "Sunrise Shop",
    ownerName: "Aline Uwase",
    phone: "0788000002",
    location: "Kimironko",
    supplier: "KingApp Beverage Pro",
    assignedMarketer: "Marketer 1",
    productPrices: {
      ...defaultPrices,
      "WT-500": 1950
    },
    status: "active",
    createdAt: "2026-05-30T00:00:00.000Z"
  }
];

function getCompanyForClientOrder(client: PortalClient, supplierId?: string) {
  if (supplierId === "SUP-002") return { id: "COMP-TEJU", name: "Teju Juice" };
  if (client.id === "PORTAL-CL-002") return { id: "COMP-TEJU", name: "Teju Juice" };
  return { id: "COMP-AGAHOZO", name: "Agahozo Water" };
}

const defaultLinks: SupplierClientLink[] = [
  {
    id: "LINK-001",
    supplierId: mainSupplierId,
    clientId: "PORTAL-CL-001",
    active: true,
    assignedMarketer: "Marketer 1",
    productPrices: defaultPrices,
    createdAt: "2026-05-30T00:00:00.000Z"
  },
  {
    id: "LINK-002",
    supplierId: mainSupplierId,
    clientId: "PORTAL-CL-002",
    active: true,
    assignedMarketer: "Marketer 1",
    productPrices: {
      ...defaultPrices,
      "WT-500": 1950
    },
    createdAt: "2026-05-30T00:00:00.000Z"
  }
];

function readJson<T>(key: string, fallback: T): T {
  const rawValue = window.localStorage.getItem(key);

  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    window.localStorage.removeItem(key);
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

function getCustomerCreditControl(companyId: string, phone: string, name: string) {
  if (typeof window === "undefined") return null;
  const customerId = `${companyId}-${phone.replace(/\D/g, "") || name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  try {
    const records = JSON.parse(window.localStorage.getItem("kingapp.customerAccount.overrides") ?? "[]") as Array<{
      customerId: string;
      creditLimit: number;
      status: "Active" | "Blocked" | "On Hold";
    }>;
    return records.find((record) => record.customerId === customerId) ?? null;
  } catch {
    return null;
  }
}

function activeClient(client: PortalClient) {
  return client.status !== "inactive";
}

export function getSuppliers() {
  const suppliers = readJson<PortalSupplier[]>(SUPPLIERS_KEY, []);
  writeJson(SUPPLIERS_KEY, suppliers);
  return suppliers;
}

export function saveSuppliers(suppliers: PortalSupplier[]) {
  writeJson(SUPPLIERS_KEY, suppliers);
  return suppliers;
}

export function getPortalClients() {
  const clients = readJson<PortalClient[]>(CLIENTS_KEY, []);
  writeJson(CLIENTS_KEY, clients);
  return clients;
}

export function savePortalClients(clients: PortalClient[]) {
  writeJson(CLIENTS_KEY, clients);
  return clients;
}

export function getSupplierClientLinks() {
  const links = readJson<SupplierClientLink[]>(LINKS_KEY, []);
  writeJson(LINKS_KEY, links);
  return links;
}

export function saveSupplierClientLinks(links: SupplierClientLink[]) {
  writeJson(LINKS_KEY, links);
  return links;
}

export function getClientOrders() {
  return readJson<ClientPortalOrder[]>(ORDERS_KEY, []);
}

export function saveClientOrders(orders: ClientPortalOrder[]) {
  writeJson(ORDERS_KEY, orders);
  return orders;
}

export function authenticatePortalClient(username: string, password: string) {
  return (
    getPortalClients().find(
      (client) =>
        activeClient(client) &&
        client.username.toLowerCase() === username.trim().toLowerCase() &&
        client.password === password
    ) ?? null
  );
}

export function authenticateSupplier(username: string, password: string) {
  return (
    getSuppliers().find(
      (supplier) =>
        supplier.status === "active" &&
        supplier.username.toLowerCase() === username.trim().toLowerCase() &&
        supplier.password === password
    ) ?? null
  );
}

export function savePortalSession(client: PortalClient) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(client));
}

export function getPortalSession() {
  return readJson<PortalClient | null>(SESSION_KEY, null);
}

export function clearPortalSession() {
  window.localStorage.removeItem(SESSION_KEY);
}

export function saveSupplierSession(supplier: PortalSupplier) {
  window.localStorage.setItem(SUPPLIER_SESSION_KEY, JSON.stringify(supplier));
}

export function getSupplierSession() {
  return readJson<PortalSupplier | null>(SUPPLIER_SESSION_KEY, null);
}

export function clearSupplierSession() {
  window.localStorage.removeItem(SUPPLIER_SESSION_KEY);
}

export function getSuppliersForClient(clientId: string) {
  const suppliers = getSuppliers();
  const links = getSupplierClientLinks();

  return links
    .filter((link) => link.clientId === clientId && link.active)
    .map((link) => suppliers.find((supplier) => supplier.id === link.supplierId))
    .filter((supplier): supplier is PortalSupplier => !!supplier && supplier.status === "active");
}

export function getClientsForSupplier(supplierId: string) {
  const clients = getPortalClients();
  const links = getSupplierClientLinks();

  return links
    .filter((link) => link.supplierId === supplierId && link.active)
    .map((link) => clients.find((client) => client.id === link.clientId))
    .filter((client): client is PortalClient => !!client && activeClient(client));
}

export function getLinkForClientSupplier(clientId: string, supplierId: string) {
  return (
    getSupplierClientLinks().find(
      (link) => link.clientId === clientId && link.supplierId === supplierId && link.active
    ) ?? null
  );
}

export function getCatalogForClientSupplier(client: PortalClient, supplier: PortalSupplier) {
  const link = getLinkForClientSupplier(client.id, supplier.id);

  if (!link || supplier.status !== "active" || !activeClient(client)) {
    return [];
  }

  return getProducts().map((product) => ({
    ...product,
    clientPrice:
      link.productPrices[product.itemCode] ??
      client.productPrices[product.itemCode] ??
      getActivePrice(product.name, product.itemCode)
  }));
}

export function getCatalogForClient(client: PortalClient) {
  const supplier = getSuppliersForClient(client.id)[0];

  if (!supplier) {
    return [];
  }

  return getCatalogForClientSupplier(client, supplier);
}

export function createClientOrder(
  client: PortalClient,
  quantities: Record<string, number>,
  supplierId?: string
) {
  const supplier = supplierId
    ? getSuppliersForClient(client.id).find((item) => item.id === supplierId)
    : getSuppliersForClient(client.id)[0];

  if (!supplier) {
    throw new Error("This client is not linked to that supplier.");
  }

  const link = getLinkForClientSupplier(client.id, supplier.id);
  const company = getCompanyForClientOrder(client, supplier.id);
  const catalog = getCatalogForClientSupplier(client, supplier);
  const lines = catalog
    .map((product) => {
      const quantity = quantities[product.itemCode] ?? 0;

      return {
        productName: product.name,
        itemCode: product.itemCode,
        quantity,
        pricePerCarton: product.clientPrice,
        amount: quantity * product.clientPrice
      };
    })
    .filter((line) => line.quantity > 0);

  const order: ClientPortalOrder = {
    id: makeId("CPO"),
    companyId: company.id,
    companyName: company.name,
    clientId: client.id,
    clientName: client.clientName,
    phone: client.phone,
    location: client.location,
    supplier: supplier.name,
    supplierId: supplier.id,
    assignedMarketer: link?.assignedMarketer ?? client.assignedMarketer,
    lines,
    totalQuantity: lines.reduce((total, line) => total + line.quantity, 0),
    totalAmount: lines.reduce((total, line) => total + line.amount, 0),
    status: "Pending",
    paymentStatus: "Unpaid",
    createdAt: new Date().toISOString(),
    notifications: [
      {
        id: makeId("NTF"),
        message: "Order submitted. Waiting for supplier approval.",
        createdAt: new Date().toISOString()
      }
    ]
  };
  const creditControl = getCustomerCreditControl(company.id, client.phone, client.clientName);
  if (creditControl?.status === "Blocked" || creditControl?.status === "On Hold") {
    throw new Error("This customer account is blocked or on hold. Admin approval is required before creating a new credit order.");
  }
  if (creditControl && order.totalAmount > creditControl.creditLimit) {
    throw new Error("This order exceeds the customer credit limit. Admin approval is required before creating a new credit order.");
  }
  const orders = [order, ...getClientOrders()];
  saveClientOrders(orders);
  logAuditEvent({
    action: "order_created",
    companyId: order.companyId,
    companyName: order.companyName,
    module: "Client Orders",
    newValue: order,
    recordId: order.id,
    reason: "Client order created",
    status: "success"
  });
  return { order, orders };
}

export function updateClientOrderStatus(
  orderId: string,
  status: ClientOrderStatus,
  updates: Partial<ClientPortalOrder> = {}
) {
  const orders = getClientOrders().map((order) =>
    order.id === orderId
      ? {
          ...order,
          ...updates,
          status,
          notifications: [
            ...(order.notifications ?? []),
            {
              id: makeId("NTF"),
              message: getStatusNotification(status, updates),
              createdAt: new Date().toISOString()
            }
          ]
        }
      : order
  );
  const oldOrder = getClientOrders().find((order) => order.id === orderId);
  saveClientOrders(orders);
  const updatedOrder = orders.find((order) => order.id === orderId);
  logAuditEvent({
    action: `order_${status.toLowerCase().replace(/\s+/g, "_")}`,
    companyId: updatedOrder?.companyId,
    companyName: updatedOrder?.companyName,
    module: "Client Orders",
    oldValue: oldOrder,
    newValue: updatedOrder,
    recordId: orderId,
    reason: `Order status changed to ${status}`,
    status: "success"
  });
  return orders;
}

export function updateClientOrderDelivery(
  orderId: string,
  updates: Pick<
    ClientPortalOrder,
    | "deliveryDate"
    | "deliveryTruck"
    | "deliveryDriver"
    | "estimatedArrivalTime"
    | "estimatedArrivalEndTime"
    | "driverMinutesAway"
  >
) {
  const orders = getClientOrders().map((order) =>
    order.id === orderId
      ? {
          ...order,
          ...updates,
          notifications: [
            ...(order.notifications ?? []),
            {
              id: makeId("NTF"),
              message: getDeliveryNotice(updates),
              createdAt: new Date().toISOString()
            }
          ]
        }
      : order
  );
  saveClientOrders(orders);
  return orders;
}

function getDeliveryNotice(updates: Partial<ClientPortalOrder>) {
  const eta = formatEta(updates.estimatedArrivalTime, updates.estimatedArrivalEndTime);
  const driver = updates.deliveryDriver ? ` Driver: ${updates.deliveryDriver}.` : "";
  const truck = updates.deliveryTruck ? ` Truck: ${updates.deliveryTruck}.` : "";
  return eta
    ? `Delivery ETA updated. Expected ${updates.deliveryDate ? `on ${updates.deliveryDate} ` : ""}${eta}.${driver}${truck}`
    : "Delivery details updated.";
}

function getStatusNotification(status: ClientOrderStatus, updates: Partial<ClientPortalOrder>) {
  if (status === "Approved") return "Order approved by supplier.";
  if (status === "Loaded") return "Order loaded and ready for dispatch.";
  if (status === "Out for Delivery") return `Order is out for delivery.${updates.deliveryDriver ? ` Driver: ${updates.deliveryDriver}.` : ""}`;
  if (status === "Delivered") return "Order delivered.";
  if (status === "Rejected") return `Order rejected.${updates.rejectionReason ? ` Reason: ${updates.rejectionReason}` : ""}`;
  if (status === "Paid") return "Payment marked as paid.";
  return `Order status changed to ${status}.`;
}

export function formatEta(startTime?: string, endTime?: string) {
  if (!startTime) return "";
  const start = formatTime(startTime);
  const end = endTime ? formatTime(endTime) : "";
  return end ? `between ${start} and ${end}` : `today at ${start}`;
}

function formatTime(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function createSupplier(input: Omit<PortalSupplier, "id" | "createdAt">) {
  const supplier: PortalSupplier = {
    ...input,
    id: makeId("SUP"),
    createdAt: new Date().toISOString()
  };
  return saveSuppliers([supplier, ...getSuppliers()]);
}

export function updateSupplier(supplierId: string, updates: Partial<PortalSupplier>) {
  const suppliers = getSuppliers().map((supplier) =>
    supplier.id === supplierId ? { ...supplier, ...updates } : supplier
  );
  return saveSuppliers(suppliers);
}

export function createPortalClient(input: Omit<PortalClient, "id" | "createdAt" | "supplier" | "assignedMarketer" | "productPrices">) {
  const client: PortalClient = {
    ...input,
    id: makeId("PORTAL-CL"),
    supplier: "",
    assignedMarketer: "",
    productPrices: {},
    createdAt: new Date().toISOString()
  };
  return savePortalClients([client, ...getPortalClients()]);
}

export function linkClientToSupplier(
  supplierId: string,
  clientId: string,
  assignedMarketer = "Marketer 1",
  productPrices: Record<string, number> = {}
) {
  const links = getSupplierClientLinks();
  const existing = links.find((link) => link.supplierId === supplierId && link.clientId === clientId);

  if (existing) {
    return saveSupplierClientLinks(
      links.map((link) =>
        link.id === existing.id
          ? { ...link, active: true, assignedMarketer, productPrices: { ...link.productPrices, ...productPrices } }
          : link
      )
    );
  }

  const link: SupplierClientLink = {
    id: makeId("LINK"),
    supplierId,
    clientId,
    active: true,
    assignedMarketer,
    productPrices,
    createdAt: new Date().toISOString()
  };

  return saveSupplierClientLinks([link, ...links]);
}

export function removeClientFromSupplier(supplierId: string, clientId: string) {
  return saveSupplierClientLinks(
    getSupplierClientLinks().map((link) =>
      link.supplierId === supplierId && link.clientId === clientId ? { ...link, active: false } : link
    )
  );
}

export function updateLinkPrices(
  supplierId: string,
  clientId: string,
  productPrices: Record<string, number>,
  assignedMarketer?: string
) {
  const links = getSupplierClientLinks().map((link) =>
    link.supplierId === supplierId && link.clientId === clientId
      ? {
          ...link,
          assignedMarketer: assignedMarketer ?? link.assignedMarketer,
          productPrices: { ...link.productPrices, ...productPrices }
        }
      : link
  );
  return saveSupplierClientLinks(links);
}

export function updateClientAssignment(
  clientId: string,
  updates: Pick<PortalClient, "supplier" | "assignedMarketer" | "productPrices">
) {
  const clients = getPortalClients().map((client) =>
    client.id === clientId ? { ...client, ...updates } : client
  );
  savePortalClients(clients);
  const supplier = getSuppliers().find((item) => item.name === updates.supplier);

  if (supplier) {
    linkClientToSupplier(supplier.id, clientId, updates.assignedMarketer, updates.productPrices);
  }

  return clients;
}
