import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleDollarSign, HandCoins, Loader2, Plus, Target, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTZS } from "@/lib/currency";
import { getPledgeProgress, useCreatePledge, useMakePledgePayment, useMemberPledges, usePledgeRealtime } from "@/lib/pledges";
import { PledgePaymentDialog } from "@/components/pledges/PledgePaymentDialog";
import { useToast } from "@/hooks/use-toast";

const PLEDGE_PLATFORM_FEE_PERCENT = 1;

export default function PortalPledges() {
  const { user, churchId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activePledge, setActivePledge] = useState<any | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [amountPledged, setAmountPledged] = useState("");

  const { data: member } = useQuery({
    queryKey: ["my-member-record", user?.id, churchId],
    queryFn: async () => {
      if (!user || !churchId) return null;
      const { data, error } = await supabase
        .from("members")
        .select("id, full_name, community_id")
        .eq("user_id", user.id)
        .eq("church_id", churchId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!churchId,
  });

  const isMemberLoading = !!user && !!churchId && member === undefined;

  const { data: memberCommunity } = useQuery({
    queryKey: ["member-pledge-community", member?.id, member?.community_id, churchId],
    queryFn: async () => {
      if (!member?.id) return null;

      if (member.community_id) {
        const { data, error } = await supabase
          .from("communities")
          .select("id, name")
          .eq("id", member.community_id)
          .maybeSingle();
        if (error) throw error;
        if (data) return data;
      }

      const { data: memberCommunityLink, error: memberCommunityError } = await supabase
        .from("member_communities")
        .select("community_id, communities(id, name)")
        .eq("member_id", member.id)
        .limit(1)
        .maybeSingle();

      if (!memberCommunityError) {
        const linkedCommunity = memberCommunityLink?.communities as { id: string; name: string } | null | undefined;
        if (linkedCommunity) return linkedCommunity;
      }

      const { data: legacyMembership, error: legacyError } = await supabase
        .from("community_members")
        .select("community_id, communities(id, name)")
        .eq("member_id", member.id)
        .limit(1)
        .maybeSingle();

      if (!legacyError) {
        const legacyCommunity = legacyMembership?.communities as { id: string; name: string } | null | undefined;
        if (legacyCommunity) return legacyCommunity;
      }

      if (churchId) {
        const { data: leaderCommunity, error: leaderCommunityError } = await supabase
          .from("communities")
          .select("id, name")
          .eq("church_id", churchId)
          .or([
            `mwenyekiti_id.eq.${member.id}`,
            `makamu_mwenyekiti_id.eq.${member.id}`,
            `mweka_hazina_id.eq.${member.id}`,
            `katibu_id.eq.${member.id}`,
          ].join(","))
          .limit(1)
          .maybeSingle();

        if (leaderCommunityError) throw leaderCommunityError;
        if (leaderCommunity) return leaderCommunity;
      }

      return null;
    },
    enabled: !!member?.id && !!churchId,
  });
  const isCommunityLoading = !!member?.id && !!churchId && memberCommunity === undefined;

  const handleCreateDialogChange = (open: boolean) => {
    setCreateOpen(open);
    if (!open) {
      setAmountPledged("");
    }
  };

  const { data: pledges = [], isLoading } = useMemberPledges(member?.id);
  const createPledge = useCreatePledge();
  const paymentMutation = useMakePledgePayment();
  const realtimeKeys = useMemo(
    () =>
      [
        ["member-pledges", member?.id],
        ["church-pledges-summary", churchId],
        ["community-pledges", memberCommunity?.id],
      ] as const,
    [churchId, member?.id, memberCommunity?.id],
  );
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

  const overallProgress = totals.pledged ? Math.min(100, (totals.paid / totals.pledged) * 100) : 0;
  const numericPledgeAmount = Number(amountPledged || 0);
  const cannotCreatePledge = !member?.id || !churchId || !memberCommunity?.id;
  const canOpenCreateDialog = !!member?.id && !!churchId;

  return (
    <div className="container mx-auto px-4 py-10 space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-serif">My Pledges</h1>
          <p className="text-muted-foreground mt-2">Track your church commitments and add a personal pledge to your community.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={handleCreateDialogChange}>
          <DialogTrigger asChild>
            <Button disabled={!canOpenCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Pledge
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-serif">Add My Pledge</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!member?.id || !churchId || !memberCommunity?.id || numericPledgeAmount <= 0) return;

                try {
                  await createPledge.mutateAsync({
                    memberId: member.id,
                    churchId,
                    communityId: memberCommunity.id,
                    amountPledged: numericPledgeAmount,
                  });

                  queryClient.invalidateQueries({ queryKey: ["member-pledges", member.id] });
                  queryClient.invalidateQueries({ queryKey: ["church-pledges-summary", churchId] });
                  queryClient.invalidateQueries({ queryKey: ["community-pledges", memberCommunity.id] });
                  toast({
                    title: "Pledge added",
                    description: `${formatTZS(numericPledgeAmount)} has been added to ${memberCommunity.name}.`,
                  });
                  handleCreateDialogChange(false);
                } catch (error: any) {
                  toast({
                    title: "Unable to add pledge",
                    description: error?.message || "Something went wrong while creating the pledge.",
                    variant: "destructive",
                  });
                }
              }}
            >
              <div className="rounded-lg border border-primary/10 bg-primary/5 p-3 text-sm">
                <p className="font-medium">{member?.full_name || "Member"}</p>
                <p className="mt-1 text-muted-foreground">
                  Community: {isCommunityLoading ? "Loading..." : memberCommunity?.name || "No community assigned"}
                </p>
              </div>
              {cannotCreatePledge && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-muted-foreground">
                  {isMemberLoading || isCommunityLoading
                    ? "Checking your community assignment..."
                    : "You need to be assigned to a community before this pledge can be created."}
                </div>
              )}
              <div className="space-y-2">
                <Label>Amount Pledged (TZS)</Label>
                <Input
                  type="number"
                  min="1"
                  value={amountPledged}
                  onChange={(event) => setAmountPledged(event.target.value)}
                  placeholder="Enter pledge amount"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                This pledge will be counted under your community and will update the church admin pledge summary.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => handleCreateDialogChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createPledge.isPending || numericPledgeAmount <= 0 || !memberCommunity?.id || !member?.id || !churchId}>
                  {createPledge.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Pledge
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {cannotCreatePledge && (
        <Card className="glass-card border-primary/20">
          <CardContent className="p-4 text-sm text-muted-foreground">
            {isMemberLoading || isCommunityLoading
              ? "Checking your community assignment..."
              : "You need to be assigned to a community before you can add a pledge that rolls up into community totals."}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard icon={Target} label="Total Pledged" value={formatTZS(totals.pledged)} />
        <SummaryCard icon={HandCoins} label="Paid So Far" value={formatTZS(totals.paid)} />
        <SummaryCard icon={Wallet} label="Balance" value={formatTZS(totals.balance)} />
        <SummaryCard icon={CircleDollarSign} label="Progress" value={`${overallProgress.toFixed(0)}%`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Commitment Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={overallProgress} className="h-3" />
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatTZS(totals.paid)} paid</span>
            <span>{formatTZS(totals.pledged)} pledged</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My Active Pledges</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading pledges...</p>
          ) : pledges.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pledges recorded yet.</p>
          ) : (
            pledges.map((pledge) => {
              const progress = getPledgeProgress(pledge);

              return (
                <div key={pledge.id} className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">
                          {pledge.community_name || "Church Pledge"}
                        </p>
                        <Badge variant={pledge.status === "completed" ? "default" : "secondary"}>
                          {pledge.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
                        <span>Pledged: <strong className="text-foreground">{formatTZS(pledge.amount_pledged)}</strong></span>
                        <span>Paid: <strong className="text-foreground">{formatTZS(pledge.amount_paid)}</strong></span>
                        <span>Balance: <strong className="text-foreground">{formatTZS(pledge.balance)}</strong></span>
                      </div>
                      <div className="space-y-2">
                        <Progress value={progress} className="h-2" />
                        <p className="text-xs text-muted-foreground">{progress.toFixed(0)}% complete</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => setActivePledge(pledge)}
                      disabled={pledge.balance <= 0}
                    >
                      Pay Now
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <PledgePaymentDialog
        open={!!activePledge}
        onOpenChange={(open) => {
          if (!open) setActivePledge(null);
        }}
        title={activePledge ? `Pay ${activePledge.community_name || "Pledge"}` : "Pay Pledge"}
        maxAmount={activePledge?.balance ?? 0}
        feePercentage={PLEDGE_PLATFORM_FEE_PERCENT}
        isSubmitting={paymentMutation.isPending}
        onSubmit={async (amount, paymentMethod) => {
          if (!activePledge) return;
          const result = await paymentMutation.mutateAsync({
            pledgeId: activePledge.id,
            amount,
            paymentMethod,
          });
          queryClient.invalidateQueries({ queryKey: ["member-pledges", member?.id] });
          queryClient.invalidateQueries({ queryKey: ["church-pledges-summary", churchId] });
          queryClient.invalidateQueries({ queryKey: ["community-pledges", activePledge.community_id] });
          const fee = Number((result as any)?.fee_amount ?? 0);
          const net = Number((result as any)?.net_amount ?? 0);
          const gross = Number((result as any)?.gross_amount ?? amount);
          toast({
            title: "Pledge payment recorded",
            description: `${formatTZS(net)} will go to the church. You paid ${formatTZS(gross)}, including a ${formatTZS(fee)} platform fee.`,
          });
        }}
      />
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card className="glass-card">
      <CardContent className="p-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-xl font-bold font-serif mt-1">{value}</p>
        </div>
        <div className="h-11 w-11 rounded-lg gradient-gold flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}
