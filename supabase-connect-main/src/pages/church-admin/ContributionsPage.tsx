import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, HandCoins, TrendingUp, Receipt, Loader2, Pencil, Trash2, MoreHorizontal, QrCode, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { StatCard } from "@/components/church-admin/StatCard";
import { ContributionForm, type ContributionFormValues } from "@/components/church-admin/ContributionForm";
import { formatTZS } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { clearOfflineDraft } from "@/lib/offline-drafts";
import { enqueueOfflineSyncAction, isOfflineSyncActionType, processOfflineSyncQueue, removeOfflineSyncAction } from "@/lib/offline-sync";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useOfflineSyncQueue } from "@/hooks/useOfflineSyncQueue";
import { readOfflineCache, withOfflineCache } from "@/lib/offline-cache";
import { useTranslation } from "react-i18next";
import { translateContributionCategory } from "@/lib/translation-helpers";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";
import { PaginationFooter } from "@/components/ui/pagination-footer";

type PendingPublicGivingSubmission = {
  submission_id: string;
  church_id: string;
  contribution_type: string;
  amount: number | string;
  currency: string;
  donor_name: string;
  phone: string | null;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
};

type PublicGivingReviewResult = {
  success?: boolean;
  submission_id?: string;
  contribution_id?: string;
  status?: "approved" | "rejected" | string;
  error?: string;
};

type PublicGivingRpcName =
  | "list_pending_public_giving_submissions"
  | "approve_public_giving_submission"
  | "reject_public_giving_submission";

async function callPublicGivingRpc<TData>(name: PublicGivingRpcName, args: Record<string, unknown>): Promise<TData> {
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) throw error;
  return data as unknown as TData;
}

function normalizePendingSubmission(row: unknown): PendingPublicGivingSubmission {
  if (!row || typeof row !== "object") {
    throw new Error("Pending submission response was not valid.");
  }

  const value = row as Partial<PendingPublicGivingSubmission>;
  if (
    typeof value.submission_id !== "string" ||
    typeof value.church_id !== "string" ||
    typeof value.contribution_type !== "string" ||
    (typeof value.amount !== "number" && typeof value.amount !== "string") ||
    typeof value.currency !== "string" ||
    typeof value.donor_name !== "string" ||
    typeof value.created_at !== "string"
  ) {
    throw new Error("Pending submission response was missing required fields.");
  }

  return {
    submission_id: value.submission_id,
    church_id: value.church_id,
    contribution_type: value.contribution_type,
    amount: value.amount,
    currency: value.currency,
    donor_name: value.donor_name,
    phone: value.phone ?? null,
    payment_reference: value.payment_reference ?? null,
    notes: value.notes ?? null,
    created_at: value.created_at,
  };
}

function normalizeReviewResult(data: unknown, expectedStatus: "approved" | "rejected"): PublicGivingReviewResult {
  if (!data || typeof data !== "object") {
    throw new Error(`Submission was not ${expectedStatus}.`);
  }

  const result = data as PublicGivingReviewResult;
  if (result.success !== true || result.status !== expectedStatus || typeof result.submission_id !== "string") {
    throw new Error(result.error || `Submission was not ${expectedStatus}.`);
  }
  return result;
}

function isStaleReviewError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /already been reviewed|not found|no longer exists/i.test(message);
}

const pendingPublicGivingRpc = {
  async list(churchId: string) {
    const data = await callPublicGivingRpc<unknown[]>("list_pending_public_giving_submissions", {
      p_church_id: churchId,
    });

    return (data ?? []).map(normalizePendingSubmission);
  },

  async approve(submissionId: string) {
    const data = await callPublicGivingRpc<unknown>("approve_public_giving_submission", {
      p_submission_id: submissionId,
      p_payment_verified: true,
    });

    return normalizeReviewResult(data, "approved");
  },

  async reject(submissionId: string, reason: string) {
    const data = await callPublicGivingRpc<unknown>("reject_public_giving_submission", {
      p_submission_id: submissionId,
      p_reason: reason,
    });

    return normalizeReviewResult(data, "rejected");
  },
};

