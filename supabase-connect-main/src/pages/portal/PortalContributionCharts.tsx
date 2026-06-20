import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent } from "@/components/ui/card";
import { formatTZS } from "@/lib/currency";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 160 60% 45%))",
  "hsl(var(--chart-3, 30 80% 55%))",
  "hsl(var(--chart-4, 280 65% 60%))",
  "hsl(var(--chart-5, 340 75% 55%))",
  "hsl(200 70% 50%)",
];

type PortalContributionChartsProps = {
  monthlyTrend: Array<{ month: string; amount: number }>;
  categoryBreakdown: Array<{ name: string; value: number }>;
  monthTotal: number;
  lastMonthTotal: number;
};

export default function PortalContributionCharts({
  monthlyTrend,
  categoryBreakdown,
  monthTotal,
  lastMonthTotal,
}: PortalContributionChartsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <p className="text-sm font-medium mb-3">Monthly Trend (6 months)</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthlyTrend}>
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `${(Number(value) / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(value: number) => formatTZS(value)} />
            <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div>
        <p className="text-sm font-medium mb-3">Category Breakdown</p>
        {categoryBreakdown.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={categoryBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {categoryBreakdown.map((_, index) => (
                  <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatTZS(value)} />
            </PieChart>
          </ResponsiveContainer>
        ) : null}
      </div>
      <div className="md:col-span-2 grid grid-cols-2 gap-4">
        <Card className="bg-muted/30">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">This Month</p>
            <p className="text-lg font-bold text-primary">{formatTZS(monthTotal)}</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Last Month</p>
            <p className="text-lg font-bold">{formatTZS(lastMonthTotal)}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
