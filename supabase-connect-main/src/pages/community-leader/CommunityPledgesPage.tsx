import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HandCoins, Target, Users, Wallet } from "lucide-react";

import { CommunityOutletContext } from "@/components/community-leader/CommunityLeaderLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatTZS } from "@/lib/currency";
import { getPledgeProgress, useCommunityPledges, useCreatePledge, useMakePledgePayment, usePledgeRealtime } from "@/lib/pledges";
import { useCommunityMembers } from "@/hooks/use-community-leader";
import { PledgeCreateDialog } from "@/components/pledges/PledgeCreateDialog";
import { PledgePaymentDialog } from "@/components/pledges/PledgePaymentDialog";
import { useToast } from "@/hooks/use-toast";

const PLEDGE_PLATFORM_FEE_PERCENT = 1;

export default function CommunityPledgesPage() {
  const { communityId, community, churchId } = useOutletContext<CommunityOutletContext>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [activePledge, setActivePledge] = useState<any | null>(null);

  const { data: communityMembers = [] } = useCommunityMembers(communityId);
  const { data: pledges = [], isLoading } = useCommunityPledges(communityId);
  const createPledge = useCreatePledge();
  const makePayment = useMakePledgePayment();
  const realtimeKeys = useMemo(() => [["community-pledges", communityId]] as const, [communityId]);
  usePledgeRealtime(realtimeKeys as unknown as (readonly unknown[])[]);

  const totals = useMemo(() => {
    return pledges.reduce(
      (acc, pledge) => ({
        pledged: acc.pledged + pledge.amount_pledged,
        paid: acc.paid + pledge.amount_paid,
        balance: acc.balance + pledge.balance,
      }),
      { pledged: 0, paid: 0, balance: 0 },
    );
  }, [pledges]);

  const memberOptions = useMemo(
    () =>
      communityMembers
        .map((entry: any) => ({
          id: entry.member_id,
          full_name: entry.members?.full_name || "Member",
          community_id: communityId,
        }))
        .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name)),
    [communityId, communityMembers],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif">Community Pledges</h1>
          <p className="text-sm text-muted-foreground">{community?.name} pledge progress for all members.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Create Pledge</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Target} title="Total Pledged" value={formatTZS(totals.pledged)} />
        <StatCard icon={HandCoins} title="Total Paid" value={formatTZS(totals.paid)} />
        <StatCard icon={Wallet} title="Outstanding" value={formatTZS(totals.balance)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members and Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading pledge data...</p>
          ) : pledges.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pledges have been created for this community yet.</p>
          ) : (
            pledges.map((pledge) => {
              const progress = getPledgeProgress(pledge);
              return (
                <div key={pledge.id} className="rounded-2xl border border-border/60 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{pledge.member_name}</p>
                        <span className="text-xs text-muted-foreground">{formatTZS(pledge.balance)} remaining</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted-foreground">
                        <span>Pledged: <strong className="text-foreground">{formatTZS(pledge.amount_pledged)}</strong></span>
                        <span>Paid: <strong className="text-foreground">{formatTZS(pledge.amount_paid)}</strong></span>
                        <span>Status: <strong className="text-foreground">{pledge.status}</strong></span>
                        <span>Created: <strong className="text-foreground">{new Date(pledge.created_at).toLocaleDateString()}</strong></span>
                      </div>
                      <div className="space-y-2">
                        <Progress value={progress} className="h-2" />
                        <p className="text-xs text-muted-foreground">{progress.toFixed(0)}% complete</p>
                      </div>
                    </div>
                    <Button onClick={() => setActivePledge(pledge)} disabled={pledge.balance <= 0}>
                      Record Payment
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <PledgeCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create Community Pledge"
        description="Assign a pledge to a community member and optionally raise the community target."
        members={memberOptions}
        communities={[{ id: communityId, name: community?.name || "Community" }]}
        defaultCommunityId={communityId}
        lockCommunity
        allowTargetAmount
        isSubmitting={createPledge.isPending}
        onSubmit={async ({ memberId, communityId: formCommunityId, amountPledged, targetAmount }) => {
          await createPledge.mutateAsync({
            memberId,
            churchId,
            communityId: formCommunityId,
            amountPledged,
            targetAmount,
          });
          queryClient.invalidateQueries({ queryKey: ["community-pledges", communityId] });
          toast({ title: "Pledge created", description: `${formatTZS(amountPledged)} has been assigned.` });
        }}
      />

      <PledgePaymentDialog
        open={!!activePledge}
        onOpenChange={(open) => {
          if (!open) setActivePledge(null);
        }}
        title={activePledge ? `Record payment for ${activePledge.member_name}` : "Record Pledge Payment"}
        maxAmount={activePledge?.balance ?? 0}
        feePercentage={PLEDGE_PLATFORM_FEE_PERCENT}
        isSubmitting={makePayment.isPending}
        onSubmit={async (amount, paymentMethod) => {
          if (!activePledge) return;
          const result = await makePayment.mutateAsync({ pledgeId: activePledge.id, amount, paymentMethod });
          queryClient.invalidateQueries({ queryKey: ["community-pledges", communityId] });
          const fee = Number((result as any)?.fee_amount ?? 0);
          const net = Number((result as any)?.net_amount ?? 0);
          const gross = Number((result as any)?.gross_amount ?? amount);
          toast({
            title: "Payment recorded",
            description: `${formatTZS(net)} will go to the church. Total paid was ${formatTZS(gross)}, including a ${formatTZS(fee)} platform fee.`,
          });
        }}
      />
    </div>
  );
}

function StatCard({ icon: Icon, title, value }: { icon: any; title: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}
