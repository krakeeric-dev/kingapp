"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, FileSpreadsheet, ImageDown, Printer } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { SessionUser } from "@/lib/auth";
import { getCompanies, getCompanyWorkspaceId, type Company } from "@/lib/companies-data";
import { buildFactoryReport, monthRange, type FactoryReport, type ReportCell, type ReportSection } from "@/lib/factory-report";
import { getInventoryMovements } from "@/lib/inventory-data";
import { formatDate, getLoadingRecords } from "@/lib/loading-data";
import { getProductionRecords, getUtilityRecords } from "@/lib/production-data";
import { getProductsForCompany } from "@/lib/products-data";
import { getRawMaterialMovements, getRawMaterialsForCompany } from "@/lib/raw-materials-data";
import { downloadReportExcel, downloadReportPicture } from "@/lib/report-export";
import { getReturnRecords } from "@/lib/returns-data";

type Period = "day" | "month";

const today = () => new Date().toISOString().slice(0, 10);
const show = (value: ReportCell) => (typeof value === "number" ? value.toLocaleString() : value);

export default function FactoryReportPage() {
  return <AppShell>{(user) => <FactoryReportContent user={user} />}</AppShell>;
}

function FactoryReportContent({ user }: { user: SessionUser }) {
  const workspaceCompanyId = getCompanyWorkspaceId(user);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [period, setPeriod] = useState<Period>("month");
  const [day, setDay] = useState(today());
  const [month, setMonth] = useState(today().slice(0, 7));
  const [dataVersion, setDataVersion] = useState(0);
  const [busy, setBusy] = useState<"" | "excel" | "picture">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const companyList = getCompanies();
    setCompanies(companyList);
    setCompanyId(workspaceCompanyId && workspaceCompanyId !== "all" ? workspaceCompanyId : companyList[0]?.id ?? "");

    const refresh = () => setDataVersion((version) => version + 1);
    window.addEventListener("kingapp:data-synced", refresh);
    return () => window.removeEventListener("kingapp:data-synced", refresh);
  }, [workspaceCompanyId]);

  const report = useMemo<FactoryReport | null>(() => {
    if (!companyId) return null;

    const range = period === "day" ? { from: day, to: day } : monthRange(month);
    if (!range.from || !range.to || range.from.includes("NaN")) return null;

    const periodLabel =
      period === "day"
        ? formatDate(day)
        : new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(`${month}-01T00:00:00`));

    return buildFactoryReport({
      companyId,
      companyName: companies.find((company) => company.id === companyId)?.name ?? "Factory",
      from: range.from,
      to: range.to,
      periodLabel,
      products: getProductsForCompany(companyId),
      materials: getRawMaterialsForCompany(companyId),
      rawMovements: getRawMaterialMovements(),
      inventoryMovements: getInventoryMovements(),
      loadingRecords: getLoadingRecords(),
      returnRecords: getReturnRecords(),
      productionRecords: getProductionRecords(),
      utilityRecords: getUtilityRecords()
    });
    // dataVersion is listed so the saved records are read again after a sync.
  }, [companies, companyId, day, month, period, dataVersion]);

  async function run(kind: "excel" | "picture") {
    if (!report) return;
    setBusy(kind);
    setMessage("");
    setError("");

    try {
      if (kind === "excel") {
        await downloadReportExcel(report);
      } else {
        await downloadReportPicture(report);
      }
      setMessage(`Saved. The ${kind === "excel" ? "Excel file" : "picture"} is in your downloads.`);
    } catch (problem) {
      console.warn(problem);
      setError(`The ${kind === "excel" ? "Excel file" : "picture"} could not be created. Try again.`);
    } finally {
      setBusy("");
    }
  }

  const canPickCompany = workspaceCompanyId === "all" && companies.length > 1;

  return (
    <div className="space-y-5">
      <section className="no-print rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-950">Factory Report</h2>
            <p className="mt-1 text-sm text-slate-600">
              Production, finished stock and raw materials for a day or a month. Opening stock carries over from the period before.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {canPickCompany ? (
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Company</span>
              <select className="form-input" onChange={(event) => setCompanyId(event.target.value)} value={companyId}>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Report for</span>
            <select className="form-input" onChange={(event) => setPeriod(event.target.value as Period)} value={period}>
              <option value="month">A month</option>
              <option value="day">One day</option>
            </select>
          </label>
          {period === "month" ? (
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Month</span>
              <input className="form-input" onChange={(event) => setMonth(event.target.value)} type="month" value={month} />
            </label>
          ) : (
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Date</span>
              <input className="form-input" onChange={(event) => setDay(event.target.value)} type="date" value={day} />
            </label>
          )}
        </div>

        {report ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button className="primary-button min-h-11" disabled={busy !== ""} onClick={() => run("excel")} type="button">
              <FileSpreadsheet className="h-4 w-4" />
              {busy === "excel" ? "Preparing..." : "Download Excel"}
            </button>
            <button className="secondary-button min-h-11" disabled={busy !== ""} onClick={() => run("picture")} type="button">
              <ImageDown className="h-4 w-4" />
              {busy === "picture" ? "Preparing..." : "Download picture"}
            </button>
            <button className="secondary-button min-h-11" onClick={() => window.print()} type="button">
              <Printer className="h-4 w-4" />
              Print or save as PDF
            </button>
          </div>
        ) : null}
      </section>

      {message ? (
        <div className="no-print rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700" role="status">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="no-print rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">
          {error}
        </div>
      ) : null}

      {!companyId ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          No company has been created yet. An admin needs to add one under Companies first.
        </div>
      ) : null}

      {report ? (
        <>
          <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-slate-950">
              {report.companyName} — {report.periodLabel}
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {report.summary.map((item) => (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3" key={item.label}>
                  <p className="text-xs font-bold uppercase text-slate-500">{item.label}</p>
                  <p className="mt-1 text-lg font-black text-slate-950">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          {report.sections.map((section) => (
            <SectionCard key={section.title} section={section} />
          ))}
        </>
      ) : null}
    </div>
  );
}

function SectionCard({ section }: { section: ReportSection }) {
  const isNumberColumn = (index: number) => typeof section.rows[0]?.[index] === "number";

  return (
    <section className="rounded-lg border border-brand-100 bg-white shadow-sm">
      <div className="border-b border-brand-100 p-5">
        <h3 className="text-lg font-bold text-slate-950">{section.title}</h3>
        {section.note ? <p className="mt-1 text-sm text-slate-600">{section.note}</p> : null}
      </div>

      {section.rows.length === 0 ? (
        <div className="p-8 text-center text-sm font-semibold text-slate-500">{section.emptyText}</div>
      ) : (
        <>
          {/* Phone: one card per row, so nothing scrolls sideways. */}
          <ul className="divide-y divide-slate-100 md:hidden print:hidden">
            {[...section.rows, ...(section.totals ? [section.totals] : [])].map((row, rowIndex) => {
              const isTotal = Boolean(section.totals) && rowIndex === section.rows.length;

              return (
                <li className={`p-4 ${isTotal ? "bg-brand-50" : ""}`} key={`${row[0]}-${rowIndex}`}>
                  <p className="font-bold text-slate-950">{show(row[0])}</p>
                  <dl className="mt-2 space-y-1 text-sm">
                    {row.slice(1).map((value, index) =>
                      value === "" || (section.hideZerosOnPhone && value === 0) ? null : (
                        <div className="flex justify-between gap-2" key={section.columns[index + 1]}>
                          <dt className="text-slate-500">{section.columns[index + 1]}</dt>
                          <dd className="font-semibold text-slate-950">{show(value)}</dd>
                        </div>
                      )
                    )}
                  </dl>
                </li>
              );
            })}
          </ul>

          <div className="hidden overflow-x-auto md:block print:block">
            <table className="data-table">
              <thead>
                <tr>
                  {section.columns.map((label, index) => (
                    <th className={isNumberColumn(index) ? "text-right" : ""} key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row, rowIndex) => (
                  <tr key={`${row[0]}-${rowIndex}`}>
                    {row.map((value, index) => (
                      <td className={`${typeof value === "number" ? "text-right tabular-nums" : ""} ${index === 0 ? "font-bold text-slate-950" : ""}`} key={index}>
                        {show(value)}
                      </td>
                    ))}
                  </tr>
                ))}
                {section.totals ? (
                  <tr className="bg-brand-50 font-black">
                    {section.totals.map((value, index) => (
                      <td className={typeof value === "number" ? "text-right tabular-nums" : ""} key={index}>
                        {show(value)}
                      </td>
                    ))}
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
