import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, CheckCircle2, Eye, Loader2, XCircle } from "lucide-react";

import { StatCard } from "@/components/church-admin/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatTZS } from "@/lib/currency";
import { RECORD_PRESERVATION_AMOUNT } from "@/lib/member-record-preservation";

type PreservationSubscription = {
  id: string;
  church_id: string;
  member_id: string;
  amount: number;
  plan_interval: "monthly" | "yearly";
  status: "pending" | "active" | "expired" | "rejected";
  start_date: string | null;
  end_date: string | null;
  transaction_id: string | null;
  proof_url: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  members?: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

const statusVariant: Record<PreservationSubscription["status"], "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  pending: "secondary",
  expired: "outline",
  rejected: "destructive",
};

export default function MemberRecordSubscriptionsPage() {
  const { churchId } = useAuth();
  const queryClient = useQueryClient();

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ["member-record-subscriptions", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from("member_record_subscriptions" as never)
        .select("*, members(full_name, email, phone)")
        .eq("church_id", churchId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data ?? []) as unknown as PreservationSubscription[];
    },
    enabled: !!churchId,
  });

  const metrics = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    return subscriptions.reduce(
      (acc, subscription) => {
        const endDate = subscription.end_date ? new Date(subscription.end_date) : null;
        const isActive = subscription.status === "active" && (!endDate || endDate > now);
        const reviewedDate = subscription.reviewed_at ? new Date(subscription.reviewed_at) : null;

        if (isActive) acc.active += 1;
        if (subscription.status === "expired" || (subscription.status === "active" && endDate && endDate <= now)) {
          acc.expired += 1;
        }
        if (subscription.status === "pending") acc.pending += 1;
        if (subscription.status === "active" && reviewedDate && reviewedDate >= monthStart) {
          acc.monthlyRevenue += Number(subscription.amount ?? RECORD_PRESERVATION_AMOUNT);
        }

        return acc;
      },
      { active: 0, expired: 0, pending: 0, monthlyRevenue: 0 },
    );
  }, [subscriptions]);

  const reviewSubscription = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await supabase.rpc("review_member_record_subscription" as never, {
        p_subscription_id: id,
        p_approved: approved,
      } as never);

      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["member-record-subscriptions", churchId] });
    },
  });

  const openProof = async (proofPath: string | null) => {
    if (!proofPath) return;
    const { data, error } = await supabase.storage
      .from("record-preservation-proofs")
      .createSignedUrl(proofPath, 60);

    if (!error && data?.signedUrl) {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-serif">Member Preservation Subscriptions</h1>
        <p className="text-sm text-muted-foreground mt-1">Review Digital Record Preservation requests and archive status.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="Active Subscribers" value={metrics.active} icon={Archive} />
        <StatCard title="Expired Subscribers" value={metrics.expired} icon={Archive} />
        <StatCard title="Monthly Preservation Revenue" value={formatTZS(metrics.monthlyRevenue)} icon={Archive} />
        <StatCard title="Pending Approvals" value={metrics.pending} icon={Archive} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Transaction</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Loading preservation subscriptions...
                  </TableCell>
                </TableRow>
              ) : subscriptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No preservation subscriptions yet.
                  </TableCell>
                </TableRow>
              ) : (
                subscriptions.map((subscription) => (
                  <TableRow key={subscription.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{subscription.members?.full_name ?? "Member"}</p>
                        <p className="text-xs text-muted-foreground">
                          {subscription.members?.phone || subscription.members?.email || subscription.member_id}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[subscription.status]}>{subscription.status}</Badge>
                    </TableCell>
                    <TableCell>{formatTZS(Number(subscription.amount ?? RECORD_PRESERVATION_AMOUNT))}</TableCell>
                    <TableCell className="capitalize">{subscription.plan_interval ?? "monthly"}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{subscription.transaction_id || "-"}</TableCell>
                    <TableCell>{subscription.end_date ? new Date(subscription.end_date).toLocaleDateString() : "-"}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!subscription.proof_url}
                          onClick={() => void openProof(subscription.proof_url)}
                        >
                          <Eye className="mr-1 h-3.5 w-3.5" />
                          Proof
                        </Button>
                        {subscription.status === "pending" ? (
                          <>
                            <Button
                              size="sm"
                              disabled={reviewSubscription.isPending}
                              onClick={() => reviewSubscription.mutate({ id: subscription.id, approved: true })}
                            >
                              {reviewSubscription.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={reviewSubscription.isPending}
                              onClick={() => reviewSubscription.mutate({ id: subscription.id, approved: false })}
                            >
                              <XCircle className="mr-1 h-3.5 w-3.5" />
                              Reject
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
