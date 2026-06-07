import type { SessionUser } from "@/lib/auth";
import type { ClientSaleLine } from "@/lib/sales-data";

export type MarketerClient = {
  id: string;
  clientName: string;
  phoneNumber: string;
  location: string;
  customerType: string;
  lastPurchaseDate: string;
  productsUsuallyBought: string[];
  assignedMarketer: string;
  assignedMarketerUsername: string;
  companyId?: string;
  createdAt: string;
  updatedAt: string;
};

const MARKETER_CLIENTS_KEY = "kingapp.marketerClients";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

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
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function normalizedPhone(phoneNumber: string) {
  return phoneNumber.replace(/\D/g, "");
}

function uniqueProducts(products: string[]) {
  return Array.from(new Set(products.filter(Boolean)));
}

export function getMarketerClients() {
  return readJson<MarketerClient[]>(MARKETER_CLIENTS_KEY, []);
}

export function saveMarketerClients(records: MarketerClient[]) {
  writeJson(MARKETER_CLIENTS_KEY, records);
  return records;
}

export function getVisibleMarketerClients(user: SessionUser) {
  const records = getMarketerClients();

  if (user.role === "admin" || user.role === "manager") {
    return records;
  }

  return records.filter(
    (record) =>
      record.assignedMarketerUsername === user.username ||
      record.assignedMarketer === user.displayName
  );
}

export function upsertClientsFromSales({
  clientSales,
  companyId,
  marketerName,
  marketerUsername,
  user
}: {
  clientSales: ClientSaleLine[];
  companyId?: string;
  marketerName: string;
  marketerUsername: string;
  user: SessionUser;
}) {
  const now = new Date().toISOString();
  const records = getMarketerClients();
  const nextRecords = [...records];

  clientSales.forEach((sale) => {
    const phoneKey = normalizedPhone(sale.clientPhone);
    const existingIndex = nextRecords.findIndex((record) => {
      const existingPhone = normalizedPhone(record.phoneNumber);

      if (phoneKey && existingPhone) {
        return existingPhone === phoneKey;
      }

      return (
        record.assignedMarketerUsername === marketerUsername &&
        record.clientName.trim().toLowerCase() === sale.clientName.trim().toLowerCase()
      );
    });
    const saleProducts = uniqueProducts([
      sale.productName,
      ...Object.entries(sale.productQuantities ?? {})
        .filter(([, quantity]) => Number(quantity) > 0)
        .map(([product]) => product)
    ]);

    if (existingIndex >= 0) {
      const existing = nextRecords[existingIndex];
      const canUpdateContact =
        user.role === "admin" || user.permissions?.includes("clients.manage");

      nextRecords[existingIndex] = {
        ...existing,
        clientName: sale.clientName || existing.clientName,
        location: canUpdateContact ? sale.clientLocation || existing.location : existing.location,
        phoneNumber: canUpdateContact ? sale.clientPhone || existing.phoneNumber : existing.phoneNumber,
        lastPurchaseDate: sale.saleDate ?? existing.lastPurchaseDate,
        productsUsuallyBought: uniqueProducts([
          ...existing.productsUsuallyBought,
          ...saleProducts
        ]),
        updatedAt: now
      };
      return;
    }

    nextRecords.unshift({
      id: `MCLIENT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase(),
      assignedMarketer: marketerName,
      assignedMarketerUsername: marketerUsername,
      clientName: sale.clientName,
      companyId,
      createdAt: now,
      customerType: "Retail",
      lastPurchaseDate: sale.saleDate ?? now.slice(0, 10),
      location: sale.clientLocation,
      phoneNumber: sale.clientPhone,
      productsUsuallyBought: saleProducts,
      updatedAt: now
    });
  });

  return saveMarketerClients(nextRecords);
}
