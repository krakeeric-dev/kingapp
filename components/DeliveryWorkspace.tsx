"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPinned,
  PackageCheck,
  Route,
  Truck,
  XCircle
} from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { KingAppLogo } from "@/components/KingAppLogo";
import { getCompanies, getCompanyName, getCompanyWorkspaceId } from "@/lib/companies-data";
import type { ClientPortalOrder } from "@/lib/client-portal-data";
import { logAuditEvent } from "@/lib/loading-data";
import { formatMoney } from "@/lib/sales-data";
import {
  createDeliveryDispatch,
  filterDeliveriesForUser,
  filterDriversForUser,
  filterVehiclesForUser,
  getDeliveryDashboardTotals,
  getDeliveryDrivers,
  getDeliveryRecords,
  getDeliveryReportRows,
  getDeliveryVehicles,
  getDispatchableOrders,
  saveDeliveryRecords,
  type DeliveryDriver,
  type DeliveryRecord,
  type DeliveryStatus,
  type DeliveryVehicle,
  upsertDriver,
  upsertVehicle,
  updateDeliveryStatus
} from "@/lib/delivery-data";
import { hasPermission } from "@/lib/permissions";

type DeliveryWorkspaceMode = "dashboard" | "dispatch" | "routes" | "drivers" | "reports";
type DispatchPassCopyMode = "driver" | "gate" | "both";

const deliveryStatuses: DeliveryStatus[] = [
  "Pending Dispatch",
  "Dispatched",
  "Out for Delivery",
  "Delivered",
  "Failed Delivery",
  "Returned"
];

