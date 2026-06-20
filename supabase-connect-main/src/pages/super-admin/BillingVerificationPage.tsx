import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, ExternalLink, Receipt, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/church-admin/StatCard";
import { getPlanDefinition } from "@/lib/billing";
import { formatTZS } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";
import { logSupabaseError } from "@/lib/error-logger";

type PaymentRequest = {
  id: string;
  church_id: string;
  churches: { name: string } | null;
  plan: "basic" | "intermediate" | "pro" | "enterprise";
  amount: number;
  payment_method: string;
  payment_reference: string;
  payer_phone: string | null;
  receipt_url: string | null;
  status: "pending" | "approved" | "rejected";
  verified_at: string | null;
  rejection_reason: string | null;
  created_at: string;
};

function paymentStatusStyle(status: PaymentRequest["status"]) {
  if (status === "approved") return "border-success/30 bg-success/20 text-success";
  if (status === "rejected") return "border-destructive/30 bg-destructive/20 text-destructive";
  return "border-primary/30 bg-primary/20 text-primary";
}

export default function BillingVerificationPage() {
  const queryClient = useQueryClient();
  const [rejectingPayment, setRejectingPayment] = useState<PaymentRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: requests = [], isLoading, isError, error } = useQuery({
    queryKey: ["billing-verification-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_payments")
        .select("*, churches(name)")
        .order("created_at", { ascending: false });

      if (error) {
        logSupabaseError(error, {
          page: "Billing Verification",
          component: "BillingVerificationPage",
          function: "loadPaymentRequests",
          operation: "select",
          table: "subscription_payments",
        });
        throw error;
      }
      return (data ?? []) as PaymentRequest[];
    },
  });

  const reviewPayment = useMutation({
    mutationFn: async ({ paymentId, approved, reason }: { paymentId: string; approved: boolean; reason?: string }) => {
      const { error } = await supabase.rpc("review_subscription_payment", {
        _payment_id: paymentId,
        _approved: approved,
        _rejection_reason: reason || null,
      });
      if (error) {
        logSupabaseError(error, {
          page: "Billing Verification",
          component: "BillingVerificationPage",
          function: "reviewPayment",
          operation: "rpc",
          rpc: "review_subscription_payment",
          metadata: { paymentId, approved },
        });
        throw error;
      }
    },
    onSuccess: async (_, variables) => {
      toast.success(variables.approved ? "Payment approved and subscription activated." : "Payment rejected.");
      setRejectingPayment(null);
      setRejectionReason("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["billing-verification-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["sa-subscriptions"] }),
      ]);
    },
    onError: (reviewError: Error) => {
      toast.error(reviewError.message || "Unable to review payment.");
    },
  });

  const viewReceipt = async (receiptPath: string) => {
    const { data, error } = await supabase.storage
      .from("billing-receipts")
      .createSignedUrl(receiptPath, 60);

    if (error || !data?.signedUrl) {
      if (error) {
        logSupabaseError(error, {
          page: "Billing Verification",
          component: "BillingVerificationPage",
          function: "viewReceipt",
          operation: "storage.createSignedUrl",
          bucket: "billing-receipts",
          metadata: { receiptPath },
        });
      }
      toast.error(error?.message || "Unable to open receipt.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const pendingRequests = requests.filter((request) => request.status === "pending");
  const approvedRequests = requests.filter((request) => request.status === "approved");
  const rejectedRequests = requests.filter((request) => request.status === "rejected");

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-serif">Billing Verification</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify Lipa Namba payment submissions before activating church subscription upgrades.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard title="Pending Review" value={pendingRequests.length} icon={Clock} />
        <StatCard title="Approved" value={approvedRequests.length} icon={CheckCircle2} />
        <StatCard title="Rejected" value={rejectedRequests.length} icon={XCircle} />
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Church</TableHead>
                <TableHead>Plan / Amount</TableHead>
                <TableHead>Payment Reference</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Receipt</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">Loading payment requests...</TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-destructive">
                    Unable to load payment requests: {(error as Error)?.message || "Unknown error"}
                  </TableCell>
                </TableRow>
              ) : requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Receipt className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    No billing payment submissions yet.
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((request) => {
                  const reviewing = reviewPayment.isPending && reviewPayment.variables?.paymentId === request.id;
                  return (
                    <TableRow key={request.id} className="border-border">
                      <TableCell className="font-medium">
                        {request.churches?.name || request.church_id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <p>{getPlanDefinition(request.plan).name}</p>
                        <p className="text-xs text-muted-foreground">{formatTZS(Number(request.amount))}</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{request.payment_reference}</p>
                        <p className="text-xs text-muted-foreground">{request.payer_phone || "No phone supplied"}</p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(request.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={paymentStatusStyle(request.status)}>
                          {request.status}
                        </Badge>
                        {request.status === "rejected" && request.rejection_reason && (
                          <p className="mt-1 max-w-48 text-xs text-muted-foreground">{request.rejection_reason}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        {request.receipt_url ? (
                          <Button variant="ghost" size="sm" onClick={() => void viewReceipt(request.receipt_url!)}>
                            <ExternalLink className="mr-1 h-3.5 w-3.5" />
                            View
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {request.status === "pending" ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => reviewPayment.mutate({ paymentId: request.id, approved: true })}
                              disabled={reviewing}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRejectingPayment(request)}
                              disabled={reviewing}
                            >
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {request.verified_at ? new Date(request.verified_at).toLocaleDateString() : "-"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!rejectingPayment} onOpenChange={(open) => !open && setRejectingPayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payment Submission</DialogTitle>
            <DialogDescription>
              Provide a reason so the church administrator knows what to correct before resubmitting.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            placeholder="e.g. Transaction reference could not be verified."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingPayment(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => rejectingPayment && reviewPayment.mutate({
                paymentId: rejectingPayment.id,
                approved: false,
                reason: rejectionReason.trim(),
              })}
              disabled={!rejectingPayment || reviewPayment.isPending}
            >
              Reject Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
