import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HandCoins, Target, Wallet, Building2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StatCard } from "@/components/church-admin/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatTZS } from "@/lib/currency";
import { useCreatePledge, usePledgeRealtime } from "@/lib/pledges";
import { PledgeCreateDialog } from "@/components/pledges/PledgeCreateDialog";
import { useToast } from "@/hooks/use-toast";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { readOfflineCache, withOfflineCache } from "@/lib/offline-cache";

export default function PledgesPage() {
  const { churchId } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const summaryCacheKey = churchId ? `offline-cache:church-pledges-summary:${churchId}` : null;
  const pledgeMembersCacheKey = churchId ? `offline-cache:pledge-members:${churchId}` : null;
  const pledgeCommunitiesCacheKey = churchId ? `offline-cache:pledge-communities:${churchId}` : null;

  const { data: summary = [], isLoading } = useQuery({
    queryKey: ["church-pledges-summary", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      if (!isOnline) {
        return readOfflineCache(summaryCacheKey, [] as any[]);
      }

      return withOfflineCache(
        summaryCacheKey,
        async () => {
          const { data, error } = await supabase.rpc("get_church_pledges_summary" as never, { _church_id: churchId } as never);
          if (error) throw error;
          return ((data ?? []) as any[]).map((row) => ({
            community_id: row.community_id,
            community_name: row.community_name,
            target_amount: Number(row.target_amount ?? 0),
            total_pledged: Number(row.total_pledged ?? 0),
            total_paid: Number(row.total_paid ?? 0),
            balance: Number(row.balance ?? 0),
            pledge_count: Number(row.pledge_count ?? 0),
            completed_count: Number(row.completed_count ?? 0),
            progress_percentage: Number(row.progress_percentage ?? 0),
          }));
        },
        readOfflineCache(summaryCacheKey, [] as any[]),
      );
    },
    enabled: !!churchId,
  });
  const createPledge = useCreatePledge();
  const realtimeKeys = useMemo(() => [["church-pledges-summary", churchId]] as const, [churchId]);
  usePledgeRealtime(realtimeKeys as unknown as (readonly unknown[])[]);

  const { data: members = [] } = useQuery({
    queryKey: ["pledge-members", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      if (!isOnline) {
        return readOfflineCache(pledgeMembersCacheKey, [] as any[]);
      }
      return withOfflineCache(
        pledgeMembersCacheKey,
        async () => {
          const { data, error } = await supabase
            .from("members")
            .select("id, full_name, community_id")
            .eq("church_id", churchId)
            .order("full_name");
          if (error) throw error;
          return data ?? [];
        },
        readOfflineCache(pledgeMembersCacheKey, [] as any[]),
      );
    },
    enabled: !!churchId,
  });

  const { data: communities = [] } = useQuery({
    queryKey: ["pledge-communities", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      if (!isOnline) {
        return readOfflineCache(pledgeCommunitiesCacheKey, [] as any[]);
      }
      return withOfflineCache(
        pledgeCommunitiesCacheKey,
        async () => {
          const { data, error } = await supabase
            .from("communities")
            .select("id, name")
            .eq("church_id", churchId)
            .order("name");
          if (error) throw error;
          return data ?? [];
        },
        readOfflineCache(pledgeCommunitiesCacheKey, [] as any[]),
      );
    },
    enabled: !!churchId,
  });

  const totals = useMemo(() => {
    return summary.reduce(
      (acc, row) => ({
        pledged: acc.pledged + row.total_pledged,
        paid: acc.paid + row.total_paid,
        balance: acc.balance + row.balance,
      }),
      { pledged: 0, paid: 0, balance: 0 },
    );
  }, [summary]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif">Pledges</h1>
          <p className="text-sm text-muted-foreground mt-1">Track church pledge commitments across all communities.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Create Pledge</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Pledged" value={formatTZS(totals.pledged)} icon={Target} />
        <StatCard title="Total Paid" value={formatTZS(totals.paid)} icon={HandCoins} />
        <StatCard title="Outstanding" value={formatTZS(totals.balance)} icon={Wallet} />
        <StatCard title="Communities" value={summary.length} icon={Building2} />
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Community Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading pledge summary...</p>
          ) : summary.length === 0 ? (
            <p className="text-sm text-muted-foreground">No community pledge data yet.</p>
          ) : (
            summary.map((row) => (
              <div key={row.community_id} className="rounded-2xl border border-border/60 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{row.community_name}</p>
                      <span className="text-xs text-muted-foreground">
                        {row.completed_count}/{row.pledge_count} completed
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted-foreground">
                      <span>Target: <strong className="text-foreground">{formatTZS(row.target_amount)}</strong></span>
                      <span>Pledged: <strong className="text-foreground">{formatTZS(row.total_pledged)}</strong></span>
                      <span>Paid: <strong className="text-foreground">{formatTZS(row.total_paid)}</strong></span>
                      <span>Balance: <strong className="text-foreground">{formatTZS(row.balance)}</strong></span>
                    </div>
                    <div className="space-y-2">
                      <Progress value={row.progress_percentage} className="h-2" />
                      <p className="text-xs text-muted-foreground">{row.progress_percentage.toFixed(0)}% complete</p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <PledgeCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create Church Pledge"
        description="Assign a pledge to any member and optionally update the community target."
        members={members}
        communities={communities}
        allowTargetAmount
        isSubmitting={createPledge.isPending}
        onSubmit={async ({ memberId, communityId, amountPledged, targetAmount }) => {
          if (!churchId) return;
          await createPledge.mutateAsync({
            memberId,
            churchId,
            communityId,
            amountPledged,
            targetAmount,
          });
          queryClient.invalidateQueries({ queryKey: ["church-pledges-summary", churchId] });
          toast({ title: "Pledge created", description: `${formatTZS(amountPledged)} has been assigned.` });
        }}
      />
    </div>
  );
}
