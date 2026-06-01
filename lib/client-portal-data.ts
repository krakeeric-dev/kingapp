import { getActivePrice, getProducts } from "@/lib/products-data";

export type ClientOrderStatus =
  | "Pending"
  | "Approved"
  | "Loaded"
  | "Out for Delivery"
  | "Delivered"
  | "Paid";

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
};

export type ClientOrderLine = {
  productName: string;
  itemCode: string;
  quantity: number;
  pricePerCarton: number;
  amount: number;
};

export type ClientPortalOrder = {
  id: string;
  clientId: string;
  clientName: string;
  phone: string;
  location: string;
  supplier: string;
  assignedMarketer: string;
  lines: ClientOrderLine[];
  totalQuantity: number;
  totalAmount: number;
  status: ClientOrderStatus;
  paymentStatus: "Unpaid" | "Partial" | "Paid";
  createdAt: string;
  deliveryPerson?: string;
  deliveredAt?: string;
};

const CLIENTS_KEY = "kingapp.clientPortal.clients";
const ORDERS_KEY = "kingapp.clientPortal.orders";
const SESSION_KEY = "kingapp.clientPortal.session";

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
    productPrices: {
      "WT-500": 1999,
      "WT-1000": 2500,
      "WT-1500": 3000,
      "WT-5000": 5000
    }
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
      "WT-500": 1950,
      "WT-1000": 2500,
      "WT-1500": 3000,
      "WT-5000": 5000
    }
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

export function getPortalClients() {
  const clients = readJson<PortalClient[]>(CLIENTS_KEY, defaultClients);
  writeJson(CLIENTS_KEY, clients);
  return clients;
}

export function savePortalClients(clients: PortalClient[]) {
  writeJson(CLIENTS_KEY, clients);
  return clients;
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
        client.username.toLowerCase() === username.trim().toLowerCase() &&
        client.password === password
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

export function getCatalogForClient(client: PortalClient) {
  return getProducts().map((product) => ({
    ...product,
    clientPrice:
      client.productPrices[product.itemCode] ??
      getActivePrice(product.name, product.itemCode)
  }));
}

export function createClientOrder(
  client: PortalClient,
  quantities: Record<string, number>
) {
  const lines = getCatalogForClient(client)
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
    id: `CPO-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase(),
    clientId: client.id,
    clientName: client.clientName,
    phone: client.phone,
    location: client.location,
    supplier: client.supplier,
    assignedMarketer: client.assignedMarketer,
    lines,
    totalQuantity: lines.reduce((total, line) => total + line.quantity, 0),
    totalAmount: lines.reduce((total, line) => total + line.amount, 0),
    status: "Pending",
    paymentStatus: "Unpaid",
    createdAt: new Date().toISOString()
  };
  const orders = [order, ...getClientOrders()];
  saveClientOrders(orders);
  return { order, orders };
}

export function updateClientOrderStatus(
  orderId: string,
  status: ClientOrderStatus,
  updates: Partial<ClientPortalOrder> = {}
) {
  const orders = getClientOrders().map((order) =>
    order.id === orderId ? { ...order, ...updates, status } : order
  );
  saveClientOrders(orders);
  return orders;
}

export function updateClientAssignment(
  clientId: string,
  updates: Pick<PortalClient, "supplier" | "assignedMarketer" | "productPrices">
) {
  const clients = getPortalClients().map((client) =>
    client.id === clientId ? { ...client, ...updates } : client
  );
  savePortalClients(clients);
  return clients;
}
