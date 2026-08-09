import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingDown, TrendingUp, Users } from "lucide-react";
import { formatTZS } from "@/lib/currency";

export type AnalyticsChartProps = {
  trendData: Array<{ month: string; amount: number }>;
  jumuiyaData: Array<{ name: string; members: number }>;
  categoryComparison: Array<{
    name: string;
    thisMonth: number;
    lastMonth: number;
    change: number;
  }>;
};

export default function AnalyticsCharts({ trendData, jumuiyaData, categoryComparison }: AnalyticsChartProps) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base font-sans flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Monthly Contribution Trend</CardTitle></CardHeader>
          <CardContent>
            {trendData.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No data</p> : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={trendData}>
                  <defs><linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(40, 92%, 56%)" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(40, 92%, 56%)" stopOpacity={0} /></linearGradient></defs>
                  <XAxis dataKey="month" stroke="hsl(220, 10%, 50%)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(220, 10%, 50%)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${(Number(value) / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "hsl(224, 18%, 10%)", border: "1px solid hsl(224, 15%, 14%)", borderRadius: "8px", color: "hsl(45, 10%, 93%)" }} formatter={(value: number) => [formatTZS(value), "Amount"]} />
                  <Area type="monotone" dataKey="amount" stroke="hsl(40, 92%, 56%)" fill="url(#aGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base font-sans flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Jumuiya Membership</CardTitle></CardHeader>
          <CardContent>
            {jumuiyaData.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No data</p> : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={jumuiyaData}>
                  <XAxis dataKey="name" stroke="hsl(220, 10%, 50%)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(220, 10%, 50%)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "hsl(224, 18%, 10%)", border: "1px solid hsl(224, 15%, 14%)", borderRadius: "8px", color: "hsl(45, 10%, 93%)" }} />
                  <Bar dataKey="members" fill="hsl(40, 92%, 56%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base font-sans flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Category Comparison (This Month vs Last Month)</CardTitle></CardHeader>
        <CardContent>
          {categoryComparison.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No data</p> : (
            <div className="space-y-3">
              {categoryComparison.map((category) => (
                <div key={category.name} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div>
                    <p className="text-sm font-medium">{category.name}</p>
                    <p className="text-xs text-muted-foreground">Last: {formatTZS(category.lastMonth)} to This: {formatTZS(category.thisMonth)}</p>
                  </div>
                  <Badge variant="outline" className={category.change >= 0 ? "text-success border-success/30" : "text-destructive border-destructive/30"}>
                    {category.change >= 0 ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}
                    {Math.abs(Math.round(category.change))}%
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
