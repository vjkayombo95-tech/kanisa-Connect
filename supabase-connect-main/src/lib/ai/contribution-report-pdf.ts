import type { jsPDF } from "jspdf";
import type { ContributionSummarySnapshot } from "./contribution-report";

export type ChurchReportBranding = { name: string; logoUrl?: string | null; address?: string | null };

const PAGE = { width: 595.28, height: 841.89, left: 42, right: 42, footerTop: 792 };
const GREEN: [number, number, number] = [24, 78, 61];
const GOLD: [number, number, number] = [180, 137, 48];
const INK: [number, number, number] = [31, 41, 55];
const MUTED: [number, number, number] = [75, 85, 99];
const BORDER: [number, number, number] = [190, 196, 204];

export const formatTzs = (value: number) => `TZS ${Math.round(value).toLocaleString("en-US")}`;
export const formatPercent = (value: number) => `${value.toFixed(1)}%`;

function parseDate(key: string) { return new Date(`${key}T12:00:00`); }
function humanDate(key: string) { return parseDate(key).toLocaleDateString("en-TZ", { day: "numeric", month: "long", year: "numeric" }); }
function humanMonth(key: string) { return parseDate(`${key}-01`).toLocaleDateString("en-TZ", { month: "long", year: "numeric" }); }
export function humanPeriod(snapshot: ContributionSummarySnapshot) { return `${humanDate(snapshot.startDate)} – ${humanDate(snapshot.endDate)}`; }

async function loadLogoDataUrl(url?: string | null) {
  if (!url || !/^https:\/\//i.test(url)) return null;
  try {
    const response = await fetch(url, { credentials: "omit" });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!/^image\/(png|jpe?g)$/i.test(blob.type)) return null;
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

function drawFallbackMark(doc: jsPDF, x: number, y: number) {
  doc.setDrawColor(...GREEN); doc.setLineWidth(1.4); doc.circle(x + 23, y + 23, 22);
  doc.setDrawColor(...GOLD); doc.line(x + 23, y + 10, x + 23, y + 35); doc.line(x + 14, y + 19, x + 32, y + 19);
}

function drawHeader(doc: jsPDF, branding: ChurchReportBranding, logo: string | null, compact = false) {
  const top = compact ? 27 : 34;
  if (logo) {
    try { doc.addImage(logo, logo.includes("image/png") ? "PNG" : "JPEG", PAGE.left, top, 46, 46, undefined, "FAST"); }
    catch { drawFallbackMark(doc, PAGE.left, top); }
  } else drawFallbackMark(doc, PAGE.left, top);
  doc.setTextColor(...GREEN); doc.setFont("helvetica", "bold"); doc.setFontSize(compact ? 13 : 18);
  const nameLines = doc.splitTextToSize(branding.name, 395).slice(0, 2);
  doc.text(nameLines, 104, top + 15);
  if (!compact) {
    doc.setTextColor(...INK); doc.setFontSize(14); doc.text("CONTRIBUTION REPORT", 104, top + 45);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...MUTED); doc.text("Financial Summary", 104, top + 59);
    if (branding.address) doc.text(doc.splitTextToSize(branding.address, 250)[0], 104, top + 73);
  } else { doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTED); doc.text("Contribution Report — continued", 104, top + 31); }
  doc.setDrawColor(...GOLD); doc.setLineWidth(2); doc.line(PAGE.left, compact ? 88 : 125, PAGE.width - PAGE.right, compact ? 88 : 125);
}

function metricCard(doc: jsPDF, x: number, y: number, width: number, label: string, value: string, detail?: string) {
  doc.setDrawColor(...BORDER); doc.setLineWidth(.7); doc.roundedRect(x, y, width, 70, 5, 5);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...MUTED); doc.text(label.toUpperCase(), x + 11, y + 17);
  doc.setTextColor(...GREEN); doc.setFontSize(value.length > 16 ? 12 : 15); doc.text(value, x + 11, y + 42);
  if (detail) { doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTED); doc.text(detail, x + 11, y + 58); }
}

function ensureSpace(doc: jsPDF, y: number, needed: number, branding: ChurchReportBranding, logo: string | null) {
  if (y + needed <= PAGE.footerTop - 22) return y;
  doc.addPage(); drawHeader(doc, branding, logo, true); return 108;
}

function sectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...INK); doc.text(title, PAGE.left, y);
  doc.setDrawColor(...GOLD); doc.setLineWidth(1); doc.line(PAGE.left, y + 7, PAGE.left + 34, y + 7);
}

function drawCategoryBreakdown(doc: jsPDF, snapshot: ContributionSummarySnapshot, startY: number, branding: ChurchReportBranding, logo: string | null) {
  let y = ensureSpace(doc, startY, 65, branding, logo); sectionTitle(doc, "Contribution by Category", y); y += 25;
  const amountX = 420; const shareX = 522;
  doc.setFillColor(238, 242, 240); doc.rect(PAGE.left, y, PAGE.width - PAGE.left - PAGE.right, 24, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...INK); doc.text("CATEGORY", PAGE.left + 8, y + 16); doc.text("AMOUNT (TZS)", amountX, y + 16, { align: "right" }); doc.text("SHARE", shareX, y + 16, { align: "right" }); y += 24;
  const max = Math.max(...snapshot.categories.map((item) => item.total), 1);
  snapshot.categories.forEach((item) => {
    y = ensureSpace(doc, y, 39, branding, logo);
    const share = snapshot.total > 0 ? item.total / snapshot.total * 100 : 0;
    doc.setDrawColor(...BORDER); doc.line(PAGE.left, y + 37, PAGE.width - PAGE.right, y + 37);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...INK);
    const category = doc.splitTextToSize(item.name || "Uncategorized", 235)[0]; doc.text(category, PAGE.left + 8, y + 14);
    doc.text(formatTzs(item.total).replace("TZS ", ""), amountX, y + 14, { align: "right" }); doc.text(formatPercent(share), shareX, y + 14, { align: "right" });
    doc.setFillColor(225, 230, 228); doc.roundedRect(PAGE.left + 8, y + 22, 230, 6, 2, 2, "F"); doc.setFillColor(...GREEN); doc.roundedRect(PAGE.left + 8, y + 22, Math.max(2, 230 * item.total / max), 6, 2, 2, "F"); y += 39;
  });
  y = ensureSpace(doc, y, 28, branding, logo); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("TOTAL", PAGE.left + 8, y + 17); doc.text(formatTzs(snapshot.total).replace("TZS ", ""), amountX, y + 17, { align: "right" }); doc.text(snapshot.total > 0 ? "100.0%" : "0.0%", shareX, y + 17, { align: "right" });
  return y + 42;
}

