"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Boxes } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getLoadingRecords } from "@/lib/loading-data";
import type { LoadingRecord } from "@/lib/loading-data";
import { getReturnRecords } from "@/lib/returns-data";
import type { ReturnRecord } from "@/lib/returns-data";
import {
  getInventoryMovements,
  getInventoryRows,
  getInventorySummary,
  getMinimumStocks
} from "@/lib/inventory-data";
import type { InventoryMovement, MinimumStock } from "@/lib/inventory-data";

export default function ReportsPage() {
  return (
    <AppShell allowedRoles={["admin", "supervisor", "manager"]}>
      {() => <ReportsContent />}
    </AppShell>
  );
}

function ReportsContent() {
  const [loadingRecords, setLoadingRecords] = useState<LoadingRecord[]>([]);
  const [returnRecords, setReturnRecords] = useState<ReturnRecord[]>([]);
  const [inventoryMovements, setInventoryMovements] = useState<
    InventoryMovement[]
  >([]);
  const [minimumStocks, setMinimumStocks] = useState<MinimumStock[]>([]);

  useEffect(() => {
    setLoadingRecords(getLoadingRecords());
    setReturnRecords(getReturnRecords());
    setInventoryMovements(getInventoryMovements());
    setMinimumStocks(getMinimumStocks());
  }, []);

  const inventorySummary = useMemo(
    () =>
      getInventorySummary(
        getInventoryRows({
          loadingRecords,
          manualMovements: inventoryMovements,
          minimumStocks,
          returnRecords
        })
      ),
    [inventoryMovements, loadingRecords, minimumStocks, returnRecords]
  );

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-950">Reports</h2>
            <p className="mt-1 text-sm text-slate-600">
              Management summaries across stock, sales, cash, and inventory.
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Boxes className="h-5 w-5 text-brand-700" />
          <h3 className="text-lg font-bold text-slate-950">
            Inventory Summary
          </h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <ReportMetric label="Opening Stock" value={inventorySummary.openingStock} />
          <ReportMetric label="Received Stock" value={inventorySummary.receivedStock} />
          <ReportMetric label="Loaded Out" value={inventorySummary.loadedOut} />
          <ReportMetric
            label="Returns Received"
            value={inventorySummary.actualReturns}
          />
          <ReportMetric label="Closing Stock" value={inventorySummary.closingStock} />
        </div>
      </section>
    </div>
  );
}

function ReportMetric({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-lg bg-brand-50 px-4 py-3">
      <p className="text-sm font-semibold text-brand-800">{label}</p>
      <p className="mt-2 text-2xl font-bold text-brand-900">
        {value.toLocaleString()}
      </p>
    </article>
  );
}