export function DeliveryWorkspace({
  mode,
  user
}: {
  mode: DeliveryWorkspaceMode;
  user: SessionUser;
}) {
  const [records, setRecords] = useState<DeliveryRecord[]>([]);
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [vehicles, setVehicles] = useState<DeliveryVehicle[]>([]);
  const [dispatchableOrders, setDispatchableOrders] = useState<ClientPortalOrder[]>([]);
  const [message, setMessage] = useState("");
  const [printPass, setPrintPass] = useState<{ copyMode: DispatchPassCopyMode; record: DeliveryRecord } | null>(null);

  function refresh() {
    setRecords(filterDeliveriesForUser(getDeliveryRecords(), user));
    setDrivers(filterDriversForUser(getDeliveryDrivers(), user));
    setVehicles(filterVehiclesForUser(getDeliveryVehicles(), user));
    setDispatchableOrders(getDispatchableOrders(user));
  }

  useEffect(() => {
    refresh();
  }, []);

  const dashboard = useMemo(() => {
    const totals = getDeliveryDashboardTotals(records);
    return {
      ...totals,
      pendingDispatch: totals.pendingDispatch + dispatchableOrders.length
    };
  }, [dispatchableOrders.length, records]);

  function handleCreateDispatch(event: FormEvent<HTMLFormElement>, order: ClientPortalOrder) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const truck = String(form.get("truck") ?? "").trim();
    const driver = String(form.get("driver") ?? "").trim();
    const driverPhone = drivers.find((item) => item.name === driver)?.phone ?? "";
    const deliveryStaff = String(form.get("deliveryStaff") ?? user.displayName).trim();
    const etaStart = String(form.get("etaStart") ?? "").trim();
    const etaEnd = String(form.get("etaEnd") ?? "").trim();

    if (!truck || !driver || !etaStart || !etaEnd) {
      setMessage("Truck, driver, ETA start, and ETA end are required.");
      return;
    }

    createDeliveryDispatch({
      deliveryStaff,
      driver,
      driverPhone,
      etaEnd,
      etaStart,
      order,
      truck,
      user
    });
    setMessage(`Dispatch created for ${order.id}.`);
    event.currentTarget.reset();
    refresh();
  }

  function handleStatusUpdate(event: FormEvent<HTMLFormElement>, record: DeliveryRecord) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const status = String(form.get("status") ?? record.status) as DeliveryStatus;
    const updates = {
      status,
      deliveredQuantity: Number(form.get("deliveredQuantity")) || undefined,
      deliveredAt: status === "Delivered" ? new Date().toISOString() : record.deliveredAt,
      clientReceivedName: String(form.get("clientReceivedName") ?? record.clientReceivedName ?? ""),
      clientReceivedPhone: String(form.get("clientReceivedPhone") ?? record.clientReceivedPhone ?? ""),
      paymentStatus: String(form.get("paymentStatus") ?? record.paymentStatus ?? "Unpaid") as DeliveryRecord["paymentStatus"],
      failedReason: String(form.get("failedReason") ?? ""),
      notes: String(form.get("notes") ?? ""),
      signature: String(form.get("signature") ?? ""),
      photoPlaceholder: String(form.get("photoPlaceholder") ?? ""),
      gpsLocation: String(form.get("gpsLocation") ?? "")
    };

    setRecords(filterDeliveriesForUser(updateDeliveryStatus({ deliveryId: record.id, updates, user }), user));
    setMessage(`Delivery ${record.id} updated to ${status}.`);
  }

  function handleDriverSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const companyId = String(form.get("companyId") ?? getCompanyWorkspaceId(user));
    setDrivers(
      filterDriversForUser(
        upsertDriver(
          {
            companyId,
            companyName: getCompanyName(companyId, user.companyName),
            name: String(form.get("name") ?? ""),
            phone: String(form.get("phone") ?? ""),
            status: String(form.get("status") ?? "Available") as DeliveryDriver["status"],
            vehicleAssigned: String(form.get("vehicleAssigned") ?? "")
          },
          user
        ),
        user
      )
    );
    setMessage("Driver saved.");
    event.currentTarget.reset();
  }

  function handleVehicleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const companyId = String(form.get("companyId") ?? getCompanyWorkspaceId(user));
    setVehicles(
      filterVehiclesForUser(
        upsertVehicle(
          {
            companyId,
            companyName: getCompanyName(companyId, user.companyName),
            driver: String(form.get("driver") ?? ""),
            fuelNotes: String(form.get("fuelNotes") ?? ""),
            plateNumber: String(form.get("plateNumber") ?? ""),
            status: String(form.get("status") ?? "Available") as DeliveryVehicle["status"],
            vehicleType: String(form.get("vehicleType") ?? "")
          },
          user
        ),
        user
      )
    );
    setMessage("Vehicle saved.");
    event.currentTarget.reset();
  }

  function clearDeliveryRecordsForDemoOnly() {
    saveDeliveryRecords(records);
  }

  const canPrintDispatchPass =
    user.role === "admin" ||
    hasPermission(user, "delivery.dispatch") ||
    hasPermission(user, "delivery.confirm");

  function handlePrintDispatchPass(record: DeliveryRecord, copyMode: DispatchPassCopyMode, output: "print" | "pdf") {
    setPrintPass({ copyMode, record });
    logAuditEvent({
      action: "dispatch_pass_printed",
      companyId: record.companyId,
      companyName: record.companyName,
      module: "Delivery",
      recordId: record.id,
      reason: output === "pdf" ? "Dispatch gate pass PDF requested using browser print" : "Dispatch gate pass printed",
      status: "success",
      user
    });
    window.setTimeout(() => window.print(), 100);
  }

  return (
    <div className="space-y-6">
      <section className="app-card-soft p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-brand-50 p-3 text-brand-700">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-normal text-brand-700">
                Delivery Management
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                Track dispatch, routes, drivers, and proof of delivery
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Approved or loaded client orders can be dispatched, followed in transit, confirmed by delivery staff, and reported by driver, vehicle, company, and delivery status.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <DeliveryTab href="/delivery" label="Dashboard" />
            <DeliveryTab href="/delivery/dispatch" label="Dispatch" />
            <DeliveryTab href="/delivery/routes" label="Routes" />
            <DeliveryTab href="/delivery/drivers" label="Drivers" />
            <DeliveryTab href="/delivery/reports" label="Reports" />
          </div>
        </div>
      </section>

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </div>
      ) : null}

      {(mode === "dashboard" || mode === "dispatch" || mode === "routes" || mode === "reports") ? (
        <DeliveryKpis dashboard={dashboard} />
      ) : null}

      {mode === "dashboard" ? (
        <>
          <DeliveryDashboardOverview records={records} dispatchableOrders={dispatchableOrders} />
          <DeliveryRecordsTable
            canConfirm={hasPermission(user, "delivery.confirm") || user.role === "admin"}
            canPrint={canPrintDispatchPass}
            onStatusUpdate={handleStatusUpdate}
            onPrint={handlePrintDispatchPass}
            records={records}
          />
        </>
      ) : null}

      {mode === "dispatch" ? (
        <>
          <DispatchBoard
            drivers={drivers}
            onCreateDispatch={handleCreateDispatch}
            orders={dispatchableOrders}
            user={user}
            vehicles={vehicles}
          />
          <DeliveryRecordsTable
            canConfirm={false}
            canPrint={canPrintDispatchPass}
            onPrint={handlePrintDispatchPass}
            records={records.filter((record) => record.status === "Dispatched" || record.status === "Out for Delivery")}
            title="Printable Dispatch Passes"
          />
        </>
      ) : null}

      {mode === "routes" ? (
        <RoutesBoard
          canConfirm={hasPermission(user, "delivery.confirm") || user.role === "admin"}
          canPrint={canPrintDispatchPass}
          onPrint={handlePrintDispatchPass}
          onStatusUpdate={handleStatusUpdate}
          records={records}
        />
      ) : null}

      {mode === "drivers" ? (
        <DriversBoard
          drivers={drivers}
          onDriverSubmit={handleDriverSubmit}
          onVehicleSubmit={handleVehicleSubmit}
          user={user}
          vehicles={vehicles}
        />
      ) : null}

      {mode === "reports" ? (
        <DeliveryReports records={records} onNoop={clearDeliveryRecordsForDemoOnly} />
      ) : null}

      {printPass ? (
        <PrintableDispatchGatePass copyMode={printPass.copyMode} record={printPass.record} user={user} />
      ) : null}
    </div>
  );
}

