import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/i18n";
import { formatTZS } from "@/lib/currency";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ data, children }: { data: Array<{ month: string; amount: number }>; children: React.ReactNode }) => (
    <div data-testid="bar-chart">
      {data.map((item) => (
        <span key={item.month}>{item.month}:{item.amount}</span>
      ))}
      {children}
    </div>
  ),
  Bar: () => <span data-testid="bar" />,
  XAxis: () => <span data-testid="x-axis" />,
  YAxis: () => <span data-testid="y-axis" />,
  Tooltip: () => <span data-testid="tooltip" />,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ data, children }: { data: Array<{ name: string; value: number }>; children: React.ReactNode }) => (
    <div data-testid="pie">
      {data.map((item) => (
        <span key={item.name}>{item.name}:{item.value}</span>
      ))}
      {children}
    </div>
  ),
  Cell: () => <span data-testid="cell" />,
}));

import PortalContributionCharts from "@/pages/portal/PortalContributionCharts";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("PortalContributionCharts localization", () => {
  let host: HTMLDivElement;
  let root: Root;

  const monthlyTrend = [
    { month: "Okt", amount: 12000 },
    { month: "Nov", amount: 34000 },
  ];
  const categoryBreakdown = [
    { name: "Sadaka Dynamic", value: 45000 },
    { name: "Jengo Dynamic", value: 15000 },
  ];

  const renderCharts = () => {
    act(() => {
      root.render(
        <PortalContributionCharts
          monthlyTrend={monthlyTrend}
          categoryBreakdown={categoryBreakdown}
          monthTotal={125000}
          lastMonthTotal={98000}
        />,
      );
    });
  };

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("renders English chart labels and preserves dynamic amounts and data", async () => {
    await changeAppLanguage("en");
    const originalMonthlyTrend = structuredClone(monthlyTrend);
    const originalCategoryBreakdown = structuredClone(categoryBreakdown);

    renderCharts();

    expect(host.textContent).toContain("Monthly Trend (6 months)");
    expect(host.textContent).toContain("Category Breakdown");
    expect(host.textContent).toContain("This Month");
    expect(host.textContent).toContain("Last Month");
    expect(host.textContent).toContain(formatTZS(125000));
    expect(host.textContent).toContain(formatTZS(98000));
    expect(host.textContent).toContain("Okt:12000");
    expect(host.textContent).toContain("Sadaka Dynamic:45000");
    expect(monthlyTrend).toEqual(originalMonthlyTrend);
    expect(categoryBreakdown).toEqual(originalCategoryBreakdown);
  });

  it("renders Kiswahili chart labels and still does not translate supplied chart data", async () => {
    await changeAppLanguage("sw");
    const originalMonthlyTrend = structuredClone(monthlyTrend);
    const originalCategoryBreakdown = structuredClone(categoryBreakdown);

    renderCharts();

    expect(host.textContent).toContain("Mwenendo wa Miezi 6");
    expect(host.textContent).toContain("Mgawanyo kwa Aina");
    expect(host.textContent).toContain("Mwezi Huu");
    expect(host.textContent).toContain("Mwezi Uliopita");
    expect(host.textContent).toContain(formatTZS(125000));
    expect(host.textContent).toContain(formatTZS(98000));
    expect(host.textContent).toContain("Okt:12000");
    expect(host.textContent).toContain("Sadaka Dynamic:45000");
    expect(monthlyTrend).toEqual(originalMonthlyTrend);
    expect(categoryBreakdown).toEqual(originalCategoryBreakdown);
  });

  it("uses dashboard localization keys without changing chart contracts", () => {
    const source = read("src/pages/portal/PortalContributionCharts.tsx");
    const en = JSON.parse(read("src/locales/en.json"));
    const sw = JSON.parse(read("src/locales/sw.json"));

    expect(en.member_dashboard.contributions.monthly_trend).toBe("Monthly Trend (6 months)");
    expect(sw.member_dashboard.contributions.monthly_trend).toBe("Mwenendo wa Miezi 6");
    expect(en.member_dashboard.contributions.category_breakdown).toBe("Category Breakdown");
    expect(sw.member_dashboard.contributions.category_breakdown).toBe("Mgawanyo kwa Aina");
    expect(en.member_dashboard.contributions.last_month).toBe("Last Month");
    expect(sw.member_dashboard.contributions.last_month).toBe("Mwezi Uliopita");
    expect(source).toContain('t("member_dashboard.summary.this_month")');
    expect(source).toContain("<BarChart data={monthlyTrend}>");
    expect(source).toContain("<Pie data={categoryBreakdown}");
    expect(source).toContain("{formatTZS(monthTotal)}");
    expect(source).toContain("{formatTZS(lastMonthTotal)}");
    expect(source).not.toContain('t("Sadaka Dynamic")');
  });
});
