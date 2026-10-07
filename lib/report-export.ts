import type { FactoryReport, ReportCell, ReportSection } from "@/lib/factory-report";

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function reportFileName(report: FactoryReport, extension: string) {
  const clean = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const period = report.from === report.to ? report.from : `${report.from}-to-${report.to}`;

  return `${clean(report.companyName) || "factory"}-factory-report-${period}.${extension}`;
}

// ---------- Excel ----------

function sheetName(title: string) {
  // Excel sheet names: at most 31 characters, none of \ / ? * [ ] :
  return title.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
}

function sectionSheet(section: ReportSection) {
  const header = section.columns.map((label) => ({ value: label, fontWeight: "bold" as const }));
  const totals = section.totals
    ? [section.totals.map((value) => (value === "" ? null : { value, fontWeight: "bold" as const }))]
    : [];
  const body = section.rows.map((row) => row.map((value) => (value === "" ? null : value)));
  const widths = section.columns.map((label, index) => {
    const longest = Math.max(label.length, ...section.rows.map((row) => String(row[index] ?? "").length));
    return { width: Math.min(Math.max(longest + 2, 10), 40) };
  });

  return {
    data: [header, ...body, ...totals],
    sheet: sheetName(section.title),
    columns: widths,
    stickyRowsCount: 1
  };
}

export async function downloadReportExcel(report: FactoryReport) {
  // Loaded only when a download is asked for, so pages stay light on mobile data.
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const summary = {
    data: [
      [{ value: report.title, fontWeight: "bold" as const }],
      ["Company", report.companyName],
      ["Period", report.periodLabel],
      ["From", report.from],
      ["To", report.to],
      [null],
      ...report.summary.map((item) => [item.label, item.value])
    ],
    sheet: "Summary",
    columns: [{ width: 24 }, { width: 28 }]
  };
  const sheets = [
    summary,
    ...[...report.sections, ...report.detailSheets].filter((section) => section.rows.length > 0).map(sectionSheet)
  ];
  const blob = await writeXlsxFile(sheets).toBlob();

  download(blob, reportFileName(report, "xlsx"));
}

// ---------- Picture ----------

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
const PAD = 24;
const ROW = 34;
const CELL_PAD = 12;
const MAX_COLUMN = 260;

function cellText(value: ReportCell) {
  return typeof value === "number" ? value.toLocaleString() : value;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, width: number) {
  if (ctx.measureText(text).width <= width) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
  return `${cut}…`;
}

function measureSection(ctx: CanvasRenderingContext2D, section: ReportSection) {
  const lines = [section.columns, ...section.rows.map((row) => row.map(cellText)), ...(section.totals ? [section.totals.map(cellText)] : [])];

  return section.columns.map((_, index) => {
    ctx.font = `600 14px ${FONT}`;
    const widest = Math.max(...lines.map((line) => ctx.measureText(String(line[index] ?? "")).width));
    return Math.min(Math.ceil(widest) + CELL_PAD * 2, MAX_COLUMN);
  });
}

// Draws the report as a picture, so it can be sent on WhatsApp as it is.
export async function downloadReportPicture(report: FactoryReport) {
  const sections = report.sections.filter((section) => section.rows.length > 0);
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) throw new Error("This browser cannot draw pictures.");

  const widths = sections.map((section) => measureSection(probe, section));
  const tilesWidth = report.summary.length * 190;
  const width = Math.max(720, tilesWidth, ...widths.map((columns) => columns.reduce((total, value) => total + value, 0))) + PAD * 2;
  const headerHeight = 96;
  const tilesHeight = 84;
  const sectionHeights = sections.map(
    (section) => 44 + (section.note ? 22 : 0) + ROW * (1 + section.rows.length + (section.totals ? 1 : 0)) + 28
  );
  const height = headerHeight + tilesHeight + sectionHeights.reduce((total, value) => total + value, 0) + PAD;

  // Phones refuse very large canvases, so the sharpness drops before the picture fails.
  const scale = Math.max(1, Math.min(2, Math.sqrt(12_000_000 / (width * height))));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw pictures.");
  ctx.scale(scale, scale);
  ctx.textBaseline = "middle";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#0f6b44";
  ctx.fillRect(0, 0, width, 6);

  ctx.fillStyle = "#0f172a";
  ctx.font = `800 26px ${FONT}`;
  ctx.fillText(`${report.companyName} — ${report.title}`, PAD, 42);
  ctx.fillStyle = "#475569";
  ctx.font = `600 15px ${FONT}`;
  ctx.fillText(report.periodLabel, PAD, 72);

  let y = headerHeight;
  const tileWidth = (width - PAD * 2 - 12 * (report.summary.length - 1)) / report.summary.length;
  report.summary.forEach((item, index) => {
    const x = PAD + index * (tileWidth + 12);
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(x, y, tileWidth, 64);
    ctx.fillStyle = "#64748b";
    ctx.font = `700 11px ${FONT}`;
    ctx.fillText(item.label.toUpperCase(), x + 12, y + 20);
    ctx.fillStyle = "#0f172a";
    ctx.font = `800 19px ${FONT}`;
    ctx.fillText(fitText(ctx, item.value, tileWidth - 24), x + 12, y + 44);
  });
  y += tilesHeight;

  sections.forEach((section, sectionIndex) => {
    const columns = widths[sectionIndex];
    const tableWidth = columns.reduce((total, value) => total + value, 0);

    ctx.fillStyle = "#0f172a";
    ctx.font = `800 17px ${FONT}`;
    ctx.fillText(section.title, PAD, y + 22);
    y += 44;

    if (section.note) {
      ctx.fillStyle = "#64748b";
      ctx.font = `500 12px ${FONT}`;
      ctx.fillText(fitText(ctx, section.note, width - PAD * 2), PAD, y - 4);
      y += 22;
    }

    const drawRow = (cells: ReportCell[], style: "header" | "body" | "total", striped: boolean) => {
      ctx.fillStyle = style === "header" ? "#e2e8f0" : style === "total" ? "#ecfdf5" : striped ? "#f8fafc" : "#ffffff";
      ctx.fillRect(PAD, y, tableWidth, ROW);
      ctx.font = `${style === "body" ? 500 : 700} ${style === "header" ? 12 : 14}px ${FONT}`;
      ctx.fillStyle = style === "header" ? "#334155" : "#0f172a";

      let x = PAD;
      cells.forEach((cell, index) => {
        const text = fitText(ctx, cellText(cell), columns[index] - CELL_PAD * 2);
        const isNumber = typeof cell === "number" || (style === "header" && index > 0 && typeof section.rows[0]?.[index] === "number");
        ctx.textAlign = isNumber ? "right" : "left";
        ctx.fillText(text, isNumber ? x + columns[index] - CELL_PAD : x + CELL_PAD, y + ROW / 2);
        x += columns[index];
      });
      ctx.textAlign = "left";
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, y + ROW + 0.5);
      ctx.lineTo(PAD + tableWidth, y + ROW + 0.5);
      ctx.stroke();
      y += ROW;
    };

    drawRow(section.columns, "header", false);
    section.rows.forEach((row, index) => drawRow(row, "body", index % 2 === 1));
    if (section.totals) drawRow(section.totals, "total", false);
    y += 28;
  });

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The picture could not be created.");

  download(blob, reportFileName(report, "png"));
}