function DeliveryTab({ href, label }: { href: string; label: string }) {
  return (
    <Link className="secondary-button" href={href}>
      {label}
    </Link>
  );
}

function DeliveryKpis({ dashboard }: { dashboard: ReturnType<typeof getDeliveryDashboardTotals> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
      <KpiCard icon={Truck} label="Deliveries Today" value={dashboard.deliveriesToday} />
      <KpiCard icon={Clock} label="Pending Dispatch" value={dashboard.pendingDispatch} />
      <KpiCard icon={Route} label="Out for Delivery" value={dashboard.outForDelivery} />
      <KpiCard icon={CheckCircle2} label="Delivered" value={dashboard.delivered} />
      <KpiCard icon={XCircle} label="Failed" value={dashboard.failed} tone="danger" />
      <KpiCard icon={PackageCheck} label="Returned" value={dashboard.returned} />
      <KpiCard icon={AlertTriangle} label="Delayed" value={dashboard.delayed} tone="warning" />
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  tone = "brand",
  value
}: {
  icon: typeof Truck;
  label: string;
  tone?: "brand" | "danger" | "warning";
  value: number | string;
}) {
  const color =
    tone === "danger"
      ? "bg-red-50 text-red-700"
      : tone === "warning"
        ? "bg-amber-50 text-amber-700"
        : "bg-brand-50 text-brand-700";

  return (
    <article className="app-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-normal text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
        </div>
        <div className={`rounded-lg p-2 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  );
}

function DeliveryDashboardOverview({
  dispatchableOrders,
  records
}: {
  dispatchableOrders: ClientPortalOrder[];
  records: DeliveryRecord[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="app-card p-5">
        <h3 className="text-lg font-black text-slate-950">Delivery Operations Flow</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          {["Approved Order", "Dispatch", "Out for Delivery", "Proof", "Delivered"].map((step, index) => (
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-center" key={step}>
              <p className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-sm font-black text-brand-800">
                {index + 1}
              </p>
              <p className="mt-3 text-sm font-black text-slate-800">{step}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="app-card p-5">
        <h3 className="text-lg font-black text-slate-950">Today’s Dispatch Queue</h3>
        <p className="mt-2 text-sm text-slate-600">
          {dispatchableOrders.length} approved or loaded orders are waiting for dispatch.
        </p>
        <div className="mt-4 space-y-2">
          {dispatchableOrders.slice(0, 4).map((order) => (
            <div className="rounded-lg border border-slate-200 bg-white p-3" key={order.id}>
              <p className="font-black text-slate-950">{order.clientName}</p>
              <p className="text-sm text-slate-500">{order.id} - {order.totalQuantity} cartons</p>
            </div>
          ))}
          {!dispatchableOrders.length && !records.length ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-500">
              No delivery records yet.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function DispatchBoard({
  drivers,
  onCreateDispatch,
  orders,
  user,
  vehicles
}: {
  drivers: DeliveryDriver[];
  onCreateDispatch: (event: FormEvent<HTMLFormElement>, order: ClientPortalOrder) => void;
  orders: ClientPortalOrder[];
  user: SessionUser;
  vehicles: DeliveryVehicle[];
}) {
  return (
    <section className="app-card p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-950">Create Dispatch</h3>
          <p className="text-sm text-slate-600">Dispatch approved or loaded client orders to trucks and drivers.</p>
        </div>
        <Link className="secondary-button" href="/client-orders">View Client Orders</Link>
      </div>
      <div className="mt-5 grid gap-4">
        {orders.map((order) => (
          <article className="rounded-lg border border-slate-200 bg-white p-4" key={order.id}>
            <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="status-badge border-brand-100 bg-brand-50 text-brand-800">{order.status}</span>
                  <span className="status-badge border-slate-200 bg-slate-50 text-slate-700">{order.companyName ?? "Company pending"}</span>
                </div>
                <h4 className="mt-3 text-lg font-black text-slate-950">{order.clientName}</h4>
                <p className="mt-1 text-sm text-slate-600">{order.phone} - {order.location}</p>
                <p className="mt-3 font-black text-brand-800">
                  {order.totalQuantity} cartons - {formatMoney(order.totalAmount)} RWF
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  {order.lines.map((line) => `${line.quantity} x ${line.productName}`).join(", ")}
                </p>
              </div>
              <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => onCreateDispatch(event, order)}>
                <Input defaultValue={new Date().toISOString().slice(0, 10)} label="Date" name="date" type="date" />
                <Input defaultValue={order.location} label="Delivery Location" name="deliveryLocation" />
                <Select
                  fallbackName="truck"
                  label="Truck / Vehicle"
                  name="truck"
                  options={vehicles.map((vehicle) => ({
                    label: `${vehicle.plateNumber} - ${vehicle.vehicleType}`,
                    value: vehicle.plateNumber
                  }))}
                  placeholder="Enter vehicle plate"
                />
                <Select
                  fallbackName="driver"
                  label="Driver"
                  name="driver"
                  options={drivers.map((driver) => ({
                    label: `${driver.name} - ${driver.phone}`,
                    value: driver.name
                  }))}
                  placeholder="Enter driver name"
                />
                <Input defaultValue={user.displayName} label="Marketer / Delivery Staff" name="deliveryStaff" />
                <Input label="ETA Start" name="etaStart" type="time" />
                <Input label="ETA End" name="etaEnd" type="time" />
                <button className="primary-button md:col-span-2">Create Dispatch</button>
              </form>
            </div>
          </article>
        ))}
        {!orders.length ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-5 text-sm font-semibold text-slate-500">
            No approved or loaded orders are waiting for dispatch.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function RoutesBoard({
  canConfirm,
  canPrint,
  onPrint,
  onStatusUpdate,
  records
}: {
  canConfirm: boolean;
  canPrint: boolean;
  onPrint: (record: DeliveryRecord, copyMode: DispatchPassCopyMode, output: "print" | "pdf") => void;
  onStatusUpdate: (event: FormEvent<HTMLFormElement>, record: DeliveryRecord) => void;
  records: DeliveryRecord[];
}) {
  const grouped = records.reduce<Record<string, DeliveryRecord[]>>((groups, record) => {
    const key = record.truck || "Unassigned Truck";
    groups[key] = [...(groups[key] ?? []), record];
    return groups;
  }, {});

  return (
    <div className="grid gap-4">
      {Object.entries(grouped).map(([truck, truckRecords]) => (
        <section className="app-card p-5" key={truck}>
          <div className="mb-4 flex items-center gap-2">
            <MapPinned className="h-5 w-5 text-brand-700" />
            <h3 className="text-lg font-black text-slate-950">{truck}</h3>
          </div>
          <DeliveryRecordsTable canConfirm={canConfirm} canPrint={canPrint} onPrint={onPrint} onStatusUpdate={onStatusUpdate} records={truckRecords} />
        </section>
      ))}
      {!records.length ? (
        <section className="app-card p-5">
          <p className="text-sm font-semibold text-slate-500">No active delivery routes yet.</p>
        </section>
      ) : null}
    </div>
  );
}

function DriversBoard({
  drivers,
  onDriverSubmit,
  onVehicleSubmit,
  user,
  vehicles
}: {
  drivers: DeliveryDriver[];
  onDriverSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onVehicleSubmit: (event: FormEvent<HTMLFormElement>) => void;
  user: SessionUser;
  vehicles: DeliveryVehicle[];
}) {
  const canManage = hasPermission(user, "delivery.manageDrivers") || user.role === "admin";

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {canManage ? (
        <>
          <section className="app-card p-5">
            <h3 className="text-lg font-black text-slate-950">Add Driver</h3>
            <form className="mt-4 grid gap-3" onSubmit={onDriverSubmit}>
              <CompanySelect user={user} />
              <Input label="Driver Name" name="name" />
              <Input label="Phone" name="phone" />
              <Input label="Vehicle Assigned" name="vehicleAssigned" />
              <SelectInput label="Status" name="status" options={["Available", "On Delivery", "Off Duty", "Inactive"]} />
              <button className="primary-button">Save Driver</button>
            </form>
          </section>
          <section className="app-card p-5">
            <h3 className="text-lg font-black text-slate-950">Add Vehicle</h3>
            <form className="mt-4 grid gap-3" onSubmit={onVehicleSubmit}>
              <CompanySelect user={user} />
              <Input label="Plate Number" name="plateNumber" />
              <Input label="Vehicle Type" name="vehicleType" />
              <Input label="Driver" name="driver" />
              <SelectInput label="Status" name="status" options={["Available", "On Route", "Maintenance", "Inactive"]} />
              <Input label="Fuel Notes" name="fuelNotes" />
              <button className="primary-button">Save Vehicle</button>
            </form>
          </section>
        </>
      ) : null}

      <section className="app-card p-5 xl:col-span-2">
        <h3 className="text-lg font-black text-slate-950">Drivers</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Driver</th>
                <th>Phone</th>
                <th>Vehicle</th>
                <th>Status</th>
                <th>Company</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => (
                <tr key={driver.id}>
                  <td className="font-black text-slate-950">{driver.name}</td>
                  <td>{driver.phone}</td>
                  <td>{driver.vehicleAssigned}</td>
                  <td><StatusBadge status={driver.status} /></td>
                  <td>{driver.companyName}</td>
                </tr>
              ))}
              {!drivers.length ? (
                <tr><td colSpan={5}>No drivers yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="app-card p-5 xl:col-span-2">
        <h3 className="text-lg font-black text-slate-950">Vehicles</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Plate Number</th>
                <th>Type</th>
                <th>Driver</th>
                <th>Status</th>
                <th>Fuel Notes</th>
                <th>Company</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td className="font-black text-slate-950">{vehicle.plateNumber}</td>
                  <td>{vehicle.vehicleType}</td>
                  <td>{vehicle.driver}</td>
                  <td><StatusBadge status={vehicle.status} /></td>
                  <td>{vehicle.fuelNotes}</td>
                  <td>{vehicle.companyName}</td>
                </tr>
              ))}
              {!vehicles.length ? (
                <tr><td colSpan={6}>No vehicles yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function DeliveryReports({ records }: { records: DeliveryRecord[]; onNoop: () => void }) {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [driver, setDriver] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState("");

  const rows = useMemo(() => {
    return getDeliveryReportRows(records, period).filter((record) => {
      if (driver && !record.driver.toLowerCase().includes(driver.toLowerCase())) return false;
      if (vehicle && !record.truck.toLowerCase().includes(vehicle.toLowerCase())) return false;
      if (company && record.companyId !== company) return false;
      if (status && record.status !== status) return false;
      return true;
    });
  }, [company, driver, period, records, status, vehicle]);
  const failedRows = rows.filter((record) => record.status === "Failed Delivery");

  return (
    <div className="space-y-6">
      <section className="app-card p-5">
        <div className="grid gap-3 md:grid-cols-5">
          <SelectInput label="Period" name="period" onChange={(value) => setPeriod(value as "daily" | "weekly" | "monthly")} options={["daily", "weekly", "monthly"]} value={period} />
          <Input label="Driver" name="driver" onChange={setDriver} value={driver} />
          <Input label="Vehicle" name="vehicle" onChange={setVehicle} value={vehicle} />
          <CompanySelect onChange={setCompany} user={null} value={company} />
          <SelectInput label="Status" name="status" onChange={setStatus} options={["", ...deliveryStatuses]} value={status} />
        </div>
      </section>
      <DeliveryRecordsTable canConfirm={false} records={rows} />
      <section className="app-card p-5">
        <h3 className="text-lg font-black text-slate-950">Failed Delivery Report</h3>
        <div className="mt-4 grid gap-3">
          {failedRows.map((record) => (
            <article className="rounded-lg border border-red-200 bg-red-50 p-4" key={record.id}>
              <p className="font-black text-red-800">{record.clientName} - {record.id}</p>
              <p className="mt-1 text-sm font-semibold text-red-700">{record.failedReason || "No reason recorded"}</p>
            </article>
          ))}
          {!failedRows.length ? <p className="text-sm font-semibold text-slate-500">No failed deliveries for this report.</p> : null}
        </div>
      </section>
    </div>
  );
}

function DeliveryRecordsTable({
  canConfirm,
  canPrint = false,
  onStatusUpdate,
  onPrint,
  records,
  title = "Delivery Records"
}: {
  canConfirm: boolean;
  canPrint?: boolean;
  onStatusUpdate?: (event: FormEvent<HTMLFormElement>, record: DeliveryRecord) => void;
  onPrint?: (record: DeliveryRecord, copyMode: DispatchPassCopyMode, output: "print" | "pdf") => void;
  records: DeliveryRecord[];
  title?: string;
}) {
  return (
    <section className="app-card p-5">
      <h3 className="text-lg font-black text-slate-950">{title}</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Delivery ID</th>
              <th>Date</th>
              <th>Company</th>
              <th>Client</th>
              <th>Order</th>
              <th>Products</th>
              <th>Cartons</th>
              <th>Truck</th>
              <th>Driver</th>
              <th>Staff</th>
              <th>Location</th>
              <th>ETA</th>
              <th>Status</th>
              {canPrint ? <th>Gate Pass</th> : null}
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td className="font-black text-slate-950">{record.id}</td>
                <td>{record.date}</td>
                <td>{record.companyName}</td>
                <td>{record.clientName}</td>
                <td>{record.orderId}</td>
                <td className="min-w-56">{record.productSummary}</td>
                <td>{record.totalCartons}</td>
                <td>{record.truck}</td>
                <td>{record.driver}</td>
                <td>{record.deliveryStaff}</td>
                <td>{record.deliveryLocation}</td>
                <td>{record.etaStart} - {record.etaEnd}</td>
                <td><StatusBadge status={record.status} /></td>
                {canPrint ? (
                  <td>
                    <div className="flex min-w-64 flex-wrap gap-2">
                      <button className="secondary-button !px-3 !py-2" onClick={() => onPrint?.(record, "driver", "print")} type="button">Driver Copy</button>
                      <button className="secondary-button !px-3 !py-2" onClick={() => onPrint?.(record, "gate", "print")} type="button">Gate Copy</button>
                      <button className="primary-button !px-3 !py-2" onClick={() => onPrint?.(record, "both", "print")} type="button">Print Dispatch Pass</button>
                      <button className="secondary-button !px-3 !py-2" onClick={() => onPrint?.(record, "both", "pdf")} type="button">Download PDF</button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
            {!records.length ? (
              <tr><td colSpan={canPrint ? 14 : 13}>No delivery records yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {canConfirm && onStatusUpdate ? (
        <div className="mt-5 grid gap-4">
          {records.filter((record) => record.status !== "Delivered").map((record) => (
            <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-4" key={`confirm-${record.id}`} onSubmit={(event) => onStatusUpdate(event, record)}>
              <div className="md:col-span-4">
                <p className="font-black text-slate-950">Confirm / Update {record.id}</p>
                <p className="text-sm text-slate-500">{record.clientName} - {record.orderId}</p>
              </div>
              <SelectInput defaultValue={record.status} label="Status" name="status" options={deliveryStatuses} />
              <Input defaultValue={String(record.deliveredQuantity ?? record.totalCartons)} label="Delivered Quantity" name="deliveredQuantity" type="number" />
              <Input label="Client Received Name" name="clientReceivedName" />
              <Input label="Client Phone" name="clientReceivedPhone" />
              <SelectInput defaultValue={record.paymentStatus ?? "Unpaid"} label="Payment Status" name="paymentStatus" options={["Unpaid", "Partial", "Paid"]} />
              <Input label="Failed Reason" name="failedReason" />
              <Input label="Signature Placeholder" name="signature" />
              <Input label="Photo Upload Placeholder" name="photoPlaceholder" />
              <Input label="GPS Location Placeholder" name="gpsLocation" />
              <Input label="Notes" name="notes" />
              <button className="primary-button md:col-span-4">Save Delivery Update</button>
            </form>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status.includes("Failed") || status.includes("Inactive")
    ? "border-red-200 bg-red-50 text-red-700"
    : status.includes("Delivered") || status.includes("Available")
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status.includes("Out") || status.includes("Route")
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : "border-amber-200 bg-amber-50 text-amber-700";

  return <span className={`status-badge ${tone}`}>{status}</span>;
}

function PrintableDispatchGatePass({
  copyMode,
  record,
  user
}: {
  copyMode: DispatchPassCopyMode;
  record: DeliveryRecord;
  user: SessionUser;
}) {
  const copies =
    copyMode === "both"
      ? ["Driver Copy", "Gate Copy"]
      : [copyMode === "driver" ? "Driver Copy" : "Gate Copy"];

  return (
    <div className="hidden print:block">
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          body { background: white !important; }
          .dispatch-pass-page {
            page-break-after: always;
            color: #111827;
            font-family: Arial, sans-serif;
          }
          .dispatch-pass-page:last-child { page-break-after: auto; }
        }
      `}</style>
      {copies.map((copyLabel) => (
        <DispatchPassCopy copyLabel={copyLabel} key={copyLabel} record={record} user={user} />
      ))}
    </div>
  );
}

