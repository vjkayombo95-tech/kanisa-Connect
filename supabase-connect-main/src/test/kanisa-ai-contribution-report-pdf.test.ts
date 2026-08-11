import { beforeEach, describe, expect, it, vi } from "vitest";
import type { jsPDF } from "jspdf";
import { formatPercent, formatTzs, humanPeriod, renderContributionReportPdf } from "@/lib/ai/contribution-report-pdf";
import type { ContributionSummarySnapshot } from "@/lib/ai/contribution-report";

class RecordingPdf {
  texts: string[] = [];
  pages = 1;
  currentPage = 1;
  setFont() { return this; } setFontSize() { return this; } setTextColor() { return this; }
  setDrawColor() { return this; } setFillColor() { return this; } setLineWidth() { return this; }
  circle() { return this; } line() { return this; } rect() { return this; } roundedRect() { return this; } addImage() { return this; }
  text(value: string | string[]) { this.texts.push(...(Array.isArray(value) ? value : [value])); return this; }
  splitTextToSize(value: string, width: number) { const length = Math.max(12, Math.floor(width / 5)); return value.match(new RegExp(`.{1,${length}}`, "g")) ?? [value]; }
  addPage() { this.pages += 1; this.currentPage = this.pages; return this; }
  getNumberOfPages() { return this.pages; }
  setPage(page: number) { this.currentPage = page; return this; }
}

const snapshot = (overrides: Partial<ContributionSummarySnapshot> = {}): ContributionSummarySnapshot => ({
  churchId: "church-1", startDate: "2026-06-01", endDate: "2026-08-31", periodLabel: "Last 3 months", total: 65000, paymentCount: 6,
  comparisonTotal: null, percentageChange: null,
  categories: [{ name: "Donations", total: 25000 }, { name: "Uncategorized", total: 20000 }, { name: "Tithe", total: 10000 }, { name: "Offering", total: 10000 }],
  monthly: [{ month: "2026-06", total: 0, count: 0 }, { month: "2026-07", total: 30000, count: 4 }, { month: "2026-08", total: 35000, count: 2 }],
  generatedAt: "2026-08-11T07:15:00.000Z", ...overrides,
});

async function render(value = snapshot(), name = "St. Theresa Parish", logoUrl: string | null = null) {
  const doc = new RecordingPdf();
  await renderContributionReportPdf(doc as unknown as jsPDF, value, { name, logoUrl, address: "Dar es Salaam" });
  return doc;
}

describe("professional church-branded contribution PDF", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("makes the actual church name primary and keeps Kanisa Connect in the footer", async () => {
    const doc = await render();
    expect(doc.texts[0]).toBe("St. Theresa Parish");
    expect(doc.texts).toContain("CONTRIBUTION REPORT");
    expect(doc.texts).not.toContain("KANISA CONNECT");
    expect(doc.texts).toContain("Generated securely through Kanisa Connect");
  });

  it("formats the human reporting period and Tanzania currency", async () => {
    const value = snapshot(); const doc = await render(value);
    expect(humanPeriod(value)).toBe("1 June 2026 – 31 August 2026");
    expect(formatTzs(value.total)).toBe("TZS 65,000");
    expect(doc.texts).toContain("1 June 2026 – 31 August 2026");
    expect(doc.texts).toContain("TZS 65,000");
    expect(doc.texts).toContain("6");
  });

  it("renders average, category amounts, percentages, and uncategorized values", async () => {
    const doc = await render();
    expect(doc.texts).toContain("TZS 21,667");
    expect(doc.texts).toContain("Uncategorized");
    expect(doc.texts).toContain("25,000");
    expect(doc.texts).toContain("38.5%");
    expect(doc.texts).toContain("100.0%");
  });

  it("renders monthly values and positive trend insight", async () => {
    const doc = await render();
    expect(doc.texts).toContain("July 2026"); expect(doc.texts).toContain("TZS 30,000 · 4 payments");
    expect(doc.texts.some((text) => text.includes("increased by 16.7%"))).toBe(true);
  });

  it("renders a negative trend accurately", async () => {
    const doc = await render(snapshot({ monthly: [{ month: "2026-07", total: 40000, count: 4 }, { month: "2026-08", total: 30000, count: 2 }], total: 70000 }));
    expect(doc.texts.some((text) => text.includes("decreased by 25.0%"))).toBe(true);
  });

  it("does not manufacture a trend when the previous month is zero", async () => {
    const doc = await render(snapshot({ monthly: [{ month: "2026-07", total: 0, count: 0 }, { month: "2026-08", total: 35000, count: 2 }], total: 35000 }));
    expect(doc.texts.some((text) => text.includes("comparison is unavailable"))).toBe(true);
  });

  it("falls back safely when a logo cannot be loaded", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("expired")));
    const doc = await render(snapshot(), "A Very Long Church and Community Ministry Name Serving the Whole Region", "https://example.com/expired.png");
    expect(doc.texts.join(" ")).toContain("A Very Long Church and Community Ministry Name");
    expect(doc.texts).toContain("CONTRIBUTION REPORT");
  });

  it("paginates many and long categories and numbers every page", async () => {
    const categories = Array.from({ length: 18 }, (_, index) => ({ name: `Long contribution category number ${index + 1} for parish activities`, total: 1000 + index }));
    const total = categories.reduce((sum, item) => sum + item.total, 0);
    const doc = await render(snapshot({ categories, total }));
    expect(doc.pages).toBeGreaterThan(1);
    expect(doc.texts).toContain(`Page 1 of ${doc.pages}`);
    expect(doc.texts).toContain(`Page ${doc.pages} of ${doc.pages}`);
  });

  it("keeps percentage and count formatting exact", () => {
    expect(formatPercent(16.666)).toBe("16.7%"); expect(formatTzs(1_250_000)).toBe("TZS 1,250,000");
  });
});
