import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleDollarSign, HandCoins, Loader2, Plus, Target, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTZSForLanguage } from "@/lib/currency";
import { normalizeAppLanguage } from "@/lib/localization";
import { getPledgeProgress, useCreatePledge, useMakePledgePayment, useMemberPledges, usePledgeRealtime } from "@/lib/pledges";
import { PledgePaymentDialog } from "@/components/pledges/PledgePaymentDialog";
import { useToast } from "@/hooks/use-toast";

const PLEDGE_PLATFORM_FEE_PERCENT = 1;

export default function PortalPledges() {
  const { t, i18n } = useTranslation();
  const language = normalizeAppLanguage(i18n.language) ?? "en";
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
  const canOpenCreateDialog = !!member?.id && !!churchId;

  return (
    <div className="container mx-auto px-4 py-10 space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-serif">{t("member_portal.giving_account.my_pledges")}</h1>
          <p className="text-muted-foreground mt-2">{t("member_portal.giving_account.my_pledges_description")}</p>
        </div>
        <Dialog open={createOpen} onOpenChange={handleCreateDialogChange}>
          <DialogTrigger asChild>
            <Button disabled={!canOpenCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              {t("member_portal.giving_account.add_pledge")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-serif">{t("member_portal.giving_account.add_my_pledge")}</DialogTitle>
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
                    title: t("member_portal.giving_account.pledge_added"),
                    description: t("member_portal.giving_account.pledge_added_description", {
                      amount: formatTZSForLanguage(numericPledgeAmount, language),
                      community: memberCommunity.name,
                    }),
                  });
                  handleCreateDialogChange(false);
                } catch (error: any) {
                  toast({
                    title: t("member_portal.giving_account.unable_add_pledge"),
                    description: error?.message || t("member_portal.giving_account.pledge_create_error"),
                    variant: "destructive",
                  });
                }
              }}
            >
              <div className="rounded-lg border border-primary/10 bg-primary/5 p-3 text-sm">
                <p className="font-medium">{member?.full_name || t("member_portal.common.member")}</p>
                <p className="mt-1 text-muted-foreground">
                  {t("member_portal.giving_account.community")}: {isCommunityLoading ? t("member_portal.common.loading") : memberCommunity?.name || t("member_portal.giving_account.no_community_assigned")}
                </p>
              </div>
              {cannotCreatePledge && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-muted-foreground">
                  {isMemberLoading || isCommunityLoading
                    ? t("member_portal.giving_account.checking_community")
                    : t("member_portal.giving_account.community_required")}
                </div>
              )}
              <div className="space-y-2">
                <Label>{t("member_portal.giving_account.amount_pledged_tzs")}</Label>
                <Input
                  type="number"
                  min="1"
                  value={amountPledged}
                  onChange={(event) => setAmountPledged(event.target.value)}
                  placeholder={t("member_portal.giving_account.enter_pledge_amount")}
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("member_portal.giving_account.pledge_rollup_note")}
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => handleCreateDialogChange(false)}>
                  {t("member_portal.common.cancel")}
                </Button>
                <Button type="submit" disabled={createPledge.isPending || numericPledgeAmount <= 0 || !memberCommunity?.id || !member?.id || !churchId}>
                  {createPledge.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("member_portal.giving_account.add_pledge")}
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
              ? t("member_portal.giving_account.checking_community")
              : t("member_portal.giving_account.community_required_summary")}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard icon={Target} label={t("member_portal.giving_account.total_pledged")} value={formatTZSForLanguage(totals.pledged, language)} />
        <SummaryCard icon={HandCoins} label={t("member_portal.giving_account.paid_so_far")} value={formatTZSForLanguage(totals.paid, language)} />
        <SummaryCard icon={Wallet} label={t("member_portal.giving_account.balance")} value={formatTZSForLanguage(totals.balance, language)} />
        <SummaryCard icon={CircleDollarSign} label={t("member_portal.giving_account.progress")} value={`${overallProgress.toFixed(0)}%`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("member_portal.giving_account.commitment_overview")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={overallProgress} className="h-3" />
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("member_portal.giving_account.paid_amount", { amount: formatTZSForLanguage(totals.paid, language) })}</span>
            <span>{t("member_portal.giving_account.pledged_amount", { amount: formatTZSForLanguage(totals.pledged, language) })}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("member_portal.giving_account.my_active_pledges")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t("member_portal.giving_account.loading_pledges")}</p>
          ) : pledges.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("member_portal.giving_account.no_pledges")}</p>
          ) : (
            pledges.map((pledge) => {
              const progress = getPledgeProgress(pledge);

              return (
                <div key={pledge.id} className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">
                          {pledge.community_name || t("member_portal.giving_account.church_pledge")}
                        </p>
                        <Badge variant={pledge.status === "completed" ? "default" : "secondary"}>
                          {t(`member_portal.giving_account.pledge_status.${pledge.status}`, pledge.status)}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
                        <span>{t("member_portal.giving_account.pledged")}: <strong className="text-foreground">{formatTZSForLanguage(pledge.amount_pledged, language)}</strong></span>
                        <span>{t("member_portal.giving_account.paid")}: <strong className="text-foreground">{formatTZSForLanguage(pledge.amount_paid, language)}</strong></span>
                        <span>{t("member_portal.giving_account.balance")}: <strong className="text-foreground">{formatTZSForLanguage(pledge.balance, language)}</strong></span>
                      </div>
                      <div className="space-y-2">
                        <Progress value={progress} className="h-2" />
                        <p className="text-xs text-muted-foreground">{t("member_portal.giving_account.progress_complete", { progress: progress.toFixed(0) })}</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => setActivePledge(pledge)}
                      disabled={pledge.balance <= 0}
                    >
                      {t("member_portal.giving_account.pay_now")}
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
        title={activePledge ? t("member_portal.giving_account.pay_pledge_title", { pledge: activePledge.community_name || t("member_portal.giving_account.pledge") }) : t("member_portal.giving_account.pay_pledge")}
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
            title: t("member_portal.giving_account.payment_submitted"),
            description: t("member_portal.giving_account.payment_submitted_description"),
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