function DispatchPassCopy({
  copyLabel,
  record,
  user
}: {
  copyLabel: string;
  record: DeliveryRecord;
  user: SessionUser;
}) {
  const now = new Date();
  const productRows = parseProductSummary(record.productSummary);

  return (
    <section className="dispatch-pass-page mx-auto min-h-[267mm] max-w-[190mm] bg-white p-2 text-black">
      <div className="border-2 border-black p-5">
        <div className="flex items-start justify-between gap-4 border-b-2 border-black pb-4">
          <div className="flex items-center gap-3">
            <KingAppLogo size={54} />
            <div>
              <p className="text-sm font-bold uppercase">{record.companyName}</p>
              <h1 className="text-2xl font-black">KINGAPP DISPATCH GATE PASS</h1>
              <p className="text-xs font-bold uppercase">Sales & Stock Management</p>
            </div>
          </div>
          <div className="border-2 border-black px-4 py-2 text-center">
            <p className="text-xs font-bold uppercase">Copy</p>
            <p className="text-lg font-black">{copyLabel}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <PrintInfo label="Company Name" value={record.companyName} />
          <PrintInfo label="Dispatch Number" value={record.id} />
          <PrintInfo label="Date" value={record.date} />
          <PrintInfo label="Time" value={now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} />
          <PrintInfo label="Order ID" value={record.orderId} />
          <PrintInfo label="Status" value={record.status} />
          <PrintInfo label="Client Name" value={record.clientName} />
          <PrintInfo label="Client Phone" value={record.clientPhone ?? "Not recorded"} />
          <PrintInfo label="Delivery Location" value={record.deliveryLocation} />
          <PrintInfo label="Truck / Vehicle Plate" value={record.truck} />
          <PrintInfo label="Driver Name" value={record.driver} />
          <PrintInfo label="Driver Phone" value={record.driverPhone ?? "Not recorded"} />
          <PrintInfo label="Marketer / Salesperson" value={record.deliveryStaff} />
          <PrintInfo label="Expected Delivery Time" value={`${record.etaStart} - ${record.etaEnd}`} />
          <PrintInfo label="Prepared By" value={record.createdBy || user.displayName} />
          <PrintInfo label="Approved By" value="Manager / Storekeeper" />
        </div>

        <div className="mt-5">
          <p className="mb-2 text-sm font-black uppercase">Products Summary</p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-black px-2 py-2 text-left">Product</th>
                <th className="border border-black px-2 py-2 text-left">Quantity</th>
                <th className="border border-black px-2 py-2 text-left">Unit</th>
                <th className="border border-black px-2 py-2 text-left">Total Cartons</th>
              </tr>
            </thead>
            <tbody>
              {productRows.map((row, index) => (
                <tr key={`${row.product}-${index}`}>
                  <td className="border border-black px-2 py-2">{row.product}</td>
                  <td className="border border-black px-2 py-2">{row.quantity}</td>
                  <td className="border border-black px-2 py-2">Cartons</td>
                  <td className="border border-black px-2 py-2">{row.quantity}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="border border-black px-2 py-2 font-black" colSpan={3}>Total Cartons</td>
                <td className="border border-black px-2 py-2 font-black">{record.totalCartons}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-6 grid grid-cols-[1fr_130px] gap-6">
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 text-sm">
            <SignatureLine label="Gate Security Signature" />
            <SignatureLine label="Driver Signature" />
            <SignatureLine label="Marketer Signature" />
            <SignatureLine label="Approved By Signature" />
          </div>
          <div className="flex h-32 flex-col items-center justify-center border-2 border-black text-center text-xs font-black uppercase">
            <div className="mb-2 h-16 w-16 border border-black" />
            Scan to verify dispatch
          </div>
        </div>

        <p className="mt-6 border-t border-black pt-3 text-center text-xs font-bold">
          This gate pass is read-only and valid only for the dispatch number shown above.
        </p>
      </div>
    </section>
  );
}

function PrintInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[150px_1fr] border-b border-black/40 py-1">
      <span className="font-bold">{label}:</span>
      <span>{value || "Not recorded"}</span>
    </div>
  );
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div className="pt-8">
      <div className="border-t border-black pt-2 font-bold">{label}</div>
    </div>
  );
}

