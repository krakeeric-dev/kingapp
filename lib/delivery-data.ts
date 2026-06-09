import type { SessionUser } from "@/lib/auth";
import {
  getClientOrders,
  saveClientOrders,
  type ClientPortalOrder
} from "@/lib/client-portal-data";
import {
  canAccessCompany,
  getCompanyName,
  getCompanyWorkspaceId
} from "@/lib/companies-data";
import { logAuditEvent } from "@/lib/loading-data";
import { upsertSupabaseRows } from "@/lib/supabase";

export type DeliveryStatus =
  | "Pending Dispatch"
  | "Dispatched"
  | "Out for Delivery"
  | "Delivered"
  | "Failed Delivery"
  | "Returned";

export type DriverStatus = "Available" | "On Delivery" | "Off Duty" | "Inactive";
export type VehicleStatus = "Available" | "On Route" | "Maintenance" | "Inactive";
export type PaymentStatus = "Unpaid" | "Partial" | "Paid";

export type DeliveryRecord = {
  id: string;
  date: string;
  companyId: string;
  companyName: string;
  clientId?: string;
  clientName: string;
  clientPhone?: string;
  orderId: string;
  productSummary: string;
  totalCartons: number;
  truck: string;
  driver: string;
  driverPhone?: string;
  deliveryStaff: string;
  deliveryLocation: string;
  etaStart: string;
  etaEnd: string;
  status: DeliveryStatus;
  deliveredQuantity?: number;
  deliveredAt?: string;
  clientReceivedName?: string;
  clientReceivedPhone?: string;
  notes?: string;
  paymentStatus?: PaymentStatus;
  failedReason?: string;
  signature?: string;
  photoPlaceholder?: string;
  gpsLocation?: string;
  notificationHistory: Array<{ id: string; message: string; createdAt: string }>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type DeliveryDriver = {
  id: string;
  companyId: string;
  companyName: string;
  name: string;
  phone: string;
  vehicleAssigned: string;
  status: DriverStatus;
  createdAt: string;
  updatedAt: string;
};

export type DeliveryVehicle = {
  id: string;
  companyId: string;
  companyName: string;
  plateNumber: string;
  vehicleType: string;
  driver: string;
  status: VehicleStatus;
  fuelNotes: string;
  createdAt: string;
  updatedAt: string;
};

const DELIVERIES_KEY = "kingapp.delivery.records";
const DRIVERS_KEY = "kingapp.delivery.drivers";
const VEHICLES_KEY = "kingapp.delivery.vehicles";

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

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function getDeliveryRecords() {
  return readJson<DeliveryRecord[]>(DELIVERIES_KEY, []);
}

export function saveDeliveryRecords(records: DeliveryRecord[]) {
  writeJson(DELIVERIES_KEY, records);
  void upsertSupabaseRows(
    "delivery_records",
    records,
    (record) => record.id,
    (record) => record.updatedAt
  );
  return records;
}

export function getDeliveryDrivers() {
  return readJson<DeliveryDriver[]>(DRIVERS_KEY, []);
}

export function saveDeliveryDrivers(records: DeliveryDriver[]) {
  writeJson(DRIVERS_KEY, records);
  void upsertSupabaseRows(
    "delivery_drivers",
    records,
    (record) => record.id,
    (record) => record.updatedAt
  );
  return records;
}

export function getDeliveryVehicles() {
  return readJson<DeliveryVehicle[]>(VEHICLES_KEY, []);
}

export function saveDeliveryVehicles(records: DeliveryVehicle[]) {
  writeJson(VEHICLES_KEY, records);
  void upsertSupabaseRows(
    "delivery_vehicles",
    records,
    (record) => record.id,
    (record) => record.updatedAt
  );
  return records;
}

export function filterDeliveriesForUser(records: DeliveryRecord[], user: SessionUser) {
  const workspaceId = getCompanyWorkspaceId(user);
  return records.filter((record) => {
    if (user.role === "client") return record.clientId === user.id;
    if (workspaceId !== "all") return record.companyId === workspaceId;
    return canAccessCompany(user, record.companyId);
  });
}

export function filterDriversForUser(records: DeliveryDriver[], user: SessionUser) {
  const workspaceId = getCompanyWorkspaceId(user);
  return records.filter((record) => workspaceId === "all" ? canAccessCompany(user, record.companyId) : record.companyId === workspaceId);
}

export function filterVehiclesForUser(records: DeliveryVehicle[], user: SessionUser) {
  const workspaceId = getCompanyWorkspaceId(user);
  return records.filter((record) => workspaceId === "all" ? canAccessCompany(user, record.companyId) : record.companyId === workspaceId);
}

export function getDispatchableOrders(user: SessionUser) {
  const workspaceId = getCompanyWorkspaceId(user);
  const dispatchedOrderIds = new Set(getDeliveryRecords().map((record) => record.orderId));

  return getClientOrders().filter((order) => {
    if (dispatchedOrderIds.has(order.id)) return false;
    if (!["Approved", "Loaded"].includes(order.status)) return false;
    if (workspaceId !== "all") return order.companyId === workspaceId;
    return canAccessCompany(user, order.companyId);
  });
}

export function createDeliveryDispatch({
  deliveryStaff,
  driver,
  driverPhone,
  etaEnd,
  etaStart,
  order,
  truck,
  user
}: {
  deliveryStaff: string;
  driver: string;
  driverPhone?: string;
  etaEnd: string;
  etaStart: string;
  order: ClientPortalOrder;
  truck: string;
  user: SessionUser;
}) {
  const now = new Date().toISOString();
  const companyId = order.companyId ?? user.companyId;
  const companyName = order.companyName ?? getCompanyName(companyId, user.companyName);
  const productSummary = order.lines
    .map((line) => `${line.quantity} x ${line.productName}`)
    .join(", ");
  const record: DeliveryRecord = {
    id: makeId("DEL"),
    date: today(),
    companyId,
    companyName,
    clientId: order.clientId,
    clientName: order.clientName,
    clientPhone: order.phone,
    orderId: order.id,
    productSummary,
    totalCartons: order.totalQuantity,
    truck,
    driver,
    driverPhone,
    deliveryStaff,
    deliveryLocation: order.location,
    etaStart,
    etaEnd,
    status: "Dispatched",
    paymentStatus: order.paymentStatus,
    notificationHistory: [
      {
        id: makeId("DNTF"),
        message: "Dispatch created. Delivery is being prepared.",
        createdAt: now
      }
    ],
    createdBy: user.displayName,
    createdAt: now,
    updatedAt: now
  };
  const records = saveDeliveryRecords([record, ...getDeliveryRecords()]);
  saveClientOrders(
    getClientOrders().map((item) =>
      item.id === order.id
        ? {
            ...item,
            status: "Dispatched",
            deliveryTruck: truck,
            deliveryDriver: driver,
            deliveryPerson: deliveryStaff,
            estimatedArrivalTime: etaStart,
            estimatedArrivalEndTime: etaEnd,
            notifications: [
              ...(item.notifications ?? []),
              {
                id: makeId("NTF"),
                message: "Order dispatched. Delivery team is on the way.",
                createdAt: now
              }
            ]
          }
        : item
    )
  );
  logAuditEvent({
    action: "dispatch_created",
    companyId,
    companyName,
    module: "Delivery",
    newValue: record,
    recordId: record.id,
    reason: "Delivery dispatch created",
    status: "success",
    user
  });
  return { record, records };
}

export function updateDeliveryStatus({
  deliveryId,
  updates,
  user
}: {
  deliveryId: string;
  updates: Partial<DeliveryRecord> & { status: DeliveryStatus };
  user: SessionUser;
}) {
  const records = getDeliveryRecords();
  const oldRecord = records.find((record) => record.id === deliveryId);
  const now = new Date().toISOString();
  const updatedRecords = records.map((record) =>
    record.id === deliveryId
      ? {
          ...record,
          ...updates,
          notificationHistory: [
            {
              id: makeId("DNTF"),
              message: `Delivery status changed to ${updates.status}.`,
              createdAt: now
            },
            ...(record.notificationHistory ?? [])
          ],
          updatedAt: now
        }
      : record
  );
  const updatedRecord = updatedRecords.find((record) => record.id === deliveryId);
  saveDeliveryRecords(updatedRecords);

  if (updatedRecord) {
    saveClientOrders(
      getClientOrders().map((order) => {
        if (order.id !== updatedRecord.orderId) return order;
        return {
          ...order,
          status: updatedRecord.status === "Delivered" ? "Delivered" : updatedRecord.status === "Out for Delivery" ? "Out for Delivery" : order.status,
          deliveredAt: updatedRecord.deliveredAt ?? order.deliveredAt,
          deliveryTruck: updatedRecord.truck,
          deliveryDriver: updatedRecord.driver,
          deliveryPerson: updatedRecord.deliveryStaff,
          notifications: [
            ...(order.notifications ?? []),
            {
              id: makeId("NTF"),
              message: `Delivery status changed to ${updatedRecord.status}.`,
              createdAt: now
            }
          ]
        };
      })
    );
  }

  logAuditEvent({
    action:
      updates.status === "Delivered"
        ? "delivery_confirmed"
        : updates.status === "Failed Delivery"
          ? "failed_delivery_recorded"
          : "delivery_status_changed",
    companyId: updatedRecord?.companyId,
    companyName: updatedRecord?.companyName,
    module: "Delivery",
    oldValue: oldRecord,
    newValue: updatedRecord,
    recordId: deliveryId,
    reason: updates.failedReason || updates.notes || `Delivery status changed to ${updates.status}`,
    status: "success",
    user
  });

  return updatedRecords;
}

export function upsertDriver(input: Omit<DeliveryDriver, "createdAt" | "id" | "updatedAt"> & { id?: string }, user: SessionUser) {
  const now = new Date().toISOString();
  const records = getDeliveryDrivers();
  const oldRecord = input.id ? records.find((record) => record.id === input.id) : undefined;
  const record: DeliveryDriver = {
    ...input,
    id: input.id || makeId("DRV"),
    createdAt: oldRecord?.createdAt ?? now,
    updatedAt: now
  };
  const updatedRecords = oldRecord
    ? records.map((item) => (item.id === record.id ? record : item))
    : [record, ...records];
  saveDeliveryDrivers(updatedRecords);
  logAuditEvent({
    action: oldRecord ? "driver_edited" : "driver_created",
    companyId: record.companyId,
    companyName: record.companyName,
    module: "Delivery Drivers",
    oldValue: oldRecord,
    newValue: record,
    recordId: record.id,
    reason: oldRecord ? "Driver edited" : "Driver created",
    status: "success",
    user
  });
  return updatedRecords;
}

export function upsertVehicle(input: Omit<DeliveryVehicle, "createdAt" | "id" | "updatedAt"> & { id?: string }, user: SessionUser) {
  const now = new Date().toISOString();
  const records = getDeliveryVehicles();
  const oldRecord = input.id ? records.find((record) => record.id === input.id) : undefined;
  const record: DeliveryVehicle = {
    ...input,
    id: input.id || makeId("VEH"),
    createdAt: oldRecord?.createdAt ?? now,
    updatedAt: now
  };
  const updatedRecords = oldRecord
    ? records.map((item) => (item.id === record.id ? record : item))
    : [record, ...records];
  saveDeliveryVehicles(updatedRecords);
  logAuditEvent({
    action: oldRecord ? "vehicle_edited" : "vehicle_created",
    companyId: record.companyId,
    companyName: record.companyName,
    module: "Delivery Vehicles",
    oldValue: oldRecord,
    newValue: record,
    recordId: record.id,
    reason: oldRecord ? "Vehicle edited" : "Vehicle created",
    status: "success",
    user
  });
  return updatedRecords;
}

export function getDeliveryDashboardTotals(records: DeliveryRecord[]) {
  const date = today();
  const todays = records.filter((record) => record.date === date);
  const isDelayed = (record: DeliveryRecord) =>
    record.status !== "Delivered" &&
    record.status !== "Failed Delivery" &&
    record.etaEnd &&
    new Date(`${record.date}T${record.etaEnd}:00`).getTime() < Date.now();

  return {
    deliveriesToday: todays.length,
    pendingDispatch: records.filter((record) => record.status === "Pending Dispatch").length,
    outForDelivery: records.filter((record) => record.status === "Out for Delivery").length,
    delivered: todays.filter((record) => record.status === "Delivered").length,
    failed: todays.filter((record) => record.status === "Failed Delivery").length,
    returned: todays.filter((record) => record.status === "Returned").length,
    delayed: records.filter(isDelayed).length
  };
}

export function getDeliveryReportRows(records: DeliveryRecord[], period: "daily" | "weekly" | "monthly") {
  const now = new Date();
  return records.filter((record) => {
    const recordDate = new Date(`${record.date}T00:00:00`);
    if (period === "daily") return record.date === today();
    if (period === "weekly") return now.getTime() - recordDate.getTime() <= 7 * 86_400_000;
    return now.getFullYear() === recordDate.getFullYear() && now.getMonth() === recordDate.getMonth();
  });
}

export function getDeliveriesForClient(clientId: string) {
  return getDeliveryRecords().filter((record) => record.clientId === clientId);
}

export function getDeliveryForOrder(orderId: string) {
  return getDeliveryRecords().find((record) => record.orderId === orderId) ?? null;
}
