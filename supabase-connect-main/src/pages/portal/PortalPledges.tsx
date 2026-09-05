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

const pledgeStatusLabels = {
  pending: "Inasubiri",
  partial: "Inaendelea",
  completed: "Imekamilika",
} as const;

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
  const canOpenCreateDialog = !cannotCreatePledge;

  return (
    <div className="container mx-auto px-4 pb-28 pt-6 animate-fade-in lg:px-8 lg:py-10">
      <div className="mx-auto max-w-6xl min-w-0 space-y-6">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Target className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Kanisa Connect</p>
            <h1 className="mt-1 font-serif text-3xl font-bold tracking-normal text-foreground sm:text-4xl">Ahadi za Michango</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Fuatilia ahadi zako na maendeleo ya michango yako.
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={handleCreateDialogChange}>
            <DialogTrigger asChild>
              <Button className="min-h-12 w-full sm:w-auto" disabled={!canOpenCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Weka Ahadi
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-serif">Weka Ahadi</DialogTitle>
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
                      title: "Ahadi imewekwa",
                      description: `${formatTZS(numericPledgeAmount)} imeongezwa kwenye ${memberCommunity.name}.`,
                    });
                    handleCreateDialogChange(false);
                  } catch (error: any) {
                    toast({
                      title: "Ahadi haikuwekwa",
                      description: error?.message || "Tatizo limetokea wakati wa kuweka ahadi.",
                      variant: "destructive",
                    });
                  }
                }}
              >
                <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4 text-sm">
                  <p className="font-medium">{member?.full_name || "Mwanachama"}</p>
                  <p className="mt-1 text-muted-foreground">
                    Jumuiya: {isCommunityLoading ? "Inatafutwa..." : memberCommunity?.name || "Hujaunganishwa na Jumuiya"}
                  </p>
                </div>
                {cannotCreatePledge && (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-muted-foreground">
                    {isMemberLoading || isCommunityLoading
                      ? "Tunakagua taarifa ya Jumuiya yako..."
                      : "Unahitaji kuunganishwa na Jumuiya kabla ya kuweka ahadi ya mchango."}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Kiasi cha Ahadi (TZS)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={amountPledged}
                    onChange={(event) => setAmountPledged(event.target.value)}
                    placeholder="Weka kiasi"
                    className="h-12 text-base"
                    required
                  />
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  Weka kiasi unachoahidi kuchangia. Malipo yatarekodiwa kando baada ya kuwasilishwa na kuthibitishwa.
                </p>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variant="outline" type="button" className="min-h-11" onClick={() => handleCreateDialogChange(false)}>
                    Ghairi
                  </Button>
                  <Button type="submit" className="min-h-11" disabled={createPledge.isPending || numericPledgeAmount <= 0 || !memberCommunity?.id || !member?.id || !churchId}>
                    {createPledge.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Weka Ahadi
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {cannotCreatePledge && (
          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm leading-6 text-muted-foreground">
            {isMemberLoading || isCommunityLoading
              ? "Tunakagua taarifa ya Jumuiya yako..."
              : "Unahitaji kuunganishwa na Jumuiya kabla ya kuweka ahadi inayojumuishwa kwenye takwimu za Jumuiya."}
          </div>
        )}

        <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-stretch">
          <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4">
            <SummaryCard icon={Target} label="Jumla ya Ahadi" value={formatTZS(totals.pledged)} />
            <SummaryCard icon={HandCoins} label="Niliyolipa" value={formatTZS(totals.paid)} />
            <SummaryCard icon={Wallet} label="Salio" value={formatTZS(totals.balance)} />
            <SummaryCard icon={CircleDollarSign} label="Maendeleo" value={`${overallProgress.toFixed(0)}%`} />
          </div>

          <Card className="min-w-0 rounded-2xl border-border/70 bg-card/95 shadow-sm">
            <CardContent className="flex h-full min-w-0 flex-col justify-between p-5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Maendeleo ya Ahadi</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{formatTZS(totals.paid)}</span> / {formatTZS(totals.pledged)}
                </p>
              </div>
              <div className="mt-5 space-y-3">
                <Progress value={overallProgress} className="h-3" />
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{overallProgress.toFixed(0)}% imetimia</span>
                  <span className="text-right">Salio {formatTZS(totals.balance)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <Card className="rounded-2xl border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ahadi Zinazoendelea</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="flex min-h-32 items-center justify-center rounded-2xl bg-muted/40 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Inapakia ahadi zako...
              </div>
            ) : pledges.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center">
                <Target className="mx-auto mb-3 h-10 w-10 text-muted-foreground/35" />
                <p className="font-medium text-foreground">Bado hujaweka ahadi ya mchango.</p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  Unaweza kuweka ahadi mpya na kufuatilia maendeleo yake hapa.
                </p>
                <Button className="mt-5 min-h-11" disabled={!canOpenCreateDialog} onClick={() => {
                  if (canOpenCreateDialog) setCreateOpen(true);
                }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Weka Ahadi
                </Button>
              </div>
            ) : (
              pledges.map((pledge) => {
                const progress = getPledgeProgress(pledge);

                return (
                  <div key={pledge.id} className="min-w-0 rounded-2xl border border-border/70 bg-background/70 p-4 shadow-sm">
                    <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p className="min-w-0 truncate text-sm font-semibold">
                            {pledge.community_name || "Ahadi ya Parokia"}
                          </p>
                          <Badge variant={pledge.status === "completed" ? "default" : "secondary"}>
                            {pledgeStatusLabels[pledge.status] ?? pledge.status}
                          </Badge>
                        </div>
                        <div className="grid min-w-0 grid-cols-1 gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                          <Metric label="Ahadi" value={formatTZS(pledge.amount_pledged)} />
                          <Metric label="Imelipwa" value={formatTZS(pledge.amount_paid)} />
                          <Metric label="Salio" value={formatTZS(pledge.balance)} />
                        </div>
                        <div className="space-y-2">
                          <Progress value={progress} className="h-2" />
                          <p className="text-xs text-muted-foreground">{progress.toFixed(0)}% imetimia</p>
                        </div>
                      </div>
                      <Button
                        className="min-h-11 w-full sm:w-auto"
                        onClick={() => setActivePledge(pledge)}
                        disabled={pledge.balance <= 0}
                      >
                        Wasilisha Malipo
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
          title={activePledge ? `Wasilisha malipo ya ${activePledge.community_name || "ahadi"}` : "Wasilisha Malipo ya Ahadi"}
          maxAmount={activePledge?.balance ?? 0}
          feePercentage={PLEDGE_PLATFORM_FEE_PERCENT}
          isSubmitting={paymentMutation.isPending}
          onSubmit={async (amount, paymentMethod, transactionId, proofUrl) => {
            if (!activePledge) return;
            const result = await paymentMutation.mutateAsync({
              pledgeId: activePledge.id,
              amount,
              paymentMethod,
              transactionId,
              proofUrl,
            });
            queryClient.invalidateQueries({ queryKey: ["member-pledges", member?.id] });
            queryClient.invalidateQueries({ queryKey: ["church-pledges-summary", churchId] });
            queryClient.invalidateQueries({ queryKey: ["community-pledges", activePledge.community_id] });
            const fee = Number((result as any)?.fee_amount ?? 0);
            const net = Number((result as any)?.net_amount ?? 0);
            const gross = Number((result as any)?.gross_amount ?? amount);
            toast({
              title: "Malipo yametumwa kwa uthibitisho",
              description: "Salio la ahadi litasasishwa baada ya msimamizi wa kanisa au padre kuthibitisha malipo.",
            });
          }}
        />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/45 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card className="min-w-0 rounded-2xl border-border/70 bg-card/95 shadow-sm">
      <CardContent className="flex min-w-0 items-center justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
          <p className="mt-1 truncate font-serif text-lg font-bold text-foreground sm:text-xl">{value}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm sm:h-11 sm:w-11">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
