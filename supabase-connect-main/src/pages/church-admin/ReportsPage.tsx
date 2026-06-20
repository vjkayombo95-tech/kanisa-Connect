import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { FileText, HandCoins, Building2 } from "lucide-react";
import { StatCard } from "@/components/church-admin/StatCard";
import { formatTZS } from "@/lib/currency";
import { useAuth } from "@/contexts/AuthContext";
import { readOfflineCache, withOfflineCache } from "@/lib/offline-cache";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";
import { PaginationFooter } from "@/components/ui/pagination-footer";

type SnapshotPayload = {
  thisTotal?: number;
  transactionCount?: number;
  categoryCount?: number;
  topCategories?: Array<{ name: string; total: number }>;
  categoryComparison?: Array<{ name: string; thisMonth: number; lastMonth: number; change: number }>;
  activeMembers?: number;
  newMembers?: number;
  pledgeTotals?: { pledged: number; paid: number; balance: number };
};

type SnapshotRow = {
  payload: SnapshotPayload;
  generated_at: string;
};

function getDateRange(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const nextDay = new Date(endDate);
  nextDay.setDate(nextDay.getDate() + 1);

  return {
    startIso: start.toISOString(),
    endExclusiveIso: nextDay.toISOString(),
  };
}

export default function ReportsPage() {
  const { churchId } = useAuth();
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [activeTab, setActiveTab] = useState("category");
  const [totalCount, setTotalCount] = useState(0);
  const range = useMemo(() => getDateRange(dateFrom, dateTo), [dateFrom, dateTo]);
  const pagination = usePaginatedQuery({
    totalCount,
    resetKey: `${churchId ?? "none"}:${dateFrom}:${dateTo}:${activeTab}`,
  });
  const snapshotCacheKey = churchId ? `offline-cache:reports-analytics-snapshot:${churchId}` : null;

  const { data: snapshot } = useQuery({
    queryKey: ["reports-analytics-snapshot", churchId],
    queryFn: async () => {
      if (!churchId) return null;
      return withOfflineCache(
        snapshotCacheKey,
        async () => {
          const { data, error } = await supabase
            .from("analytics_snapshots" as never)
            .select("payload, generated_at")
            .eq("church_id", churchId)
            .eq("snapshot_type", "monthly_overview")
            .order("generated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (error) {
            if (error.message?.includes("analytics_snapshots")) return null;
            throw error;
          }

          return data as unknown as SnapshotRow | null;
        },
        readOfflineCache(snapshotCacheKey, null as SnapshotRow | null),
      );
    },
    enabled: !!churchId,
  });

  const { data: detailsPage = { rows: [] as any[], count: 0 }, isLoading } = useQuery({
    queryKey: ["report-contribution-details", churchId, dateFrom, dateTo, pagination.page, pagination.pageSize],
    queryFn: async () => {
      if (!churchId) return { rows: [] as any[], count: 0 };
      const { data, error, count } = await supabase
        .from("contributions")
        .select("id, amount, donor_name, member_id, created_at, contribution_categories!contributions_category_id_fkey(name), members!contributions_member_id_fkey(full_name)", { count: "exact" })
        .eq("church_id", churchId)
        .gte("created_at", range.startIso)
        .lt("created_at", range.endExclusiveIso)
        .order("created_at", { ascending: false })
        // Query safety: detailed report rows are loaded only on the drilldown tab and always paginated.
        .range(pagination.from, pagination.to);

      if (error) return { rows: [] as any[], count: 0 };
      return { rows: data ?? [], count: count ?? 0 };
    },
    enabled: !!churchId && activeTab === "detail",
  });

  useEffect(() => {
    setTotalCount(detailsPage.count);
  }, [detailsPage.count]);

  const payload = snapshot?.payload ?? {};
  const topCategories = payload.topCategories ?? payload.categoryComparison?.map((category) => ({
    name: category.name,
    total: category.thisMonth,
  })) ?? [];
  const total = Number(payload.thisTotal ?? 0);
  const transactionCount = Number(payload.transactionCount ?? 0);
  const categoryCount = Number(payload.categoryCount ?? topCategories.length);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-serif">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Contribution reports and summaries</p>
        {snapshot?.generated_at ? (
          <p className="text-xs text-muted-foreground mt-1">
            Using analytics snapshot generated {new Date(snapshot.generated_at).toLocaleString()}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-auto" />
          <span className="text-muted-foreground">to</span>
          <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-auto" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total in Snapshot" value={formatTZS(total)} icon={HandCoins} />
        <StatCard title="Transactions" value={transactionCount} icon={FileText} />
        <StatCard title="Categories" value={categoryCount} icon={Building2} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary">
          <TabsTrigger value="category">By Category</TabsTrigger>
          <TabsTrigger value="member">By Member</TabsTrigger>
          <TabsTrigger value="family">By Family</TabsTrigger>
          <TabsTrigger value="detail">All Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="category" className="mt-4">
          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCategories.map((category) => (
                    <TableRow key={category.name}>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell className="text-right text-primary font-medium">{formatTZS(Number(category.total || 0))}</TableCell>
                    </TableRow>
                  ))}
                  {topCategories.length === 0 && (
                    <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground">No snapshot data. Generate analytics first.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="member" className="mt-4">
          <Card className="glass-card">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Member-level drilldowns are loaded from detailed transactions only when you open All Transactions.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="family" className="mt-4">
          <Card className="glass-card">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Family reports require a dedicated server-side summary RPC before they can scale beyond large member lists.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detail" className="mt-4">
          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Donor</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailsPage.rows.map((contribution: any) => (
                    <TableRow key={contribution.id}>
                      <TableCell className="text-muted-foreground">{new Date(contribution.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{contribution.members?.full_name || contribution.donor_name || "Anonymous"}</TableCell>
                      <TableCell>{contribution.contribution_categories?.name || "—"}</TableCell>
                      <TableCell className="text-right text-primary font-medium">{formatTZS(Number(contribution.amount || 0))}</TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && detailsPage.rows.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No data</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              <PaginationFooter
                page={pagination.page}
                pageSize={pagination.pageSize}
                totalCount={pagination.totalCount}
                hasPreviousPage={pagination.hasPreviousPage}
                hasNextPage={pagination.hasNextPage}
                previousPage={pagination.previousPage}
                nextPage={pagination.nextPage}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