function drawMonthlyTrend(doc: jsPDF, snapshot: ContributionSummarySnapshot, startY: number, branding: ChurchReportBranding, logo: string | null) {
  if (!snapshot.monthly.length) return startY;
  let y = ensureSpace(doc, startY, 65, branding, logo); sectionTitle(doc, "Monthly Trend", y); y += 27;
  const max = Math.max(...snapshot.monthly.map((item) => item.total), 1);
  for (const item of snapshot.monthly) {
    y = ensureSpace(doc, y, 45, branding, logo); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...INK); doc.text(humanMonth(item.month), PAGE.left + 8, y + 10);
    doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTED); doc.text(`${formatTzs(item.total)} · ${item.count} payment${item.count === 1 ? "" : "s"}`, PAGE.width - PAGE.right, y + 10, { align: "right" });
    doc.setFillColor(225, 230, 228); doc.roundedRect(PAGE.left + 8, y + 21, 470, 9, 3, 3, "F"); doc.setFillColor(...GREEN); doc.roundedRect(PAGE.left + 8, y + 21, Math.max(3, 470 * item.total / max), 9, 3, 3, "F"); y += 43;
  }
  const previous = snapshot.monthly.at(-2); const latest = snapshot.monthly.at(-1);
  y = ensureSpace(doc, y + 4, 55, branding, logo); sectionTitle(doc, "Trend Summary", y); y += 23; doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...INK);
  if (previous && latest && previous.total > 0) {
    const change = (latest.total - previous.total) / previous.total * 100;
    doc.text(`Contributions ${change >= 0 ? "increased" : "decreased"} by ${formatPercent(Math.abs(change))} from ${humanMonth(previous.month)} to ${humanMonth(latest.month)}.`, PAGE.left + 8, y);
  } else doc.text("A month-to-month comparison is unavailable because the previous period has no recorded contribution total.", PAGE.left + 8, y);
  return y + 30;
}

function drawFooters(doc: jsPDF, snapshot: ContributionSummarySnapshot) {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page); doc.setDrawColor(...BORDER); doc.setLineWidth(.5); doc.line(PAGE.left, PAGE.footerTop, PAGE.width - PAGE.right, PAGE.footerTop);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text(`Generated ${new Date(snapshot.generatedAt).toLocaleString("en-TZ")} · ${humanPeriod(snapshot)}`, PAGE.left, PAGE.footerTop + 15);
    doc.text("Generated securely through Kanisa Connect", PAGE.left, PAGE.footerTop + 29);
    doc.text(`Page ${page} of ${pages}`, PAGE.width - PAGE.right, PAGE.footerTop + 29, { align: "right" });
  }
}

export async function renderContributionReportPdf(doc: jsPDF, snapshot: ContributionSummarySnapshot, branding: ChurchReportBranding) {
  const safeBranding = { ...branding, name: branding.name.trim() || "Church" };
  const logo = await loadLogoDataUrl(safeBranding.logoUrl);
  drawHeader(doc, safeBranding, logo);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...MUTED); doc.text("REPORTING PERIOD", PAGE.left, 151);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(...INK); doc.text(snapshot.periodLabel, PAGE.left, 169); doc.setFontSize(9); doc.text(humanPeriod(snapshot), PAGE.left, 186);
  const activeMonths = Math.max(1, snapshot.monthly.length); const average = snapshot.total / activeMonths; const highest = snapshot.monthly.reduce((best, item) => item.total > (best?.total ?? -1) ? item : best, snapshot.monthly[0]);
  const cardWidth = 120; const cardY = 210;
  metricCard(doc, PAGE.left, cardY, cardWidth, "Total Contributions", formatTzs(snapshot.total));
  metricCard(doc, PAGE.left + 130, cardY, cardWidth, "Recorded Payments", String(snapshot.paymentCount), `${snapshot.paymentCount} payment${snapshot.paymentCount === 1 ? "" : "s"}`);
  metricCard(doc, PAGE.left + 260, cardY, cardWidth, "Average Per Month", formatTzs(average));
  metricCard(doc, PAGE.left + 390, cardY, cardWidth, "Highest Month", highest ? formatTzs(highest.total) : formatTzs(0), highest ? humanMonth(highest.month) : undefined);
  let y = drawCategoryBreakdown(doc, snapshot, 310, safeBranding, logo);
  y = drawMonthlyTrend(doc, snapshot, y, safeBranding, logo);
  y = ensureSpace(doc, y + 4, 42, safeBranding, logo); doc.setDrawColor(...GOLD); doc.roundedRect(PAGE.left, y, PAGE.width - PAGE.left - PAGE.right, 36, 4, 4); doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(...INK); doc.text("Thank you for your generosity. Your contributions support the mission and activities of the church.", PAGE.width / 2, y + 22, { align: "center" });
  drawFooters(doc, snapshot);
}
