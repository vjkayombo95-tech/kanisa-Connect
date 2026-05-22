import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, HandCoins, TrendingUp, Receipt, Loader2, Pencil, Trash2, MoreHorizontal, QrCode } from "lucide-react";
import { StatCard } from "@/components/church-admin/StatCard";
import { ContributionForm, type ContributionFormValues } from "@/components/church-admin/ContributionForm";
import { formatTZS } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { clearOfflineDraft } from "@/lib/offline-drafts";
import { enqueueOfflineSyncAction, processOfflineSyncQueue, removeOfflineSyncAction } from "@/lib/offline-sync";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useOfflineSyncQueue } from "@/hooks/useOfflineSyncQueue";
import { readOfflineCache, withOfflineCache } from "@/lib/offline-cache";
import { useTranslation } from "react-i18next";
import { translateContributionCategory } from "@/lib/translation-helpers";

export default function ContributionsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<any>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [editingContrib, setEditingContrib] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [contributions, setContributions] = useState<any[]>([]);
  const [pledgePayments, setPledgePayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isSyncingPending, setIsSyncingPending] = useState(false);

  const { churchId, user, profile } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const offlineQueue = useOfflineSyncQueue();
  const contributionsCacheKey = churchId ? `offline-cache:church-contributions:${churchId}` : null;
  const pledgePaymentsCacheKey = churchId ? `offline-cache:church-pledge-payments:${churchId}` : null;
  const membersCacheKey = churchId ? `offline-cache:church-members-select:${churchId}` : null;

  const fetchContributions = useCallback(async () => {
    setIsLoading(true);

    if (!churchId) {
      setContributions([]);
      setPledgePayments([]);
      setIsLoading(false);
      return;
    }

    const cachedContributions = readOfflineCache(contributionsCacheKey, [] as any[]);
    const cachedPledges = readOfflineCache(pledgePaymentsCacheKey, [] as any[]);

    if (cachedContributions.length > 0 || cachedPledges.length > 0) {
      setContributions(cachedContributions);
      setPledgePayments(cachedPledges);
      setLastUpdatedAt(new Date());
      setIsLoading(false);
    }

    if (!isOnline) {
      setContributions(cachedContributions);
      setPledgePayments(cachedPledges);
      setLastUpdatedAt(new Date());
      setIsLoading(false);
      return;
    }

    try {
      const [contributionsResult, pledgeResult] = await Promise.allSettled([
        withOfflineCache(
          contributionsCacheKey,
          async () => {
            const { data, error } = await supabase
              .from("contributions")
              .select("*, contribution_categories!contributions_category_id_fkey(name), members!contributions_member_id_fkey(full_name)")
              .eq("church_id", churchId)
              .order("created_at", { ascending: false });

            if (error) throw error;
            return data || [];
          },
          readOfflineCache(contributionsCacheKey, [] as any[]),
        ),
        withOfflineCache(
          pledgePaymentsCacheKey,
          async () => {
            const [pledgePaymentsResult, pledgeFeesResult] = await Promise.all([
              supabase
                .from("pledge_payments")
                .select("id, amount, created_at, payment_method, member_id, members(full_name), pledges!inner(church_id)")
                .eq("pledges.church_id", churchId)
                .order("created_at", { ascending: false }),
              supabase
                .from("platform_fees")
                .select("source_id, net_amount")
                .eq("church_id", churchId)
                .eq("source_type", "pledge_payment"),
            ]);

            if (pledgePaymentsResult.error) throw pledgePaymentsResult.error;
            if (pledgeFeesResult.error) throw pledgeFeesResult.error;

            const pledgeFeeMap = new Map(
              (pledgeFeesResult.data || []).map((fee) => [fee.source_id, Number(fee.net_amount ?? 0)]),
            );

            return (pledgePaymentsResult.data || []).map((payment) => ({
              ...payment,
              net_amount: pledgeFeeMap.has(payment.id)
                ? pledgeFeeMap.get(payment.id)
                : Number((Number(payment.amount || 0) / 1.01).toFixed(2)),
            }));
          },
          readOfflineCache(pledgePaymentsCacheKey, [] as any[]),
        ),
      ]);

      if (contributionsResult.status === "fulfilled") {
        setContributions(contributionsResult.value);
      } else {
        console.error("Failed to fetch contributions:", contributionsResult.reason);
      }

      if (pledgeResult.status === "fulfilled") {
        setPledgePayments(pledgeResult.value);
      } else {
        console.error("Failed to fetch pledge payments:", pledgeResult.reason);
      }

      setLastUpdatedAt(new Date());
    } finally {
      setIsLoading(false);
    }
  }, [churchId, contributionsCacheKey, isOnline, pledgePaymentsCacheKey]);

  useEffect(() => {
    fetchContributions();
  }, [fetchContributions]);

  useEffect(() => {
    if (!churchId || !isOnline) return;
    fetchContributions();
  }, [churchId, fetchContributions, isOnline, offlineQueue]);

  useEffect(() => {
    if (!churchId) return;

    const fetchCategories = async () => {
      if (!isOnline) return;
      const { data, error } = await supabase
        .from("contribution_categories")
        .select("*");

      if (!error) {
        setCategories(data || []);
      }
    };

    fetchCategories();
  }, [churchId, isOnline]);

  const { data: members = [] } = useQuery({
    queryKey: ["members-select", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      if (!isOnline) {
        return readOfflineCache(membersCacheKey, [] as any[]);
      }
      return withOfflineCache(
        membersCacheKey,
        async () => {
          const { data, error } = await supabase
            .from("members")
            .select("id, full_name")
            .eq("church_id", churchId)
            .eq("status", "active")
            .order("full_name");
          if (error) throw error;
          return data ?? [];
        },
        readOfflineCache(membersCacheKey, [] as any[]),
      );
    },
    enabled: !!churchId,
  });

  const createContribution = useMutation({
    mutationFn: async (values: ContributionFormValues) => {
      if (!churchId) throw new Error("No church context");
      const selectedMember = members.find((member) => member.id === values.member_id);

      if (!isOnline) {
        const queuedAction = enqueueOfflineSyncAction({
          type: "church_contribution_create",
          payload: {
            churchId,
            amount: parseFloat(values.amount),
            memberId: values.member_id || null,
            donorName: values.member_id ? selectedMember?.full_name || null : values.donor_name || null,
            phone: values.phone || null,
            paymentReference: values.payment_reference || null,
            categoryId: values.category_id || null,
            createdBy: user?.id || null,
            notes: values.notes || null,
          },
        });
        return { queuedOffline: true, queuedAction };
      }

      const { error } = await supabase.from("contributions").insert({
        church_id: churchId,
        amount: parseFloat(values.amount),
        member_id: values.member_id || null,
        donor_name: values.member_id ? selectedMember?.full_name : values.donor_name || null,
        phone: values.phone || null,
        payment_reference: values.payment_reference || null,
        category_id: values.category_id || null,
        created_by: user?.id || null,
        notes: values.notes || null,
      });

      if (error) throw error;
      return { queuedOffline: false };
    },
    onSuccess: (result, values) => {
      if (!result?.queuedOffline) {
        fetchContributions();
        queryClient.invalidateQueries({ queryKey: ["contributions"] });
      } else {
        setIsLoading(false);
        setLastUpdatedAt(new Date());
      }
      clearOfflineDraft(churchId ? `offline-draft:church-contribution:${churchId}` : null);
      const amount = parseFloat(values.amount || "0");
      toast({
        title: result?.queuedOffline ? "Contribution queued" : "Contribution recorded",
        description: result?.queuedOffline
          ? `${formatTZS(amount)} will sync automatically when the device is back online.`
          : `${formatTZS(amount)} recorded. New total: ${formatTZS(total + amount)}.`,
      });
      setDialogOpen(false);
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updateContribution = useMutation({
    mutationFn: async (values: ContributionFormValues) => {
      if (!editingContrib) throw new Error("Contribution not selected");
      if (!values.reason.trim()) throw new Error("Add a reason for this edit before saving.");

      const selectedMember = members.find((member) => member.id === values.member_id);
      const newAmount = parseFloat(values.amount);
      const contributionId =
        editingContrib?.id ||
        (values as any)?.id ||
        null;

      if (!contributionId) {
        throw new Error("Contribution ID missing");
      }

      const safeEntityId =
        typeof contributionId === "string" && contributionId.length > 10
          ? contributionId
          : null;

      const { data: existingContribution, error: existingContributionError } = await supabase
        .from("contributions")
        .select("amount")
        .eq("id", contributionId)
        .maybeSingle();

      if (existingContributionError) throw existingContributionError;

      const oldAmount = Number(existingContribution?.amount ?? 0);

      const { error } = await supabase
        .from("contributions")
        .update({
          amount: newAmount,
          category_id: values.category_id || null,
          donor_name: values.member_id ? selectedMember?.full_name : values.donor_name || null,
          member_id: values.member_id || null,
          phone: values.phone || null,
          payment_reference: values.payment_reference || null,
          notes: values.notes || null,
        })
        .eq("id", contributionId);

      if (error) throw error;

      const auditPayload = {
        user_id: profile?.id ?? null,
        action: "UPDATE",
        details: `Changed amount from ${existingContribution?.amount || 0} to ${newAmount}`,
        entity: "contributions",
        entity_id: safeEntityId,
      };

      const { error: auditError } = await supabase
        .from("audit_logs")
        .insert(auditPayload);

      if (auditError) {
        console.error("Audit log insert failed:", auditError);
      }
    },
    onSuccess: (_, values) => {
      const previousAmount = Number(editingContrib?.amount ?? 0);
      const updatedAmount = parseFloat(values.amount || "0");
      setContributions((current) =>
        current.map((contribution) =>
          contribution.id === editingContrib?.id
            ? {
                ...contribution,
                amount: updatedAmount,
                category_id: values.category_id || null,
                donor_name: values.member_id
                  ? members.find((member) => member.id === values.member_id)?.full_name || contribution.donor_name
                  : values.donor_name || null,
                member_id: values.member_id || null,
                phone: values.phone || null,
                payment_reference: values.payment_reference || null,
                notes: values.notes || null,
              }
            : contribution,
        ),
      );
      fetchContributions();
      queryClient.invalidateQueries({ queryKey: ["contributions"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      toast({
        title: "Contribution updated",
        description: `Changed ${formatTZS(previousAmount)} to ${formatTZS(updatedAmount)}. New total: ${formatTZS(total - previousAmount + updatedAmount)}.`,
      });
      setEditDialog(false);
      setEditingContrib(null);
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const deleteContribution = useMutation({
    mutationFn: async ({ contribution, reason }: { contribution: any; reason: string }) => {
      if (!contribution) throw new Error("Contribution not selected");
      if (!reason.trim()) throw new Error("Add a reason for deletion before continuing.");

      const { error: auditError } = await supabase.from("audit_logs").insert({
        user_id: profile?.id ?? null,
        action: "DELETE",
        details: `Deleted contribution of ${contribution.amount}`,
        entity: "contributions",
        entity_id: contribution.id,
      });

      if (auditError) {
        console.error("Audit log insert failed:", auditError);
      }

      const { data: deletedRows, error } = await supabase
        .from("contributions")
        .delete()
        .eq("id", contribution.id)
        .eq("church_id", churchId)
        .select("id, amount");

      if (error) throw error;
      if (!deletedRows || deletedRows.length === 0) {
        throw new Error("Contribution was not deleted. It may have already been removed or blocked by permissions.");
      }

      return deletedRows[0];
    },
    onSuccess: (deletedRow) => {
      const deletedId = deletedRow.id;
      const deletedAmount = Number(deletedRow.amount ?? 0);
      setContributions((current) => current.filter((contribution) => contribution.id !== deletedId));
      fetchContributions();
      queryClient.invalidateQueries({ queryKey: ["contributions"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      toast({
        title: "Contribution deleted",
        description: `Deleted ${formatTZS(deletedAmount)}. New total: ${formatTZS(total - deletedAmount)}.`,
      });
      setDeleteDialog(null);
      setDeleteReason("");
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const openEdit = (contribution: any) => {
    setEditingContrib(contribution);
    setEditDialog(true);
  };

  const pendingOfflineContributions = useMemo(() => {
    return offlineQueue
      .filter((item) => item.type === "church_contribution_create" && item.payload.churchId === churchId)
      .map((item) => {
        const memberName = item.payload.memberId
          ? members.find((member) => member.id === item.payload.memberId)?.full_name || null
          : null;
        const categoryName = item.payload.categoryId
          ? categories.find((category) => category.id === item.payload.categoryId)?.name || null
          : null;

        return {
          id: `offline-${item.id}`,
          offlineQueueId: item.id,
          amount: Number(item.payload.amount || 0),
          created_at: item.createdAt,
          donor_name: memberName || item.payload.donorName || "Pending donor",
          payment_reference: item.payload.paymentReference || "Offline queue",
          notes: item.payload.notes || null,
          contribution_categories: categoryName ? { name: categoryName } : null,
          members: memberName ? { full_name: memberName } : null,
          isOfflinePending: true,
        };
      });
  }, [categories, churchId, members, offlineQueue]);

  const transactions = useMemo(() => {
    const deriveSourceLabel = (contribution: any) => {
      if (contribution.isOfflinePending) {
        return "Pending Sync";
      }

      if (contribution.contribution_categories?.name) {
        return translateContributionCategory(t, contribution.contribution_categories.name, "full");
      }

      const notes = String(contribution.notes || "").toLowerCase();

      if (notes.startsWith("prayer request offering")) return "Prayer Request";
      if (notes.startsWith("mass intention:")) return "Mass Intention";
      if (notes.startsWith("community help donation")) return "Community Help";

      return "General";
    };

    const contributionRows = [...pendingOfflineContributions, ...contributions].map((contribution) => ({
      ...contribution,
      transactionType: contribution.isOfflinePending ? ("pending_contribution" as const) : ("contribution" as const),
      rowId: `contribution-${contribution.id}`,
      donorDisplayName: contribution.members?.full_name || contribution.donor_name || "Anonymous",
      sourceLabel: deriveSourceLabel(contribution),
      referenceLabel: contribution.payment_reference || "—",
      payment_reference: contribution.payment_reference || "—",
      transactionDate: contribution.date || contribution.created_at,
      amountValue: Number(contribution.amount || 0),
    }));

    const pledgeRows = pledgePayments.map((payment) => ({
      ...payment,
      transactionType: "pledge_payment" as const,
      rowId: `pledge-${payment.id}`,
      donorDisplayName: payment.members?.full_name || "Anonymous",
      sourceLabel: "Pledge Payment",
      referenceLabel: payment.payment_method || "—",
      payment_reference: payment.payment_method || "—",
      transactionDate: payment.created_at,
      amountValue: Number(payment.net_amount ?? payment.amount ?? 0),
    }));

    return [...contributionRows, ...pledgeRows].sort(
      (left, right) => new Date(right.transactionDate).getTime() - new Date(left.transactionDate).getTime(),
    );
  }, [contributions, pendingOfflineContributions, pledgePayments, t]);

  const pendingContributionCount = pendingOfflineContributions.length;
  const visibleTransactions = transactions;

  const { total, thisMonth } = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    const totalAmount = visibleTransactions.reduce((sum: number, contribution: any) => sum + contribution.amountValue, 0);
    const monthAmount = visibleTransactions
      .filter((contribution: any) => {
        const contributionDate = new Date(contribution.transactionDate);
        return contributionDate.getMonth() === month && contributionDate.getFullYear() === year;
      })
      .reduce((sum: number, contribution: any) => sum + contribution.amountValue, 0);

    return { total: totalAmount, thisMonth: monthAmount };
  }, [visibleTransactions]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif">Contributions</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage giving and contributions</p>
          {lastUpdatedAt ? (
            <p className="text-xs text-muted-foreground mt-1">
              Last updated {lastUpdatedAt.toLocaleTimeString()}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to="/church-admin/qr-payments">
              <QrCode className="mr-2 h-4 w-4" /> QR Payments
            </Link>
          </Button>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" /> Record Contribution
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-serif">Record Contribution</DialogTitle>
                <DialogDescription>Fill out the contribution details and submit.</DialogDescription>
              </DialogHeader>
              <ContributionForm
                isEdit={false}
                members={members}
                categories={categories}
                draftStorageKey={churchId ? `offline-draft:church-contribution:${churchId}` : undefined}
                isSubmitting={createContribution.isPending && isOnline}
                onCancel={() => setDialogOpen(false)}
                onSubmit={(values) => {
                  if (!isOnline) {
                    setDialogOpen(false);
                  }
                  createContribution.mutate(values);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Contributions" value={formatTZS(total)} icon={HandCoins} />
        <StatCard title="This Month" value={formatTZS(thisMonth)} icon={TrendingUp} />
        <StatCard title="Transactions" value={visibleTransactions.length} icon={Receipt} />
      </div>

      {pendingContributionCount > 0 ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-sm font-medium">Offline contribution queue</p>
              <p className="text-sm text-muted-foreground">
                {pendingContributionCount} contribution {pendingContributionCount === 1 ? "is" : "are"} waiting to sync when internet returns.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{pendingContributionCount} pending</Badge>
              <Button
                size="sm"
                variant="outline"
                disabled={!isOnline || isSyncingPending}
                onClick={async () => {
                  setIsSyncingPending(true);
                  const result = await processOfflineSyncQueue(queryClient);
                  setIsSyncingPending(false);
                  if (result.processedCount === 0 && result.error) {
                    toast({ title: "Sync failed", description: result.error.message, variant: "destructive" });
                  }
                }}
              >
                {isSyncingPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                Sync now
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead>Donor</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && visibleTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : visibleTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No contributions recorded yet.</TableCell>
                </TableRow>
              ) : (
                visibleTransactions.map((contribution: any) => (
                  <TableRow key={contribution.rowId} className="border-border">
                    <TableCell className="font-medium">{contribution.donorDisplayName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{contribution.sourceLabel}</Badge>
                    </TableCell>
                    <TableCell className="font-medium text-primary">{formatTZS(contribution.amountValue)}</TableCell>
                    <TableCell className="text-muted-foreground">{contribution.payment_reference || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(contribution.transactionDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {contribution.transactionType === "contribution" ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(contribution)}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog(contribution)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : contribution.transactionType === "pending_contribution" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => removeOfflineSyncAction(contribution.offlineQueueId)}
                        >
                          Remove
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Auto</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={editDialog}
        onOpenChange={(open) => {
          setEditDialog(open);
          if (!open) setEditingContrib(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Edit Contribution</DialogTitle>
            <DialogDescription>Update fields and provide a reason for the change.</DialogDescription>
          </DialogHeader>
          <ContributionForm
            isEdit
            members={members}
            categories={categories}
            initialValues={
              editingContrib
                ? {
                    member_id: editingContrib.member_id || "",
                    donor_name: editingContrib.donor_name || "",
                    category_id: editingContrib.category_id || "",
                    amount: String(editingContrib.amount || ""),
                    phone: editingContrib.phone || "",
                    payment_reference: editingContrib.payment_reference || "",
                    notes: editingContrib.notes || "",
                  }
                : undefined
            }
            isSubmitting={updateContribution.isPending}
            onCancel={() => {
              setEditDialog(false);
              setEditingContrib(null);
            }}
            onSubmit={(values) => {
              if (!values.reason.trim()) {
                toast({ title: "Reason required", description: "Add a reason for this edit before saving.", variant: "destructive" });
                return;
              }
              updateContribution.mutate(values);
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteDialog}
        onOpenChange={(open) => {
          if (!open && !deleteContribution.isPending) {
            setDeleteDialog(null);
            setDeleteReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contribution?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the contribution of {deleteDialog ? formatTZS(deleteDialog.amount) : ""} from {deleteDialog?.donor_name || "Anonymous"}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-warning">Reason for Deletion *</Label>
            <Textarea
              placeholder="Why is this contribution being deleted?"
              value={deleteReason}
              onChange={(event) => setDeleteReason(event.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!deleteReason.trim() || deleteContribution.isPending}
              onClick={(event) => {
                if (!deleteReason.trim()) {
                  event.preventDefault();
                  toast({ title: "Reason required", description: "Add a reason for deletion before continuing.", variant: "destructive" });
                  return;
                }
                event.preventDefault();
                deleteContribution.mutate({ contribution: deleteDialog, reason: deleteReason });
              }}
            >
              {deleteContribution.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
