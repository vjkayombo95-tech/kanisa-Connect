import { useOutletContext } from "react-router-dom";
import { CommunityOutletContext } from "@/components/community-leader/CommunityLeaderLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCommunityContributionDate, useCommunityMembers, useCommunityContributions } from "@/hooks/use-community-leader";
import { formatTZS } from "@/lib/currency";
import { format, startOfMonth, startOfWeek, startOfYear, subMonths, isAfter, startOfDay } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function CommunityReportsPage() {
  const { communityId, community } = useOutletContext<CommunityOutletContext>();

  const { data: members = [] } = useCommunityMembers(communityId);
  const { data: contributions = [] } = useCommunityContributions(communityId);

  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const yearStart = startOfYear(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));

  const filter = (from: Date) =>
    contributions.filter((c) => {
      const contributionDate = getCommunityContributionDate(c);
      return contributionDate ? isAfter(new Date(contributionDate), from) : false;
    });
  const sum = (arr: any[]) => arr.reduce((s, c) => s + Number(c.amount), 0);

  const todayTotal = sum(filter(todayStart));
  const weekTotal = sum(filter(weekStart));
  const monthTotal = sum(filter(monthStart));
  const yearTotal = sum(filter(yearStart));
  const lastMonthTotal = sum(contributions.filter((c) => {
    const contributionDate = getCommunityContributionDate(c);
    if (!contributionDate) return false;
    const d = new Date(contributionDate);
    return isAfter(d, lastMonthStart) && !isAfter(d, monthStart);
  }));

  // By member
  const memberTotals = new Map<string, { name: string; total: number }>();
  contributions.forEach((c: any) => {
    const name = (c.members as any)?.full_name || c.donor_name || "Unknown";
    const mid = c.member_id || name;
    const prev = memberTotals.get(mid);
    memberTotals.set(mid, { name, total: (prev?.total || 0) + Number(c.amount) });
  });
  const sortedMembers = [...memberTotals.values()].sort((a, b) => b.total - a.total);

  // By category
  const categoryTotals = new Map<string, { name: string; total: number }>();
  contributions.forEach((c: any) => {
    const name = (c.contribution_categories as any)?.name || "Uncategorized";
    const prev = categoryTotals.get(name);
    categoryTotals.set(name, { name, total: (prev?.total || 0) + Number(c.amount) });
  });
  const sortedCategories = [...categoryTotals.values()].sort((a, b) => b.total - a.total);

  // Monthly trend (last 6 months)
  const monthlyData: { month: string; amount: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const ms = startOfMonth(subMonths(now, i));
    const me = startOfMonth(subMonths(now, i - 1));
    const total = sum(contributions.filter((c) => {
      const contributionDate = getCommunityContributionDate(c);
      if (!contributionDate) return false;
      const d = new Date(contributionDate);
      return isAfter(d, ms) && !isAfter(d, me);
    }));
    monthlyData.push({ month: format(ms, "MMM"), amount: total });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-serif">Community Reports</h1>
        <p className="text-sm text-muted-foreground">{community?.name}</p>
      </div>

      {/* Period summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Today", value: todayTotal },
          { label: "This Week", value: weekTotal },
          { label: "This Month", value: monthTotal },
          { label: "This Year", value: yearTotal },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-lg font-bold">{formatTZS(s.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Month comparison */}
      <Card>
        <CardHeader><CardTitle className="text-base">Month Comparison</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">This Month</p>
              <p className="text-xl font-bold">{formatTZS(monthTotal)}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Last Month</p>
              <p className="text-xl font-bold">{formatTZS(lastMonthTotal)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trend chart */}
      <Card>
        <CardHeader><CardTitle className="text-base">Contribution Trend (6 Months)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
                <Tooltip formatter={(v: number) => formatTZS(v)} />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* By member */}
      <Card>
        <CardHeader><CardTitle className="text-base">Contributions by Member</CardTitle></CardHeader>
        <CardContent>
          {sortedMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No data</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMembers.slice(0, 20).map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-right">{formatTZS(m.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* By category */}
      <Card>
        <CardHeader><CardTitle className="text-base">Contributions by Category</CardTitle></CardHeader>
        <CardContent>
          {sortedCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No data</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCategories.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-right">{formatTZS(c.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Members</span>
            <span className="font-medium">{members.length}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