function parseProductSummary(summary: string) {
  const rows = summary
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(/^(\d+(?:\.\d+)?)\s*x\s*(.+)$/i);
      return {
        product: match?.[2]?.trim() || item,
        quantity: Number(match?.[1] ?? 0) || 0
      };
    });

  return rows.length ? rows : [{ product: summary || "Product", quantity: 0 }];
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
      <span className="mb-1 block text-xs font-bold uppercase tracking-normal text-slate-500">{label}</span>
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

function SelectInput({
  defaultValue,
  label,
  name,
  onChange,
  options,
  value
}: {
  defaultValue?: string;
  label: string;
  name: string;
  onChange?: (value: string) => void;
  options: string[];
  value?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-normal text-slate-500">{label}</span>
      <select
        className="form-input"
        defaultValue={value === undefined ? defaultValue : undefined}
        name={name}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        value={value}
      >
        {options.map((option) => (
          <option key={option || "all"} value={option}>
            {option || "All"}
          </option>
        ))}
      </select>
    </label>
  );
}

function Select({
  fallbackName,
  label,
  name,
  options,
  placeholder
}: {
  fallbackName: string;
  label: string;
  name: string;
  options: Array<{ label: string; value: string }>;
  placeholder: string;
}) {
  if (!options.length) {
    return <Input label={label} name={fallbackName} />;
  }

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-normal text-slate-500">{label}</span>
      <select className="form-input" name={name}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CompanySelect({
  onChange,
  user,
  value
}: {
  onChange?: (value: string) => void;
  user: SessionUser | null;
  value?: string;
}) {
  const companies = getCompanies();
  const defaultCompanyId = user ? getCompanyWorkspaceId(user) : "";
  const selectableCompanies = user && user.role !== "admin" && defaultCompanyId !== "all"
    ? companies.filter((company) => company.id === defaultCompanyId)
    : companies;

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-normal text-slate-500">Company</span>
      <select
        className="form-input"
        defaultValue={value === undefined ? defaultCompanyId : undefined}
        name="companyId"
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        value={value}
      >
        {onChange ? <option value="">All Companies</option> : null}
        {selectableCompanies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </select>
    </label>
  );
}
