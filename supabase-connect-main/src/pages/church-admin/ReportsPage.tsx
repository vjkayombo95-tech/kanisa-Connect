import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { logError } from "@/lib/error-logger";
import { generateAnalyticsSnapshot, getLatestAnalyticsSnapshot, type AnalyticsSnapshotRow } from "@/lib/analytics-snapshots";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

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

type MemberContributionSummary = {
  member_id: string | null;
  member_name: string;
  phone: string | null;
  total_amount: number | string;
  contribution_count: number | string;
  last_contribution_date: string | null;
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
  const queryClient = useQueryClient();
  const { toast } = useToast();
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
        () => getLatestAnalyticsSnapshot<SnapshotPayload>(churchId),
        readOfflineCache(snapshotCacheKey, null as AnalyticsSnapshotRow<SnapshotPayload> | null),
      );
    },
    enabled: !!churchId,
  });

  const refreshReportData = useMutation({
    mutationFn: async () => {
      if (!churchId) throw new Error("No church context");
      return generateAnalyticsSnapshot<SnapshotPayload>(churchId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reports-analytics-snapshot", churchId] });
      void queryClient.invalidateQueries({ queryKey: ["analytics-snapshot", churchId] });
      toast({ title: "Report data refreshed successfully." });
    },
    onError: (error) => {
      logError(error, {
        page: "Reports",
        component: "ReportsPage",
        function: "refreshReportData",
        church_id: churchId,
        metadata: {
          rpc: "generate_church_analytics_snapshot",
        },
      });
      toast({
        title: "Unable to refresh report data",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    },
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

  const {
    data: memberSummaries = [],
    isLoading: isMemberSummaryLoading,
    isError: isMemberSummaryError,
    error: memberSummaryError,
  } = useQuery({
    queryKey: ["report-contributions-by-member", churchId, dateFrom, dateTo],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase.rpc("get_contributions_by_member" as never, {
        p_church_id: churchId,
        p_start_date: range.startIso,
        p_end_date: range.endExclusiveIso,
        p_limit: 100,
      } as never);

      if (error) {
        const message = error.message || "Unable to load member contribution summaries.";
        logError(new Error(message), {
          page: "Reports",
          component: "ReportsPage",
          function: "getContributionsByMember",
          church_id: churchId,
          metadata: {
            rpc: "get_contributions_by_member",
            dateFrom,
            dateTo,
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          },
        });
        throw new Error(message);
      }

      return (data ?? []) as unknown as MemberContributionSummary[];
    },
    enabled: !!churchId && activeTab === "member",
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
        <Button onClick={() => refreshReportData.mutate()} disabled={!churchId || refreshReportData.isPending}>
          {refreshReportData.isPending ? "Refreshing report data..." : "Refresh Report Data"}
        </Button>
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
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Total Given</TableHead>
                    <TableHead className="text-right">Contributions</TableHead>
                    <TableHead>Last Contribution</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isMemberSummaryLoading && (
                    [0, 1, 2].map((item) => (
                      <TableRow key={item}>
                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-12" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-24" /></TableCell>
                      </TableRow>
                    ))
                  )}
                  {isMemberSummaryError && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-destructive">
                        {memberSummaryError instanceof Error
                          ? memberSummaryError.message
                          : "Unable to load member contribution summaries."}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isMemberSummaryLoading && !isMemberSummaryError && memberSummaries.map((member) => (
                    <TableRow key={`${member.member_id ?? "anonymous"}-${member.member_name}`}>
                      <TableCell className="font-medium">{member.member_name || "Anonymous"}</TableCell>
                      <TableCell className="text-muted-foreground">{member.phone || "-"}</TableCell>
                      <TableCell className="text-right text-primary font-medium">{formatTZS(Number(member.total_amount || 0))}</TableCell>
                      <TableCell className="text-right">{Number(member.contribution_count || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.last_contribution_date ? new Date(member.last_contribution_date).toLocaleDateString() : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isMemberSummaryLoading && !isMemberSummaryError && memberSummaries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No member contributions found for this date range.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
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