export default function ContributionsPage() {
  const [activeTab, setActiveTab] = useState("recorded");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<any>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [editingContrib, setEditingContrib] = useState<any>(null);
  const [approvalDialog, setApprovalDialog] = useState<PendingPublicGivingSubmission | null>(null);
  const [approvalVerified, setApprovalVerified] = useState(false);
  const [rejectionDialog, setRejectionDialog] = useState<PendingPublicGivingSubmission | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [contributions, setContributions] = useState<any[]>([]);
  const [pledgePayments, setPledgePayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isSyncingPending, setIsSyncingPending] = useState(false);
  const [transactionTotalCount, setTransactionTotalCount] = useState(0);

  const { churchId, user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const approvePublicGivingInFlightRef = useRef(false);
  const rejectPublicGivingInFlightRef = useRef(false);
  const offlineQueue = useOfflineSyncQueue();
  const contributionsCacheKey = churchId ? `offline-cache:church-contributions:${churchId}` : null;
  const pledgePaymentsCacheKey = churchId ? `offline-cache:church-pledge-payments:${churchId}` : null;
  const pagination = usePaginatedQuery({ totalCount: transactionTotalCount, resetKey: churchId });
  const pendingQueryKey = ["public-giving-pending-submissions", churchId, user?.id];

  const pendingPublicGiving = useQuery({
    queryKey: pendingQueryKey,
    queryFn: async () => {
      if (!churchId || !user?.id) return [];
      if (!isOnline) throw new Error("Pending verification requires an active internet connection.");
      return pendingPublicGivingRpc.list(churchId);
    },
    enabled: !!churchId && !!user?.id && isOnline,
    retry: 1,
  });

  const fetchContributions = useCallback(async () => {
    setIsLoading(true);

    if (!churchId) {
      setContributions([]);
      setPledgePayments([]);
      setTransactionTotalCount(0);
      setIsLoading(false);
      return;
    }

    const cachedContributions = readOfflineCache(contributionsCacheKey, [] as any[]);
    const cachedPledges = readOfflineCache(pledgePaymentsCacheKey, [] as any[]);

    if (cachedContributions.length > 0 || cachedPledges.length > 0) {
      setContributions(cachedContributions);
      setPledgePayments(cachedPledges);
      setTransactionTotalCount(cachedContributions.length + cachedPledges.length);
      setLastUpdatedAt(new Date());
      setIsLoading(false);
    }

    if (!isOnline) {
      setContributions(cachedContributions);
      setPledgePayments(cachedPledges);
      setTransactionTotalCount(cachedContributions.length + cachedPledges.length);
      setLastUpdatedAt(new Date());
      setIsLoading(false);
      return;
    }

    try {
      const [contributionsResult, pledgeResult] = await Promise.allSettled([
        withOfflineCache(
          contributionsCacheKey,
          async () => {
            const { data, error, count } = await supabase
              .from("contributions")
              .select("*, contribution_categories!contributions_category_id_fkey(name), members!contributions_member_id_fkey(full_name)", { count: "exact" })
              .eq("church_id", churchId)
              .order("created_at", { ascending: false })
              .range(0, pagination.to);

            if (error) throw error;
            return { rows: data || [], count: count ?? 0 };
          },
          { rows: readOfflineCache(contributionsCacheKey, [] as any[]), count: readOfflineCache(contributionsCacheKey, [] as any[]).length },
        ),
        withOfflineCache(
          pledgePaymentsCacheKey,
          async () => {
            const pledgePaymentsResult = await supabase
              .from("pledge_payments")
              .select("id, amount, created_at, payment_method, member_id, members(full_name), pledges!inner(church_id)", { count: "exact" })
              .eq("pledges.church_id", churchId)
              .order("created_at", { ascending: false })
              .range(0, pagination.to);

            if (pledgePaymentsResult.error) throw pledgePaymentsResult.error;

            const sourceIds = (pledgePaymentsResult.data || []).map((payment) => payment.id);
            const pledgeFeesResult = sourceIds.length > 0
              ? await supabase
                .from("platform_fees")
                .select("source_id, net_amount")
                .eq("church_id", churchId)
                .eq("source_type", "pledge_payment")
                .in("source_id", sourceIds)
              : { data: [], error: null };

            if (pledgeFeesResult.error) throw pledgeFeesResult.error;

            const pledgeFeeMap = new Map(
              (pledgeFeesResult.data || []).map((fee) => [fee.source_id, Number(fee.net_amount ?? 0)]),
            );

            return {
              rows: (pledgePaymentsResult.data || []).map((payment) => ({
                ...payment,
                net_amount: pledgeFeeMap.has(payment.id)
                  ? pledgeFeeMap.get(payment.id)
                  : Number((Number(payment.amount || 0) / 1.01).toFixed(2)),
              })),
              count: pledgePaymentsResult.count ?? 0,
            };
          },
          { rows: readOfflineCache(pledgePaymentsCacheKey, [] as any[]), count: readOfflineCache(pledgePaymentsCacheKey, [] as any[]).length },
        ),
      ]);

      let nextTotalCount = 0;

      if (contributionsResult.status === "fulfilled") {
        setContributions(contributionsResult.value.rows);
        nextTotalCount += contributionsResult.value.count;
      } else {
        console.error("Failed to fetch contributions:", contributionsResult.reason);
      }

      if (pledgeResult.status === "fulfilled") {
        setPledgePayments(pledgeResult.value.rows);
        nextTotalCount += pledgeResult.value.count;
      } else {
        console.error("Failed to fetch pledge payments:", pledgeResult.reason);
      }

      setTransactionTotalCount(nextTotalCount);
      setLastUpdatedAt(new Date());
    } finally {
      setIsLoading(false);
    }
  }, [churchId, contributionsCacheKey, isOnline, pagination.to, pledgePaymentsCacheKey]);

  useEffect(() => {
    fetchContributions();
  }, [fetchContributions]);

  useEffect(() => {
    if (!churchId || !isOnline) return;
    fetchContributions();
  }, [churchId, fetchContributions, isOnline, offlineQueue]);

  useEffect(() => {
    setApprovalDialog(null);
    setApprovalVerified(false);
    setRejectionDialog(null);
    setRejectionReason("");
    approvePublicGivingInFlightRef.current = false;
    rejectPublicGivingInFlightRef.current = false;
  }, [churchId, user?.id]);

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

  const createContribution = useMutation({
    mutationFn: async (values: ContributionFormValues) => {
      if (!churchId) throw new Error("No church context");

      if (!isOnline) {
        const queuedAction = enqueueOfflineSyncAction({
          type: "church_contribution_create",
          payload: {
            churchId,
            amount: parseFloat(values.amount),
            memberId: values.member_id || null,
            donorName: values.donor_name || null,
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
        donor_name: values.donor_name || null,
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

      const newAmount = parseFloat(values.amount);
      const contributionId =
        editingContrib?.id ||
        (values as any)?.id ||
        null;

      if (!contributionId) {
        throw new Error("Contribution ID missing");
      }

      const { error } = await supabase.rpc("update_contribution_with_audit" as never, {
        p_contribution_id: contributionId,
        p_amount: newAmount,
        p_category_id: values.category_id || null,
        p_donor_name: values.donor_name || null,
        p_member_id: values.member_id || null,
        p_phone: values.phone || null,
        p_payment_reference: values.payment_reference || null,
        p_notes: values.notes || null,
        p_reason: values.reason.trim(),
      } as never);

      if (error) throw error;
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
                donor_name: values.donor_name || null,
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

      const { data, error } = await supabase.rpc("delete_contribution_with_audit" as never, {
        p_contribution_id: contribution.id,
        p_reason: reason.trim(),
      } as never);

      if (error) throw error;
      if (!data) {
        throw new Error("Contribution was not deleted. It may have already been removed or blocked by permissions.");
      }

      return data as { id: string; amount: number };
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

  const refreshAfterPublicGivingReview = async () => {
    await queryClient.invalidateQueries({ queryKey: pendingQueryKey });
    await fetchContributions();
    queryClient.invalidateQueries({ queryKey: ["contributions"] });
  };

  const approvePublicGiving = useMutation({
    mutationFn: async (submission: PendingPublicGivingSubmission) => {
      if (approvePublicGivingInFlightRef.current) {
        throw new Error("Approval is already in progress.");
      }
      if (!isOnline) throw new Error("Approval requires an active internet connection.");
      if (!churchId || submission.church_id !== churchId) {
        throw new Error("This submission belongs to a different parish. Refresh pending verification and try again.");
      }
      if (!approvalVerified) {
        throw new Error("Confirm independent payment verification before approval.");
      }
      approvePublicGivingInFlightRef.current = true;
      try {
        return await pendingPublicGivingRpc.approve(submission.submission_id);
      } finally {
        approvePublicGivingInFlightRef.current = false;
      }
    },
    onSuccess: async (_, submission) => {
      await refreshAfterPublicGivingReview();
      toast({
        title: "Public giving approved",
        description: `${formatTZS(Number(submission.amount || 0))} is now recorded as confirmed income.`,
      });
      setApprovalDialog(null);
      setApprovalVerified(false);
    },
    onError: async (error: any) => {
      approvePublicGivingInFlightRef.current = false;
      if (isStaleReviewError(error)) {
        await queryClient.invalidateQueries({ queryKey: pendingQueryKey });
      }
      toast({ title: "Approval failed", description: error.message, variant: "destructive" });
    },
  });

  const rejectPublicGiving = useMutation({
    mutationFn: async ({ submission, reason }: { submission: PendingPublicGivingSubmission; reason: string }) => {
      if (rejectPublicGivingInFlightRef.current) {
        throw new Error("Rejection is already in progress.");
      }
      if (!isOnline) throw new Error("Rejection requires an active internet connection.");
      if (!churchId || submission.church_id !== churchId) {
        throw new Error("This submission belongs to a different parish. Refresh pending verification and try again.");
      }
      const trimmedReason = reason.trim();
      if (trimmedReason.length < 5) {
        throw new Error("Add a rejection reason with at least 5 characters.");
      }
      rejectPublicGivingInFlightRef.current = true;
      try {
        return await pendingPublicGivingRpc.reject(submission.submission_id, trimmedReason);
      } finally {
        rejectPublicGivingInFlightRef.current = false;
      }
    },
    onSuccess: async (_, { submission }) => {
      await refreshAfterPublicGivingReview();
      toast({
        title: "Public giving rejected",
        description: `${formatTZS(Number(submission.amount || 0))} remains excluded from confirmed income.`,
      });
      setRejectionDialog(null);
      setRejectionReason("");
    },
    onError: async (error: any) => {
      rejectPublicGivingInFlightRef.current = false;
      if (isStaleReviewError(error)) {
        await queryClient.invalidateQueries({ queryKey: pendingQueryKey });
      }
      toast({ title: "Rejection failed", description: error.message, variant: "destructive" });
    },
  });

  const openEdit = (contribution: any) => {
    setEditingContrib(contribution);
    setEditDialog(true);
  };

  const pendingOfflineContributions = useMemo(() => {
    return offlineQueue
      .filter((item) => isOfflineSyncActionType(item, "church_contribution_create"))
      .filter((item) => item.payload.churchId === churchId)
      .map((item) => {
        const memberName = item.payload.donorName || null;
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
  }, [categories, churchId, offlineQueue]);

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
  const pendingPublicGivingRows = pendingPublicGiving.data ?? [];
  const pendingPublicGivingCount = pendingPublicGivingRows.length;
  const visibleTransactions = useMemo(
    () => transactions.slice(pagination.from, pagination.to + 1),
    [pagination.from, pagination.to, transactions],
  );

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
                churchId={churchId}
                members={[]}
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-transparent p-0 sm:w-auto sm:grid-cols-2">
          <TabsTrigger value="recorded" className="min-h-11 whitespace-normal bg-secondary px-4">
            Recorded Contributions
          </TabsTrigger>
          <TabsTrigger value="pending" className="min-h-11 whitespace-normal bg-secondary px-4">
            Pending Verification
            {pendingPublicGivingCount > 0 ? <Badge className="ml-2">{pendingPublicGivingCount}</Badge> : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recorded" className="mt-0">
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

        <TabsContent value="pending" className="mt-0">
          <Card className="glass-card">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">Pending Public Giving Verification</h2>
                  <p className="text-sm text-muted-foreground">
                    Review donor-submitted gifts for this parish only. A transaction reference is not proof of payment.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!isOnline || pendingPublicGiving.isFetching}
                  onClick={() => pendingPublicGiving.refetch()}
                >
                  {pendingPublicGiving.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Retry
                </Button>
              </div>

              {!isOnline ? (
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
                  Pending verification requires an active online connection.
                </div>
              ) : pendingPublicGiving.isLoading ? (
                <div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading pending submissions...
                </div>
              ) : pendingPublicGiving.isError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                  <p className="text-sm font-medium text-destructive">Pending submissions could not be loaded.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {pendingPublicGiving.error instanceof Error ? pendingPublicGiving.error.message : "Please try again."}
                  </p>
                </div>
              ) : pendingPublicGivingRows.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No pending public giving submissions for this parish.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="hidden overflow-hidden rounded-lg border sm:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Donor</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingPublicGivingRows.map((submission) => (
                          <TableRow key={submission.submission_id}>
                            <TableCell className="font-medium">{submission.donor_name}</TableCell>
                            <TableCell>{submission.contribution_type}</TableCell>
                            <TableCell className="font-medium text-primary">{formatTZS(Number(submission.amount || 0))}</TableCell>
                            <TableCell className="text-muted-foreground">{submission.payment_reference || "N/A"}</TableCell>
                            <TableCell className="text-muted-foreground">{new Date(submission.created_at).toLocaleDateString()}</TableCell>
                            <TableCell><Badge variant="outline">Pending</Badge></TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  aria-label={`Review public giving submission from ${submission.donor_name}`}
                                  onClick={() => { setApprovalDialog(submission); setApprovalVerified(false); }}
                                >
                                  Review
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive"
                                  aria-label={`Reject public giving submission from ${submission.donor_name}`}
                                  onClick={() => { setRejectionDialog(submission); setRejectionReason(""); }}
                                >
                                  Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="space-y-3 sm:hidden">
                    {pendingPublicGivingRows.map((submission) => (
                      <div key={submission.submission_id} className="rounded-lg border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{submission.donor_name}</p>
                            <p className="text-sm text-muted-foreground">{submission.contribution_type}</p>
                          </div>
                          <Badge variant="outline">Pending</Badge>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground">Amount</p>
                            <p className="font-medium text-primary">{formatTZS(Number(submission.amount || 0))}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Submitted</p>
                            <p>{new Date(submission.created_at).toLocaleDateString()}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-muted-foreground">Reference</p>
                            <p className="break-words">{submission.payment_reference || "N/A"}</p>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <Button
                            size="sm"
                            aria-label={`Review public giving submission from ${submission.donor_name}`}
                            onClick={() => { setApprovalDialog(submission); setApprovalVerified(false); }}
                          >
                            Review
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive"
                            aria-label={`Reject public giving submission from ${submission.donor_name}`}
                            onClick={() => { setRejectionDialog(submission); setRejectionReason(""); }}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
            churchId={churchId}
            members={
              editingContrib?.member_id
                ? [{
                    id: editingContrib.member_id,
                    full_name: editingContrib.members?.full_name || editingContrib.donor_name || "Selected member",
                  }]
                : []
            }
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

      <AlertDialog
        open={!!approvalDialog}
        onOpenChange={(open) => {
          if (!open && !approvePublicGiving.isPending) {
            setApprovalDialog(null);
            setApprovalVerified(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve public giving submission?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirm only after checking the church payment account. A donor-entered transaction reference is not proof of payment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {approvalDialog ? (
            <div className="space-y-3 rounded-lg border p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Donor</span>
                <span className="text-right font-medium">{approvalDialog.donor_name}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Type</span>
                <span className="text-right">{approvalDialog.contribution_type}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Amount</span>
                <span className="text-right font-medium text-primary">{formatTZS(Number(approvalDialog.amount || 0))}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Reference</span>
                <span className="break-all text-right">{approvalDialog.payment_reference || "N/A"}</span>
              </div>
            </div>
          ) : null}
          <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
            <Checkbox
              checked={approvalVerified}
              onCheckedChange={(checked) => setApprovalVerified(checked === true)}
              disabled={approvePublicGiving.isPending}
            />
            <span>I have independently verified that this payment was received in the church&apos;s payment account.</span>
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approvePublicGiving.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!approvalVerified || approvePublicGiving.isPending || !approvalDialog || !isOnline}
              onClick={(event) => {
                event.preventDefault();
                if (!approvalDialog) return;
                if (approvePublicGivingInFlightRef.current || approvePublicGiving.isPending) return;
                approvePublicGiving.mutate(approvalDialog);
              }}
            >
              {approvePublicGiving.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!rejectionDialog}
        onOpenChange={(open) => {
          if (!open && !rejectPublicGiving.isPending) {
            setRejectionDialog(null);
            setRejectionReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject public giving submission?</AlertDialogTitle>
            <AlertDialogDescription>
              Rejected submissions will not become confirmed income. Provide a clear reason before continuing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {rejectionDialog ? (
            <div className="rounded-lg border p-4 text-sm">
              <p className="font-medium">{rejectionDialog.donor_name}</p>
              <p className="mt-1 text-muted-foreground">
                {rejectionDialog.contribution_type} - {formatTZS(Number(rejectionDialog.amount || 0))}
              </p>
              <p className="mt-1 break-all text-muted-foreground">Reference: {rejectionDialog.payment_reference || "N/A"}</p>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label className="text-warning">Rejection reason *</Label>
            <Textarea
              placeholder="Why is this submission being rejected?"
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              disabled={rejectPublicGiving.isPending}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rejectPublicGiving.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={rejectionReason.trim().length < 5 || rejectPublicGiving.isPending || !rejectionDialog || !isOnline}
              onClick={(event) => {
                event.preventDefault();
                if (!rejectionDialog) return;
                if (rejectPublicGivingInFlightRef.current || rejectPublicGiving.isPending) return;
                rejectPublicGiving.mutate({ submission: rejectionDialog, reason: rejectionReason });
              }}
            >
              {rejectPublicGiving.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
