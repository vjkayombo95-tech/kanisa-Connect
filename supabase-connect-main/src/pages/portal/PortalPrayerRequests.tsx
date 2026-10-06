import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Heart, Loader2, MessageCircle, Plus, Star, User } from "lucide-react";
import { formatTZS } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { PRAYER_REQUEST_SELECT, mapPrayerRequestRecord, submitPortalPrayerRequest, type PrayerRequestPrivacy, type PrayerRequestWithMember } from "@/lib/prayer-requests";
import { clearOfflineDraft, readOfflineDraft, writeOfflineDraft } from "@/lib/offline-drafts";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { enqueueOfflineSyncAction, isOfflineSyncActionType, processOfflineSyncQueue, removeOfflineSyncAction } from "@/lib/offline-sync";
import { useOfflineSyncQueue } from "@/hooks/useOfflineSyncQueue";
import { readOfflineCache, withOfflineCache } from "@/lib/offline-cache";
import { CommentThread, type CommentReactionSummary, type ThreadComment } from "@/components/portal/CommentThread";
import { assertClientRateLimit } from "@/lib/client-rate-limit";
import { logSupabaseError } from "@/lib/error-logger";
import { formatAppDate } from "@/lib/localization";

const QUICK_COMMENT_EMOJIS = ["🙏", "❤️", "🙌", "🕊️"];

const PRAYER_PRIVACY_OPTIONS: Array<{
  value: PrayerRequestPrivacy;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    value: "public_to_church",
    labelKey: "member_prayer_requests.privacy.public_to_church.label",
    descriptionKey: "member_prayer_requests.privacy.public_to_church.description",
  },
  {
    value: "private_to_pastor_admin",
    labelKey: "member_prayer_requests.privacy.private_to_pastor_admin.label",
    descriptionKey: "member_prayer_requests.privacy.private_to_pastor_admin.description",
  },
  {
    value: "anonymous_public",
    labelKey: "member_prayer_requests.privacy.anonymous_public.label",
    descriptionKey: "member_prayer_requests.privacy.anonymous_public.description",
  },
];

function useMemberRecord() {
  const { user, churchId } = useAuth();
  const { isOnline } = useNetworkStatus();

  return useQuery({
    queryKey: ["my-member-record", user?.id, churchId],
    queryFn: async () => {
      if (!user || !churchId) return null;
      if (!isOnline) return null;
      const { data } = await supabase
        .from("members")
        .select("id, full_name")
        .eq("user_id", user.id)
        .eq("church_id", churchId)
        .maybeSingle();
      return data;
    },
    enabled: !!user && !!churchId,
  });
}

function PrayerRequestCard({
  request,
  member,
  churchId,
  prayerStats,
  queryClient,
}: {
  request: any;
  member: { id: string; full_name: string } | null | undefined;
  churchId: string | null;
  prayerStats: { count: number; prayedByMe: boolean };
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const attemptedPrayerOperation = useRef<"insert" | "delete">("insert");
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  const { data: comments = [] } = useQuery({
    queryKey: ["prayer-request-comments", request.id, user?.id],
    queryFn: async () => {
      const { data: commentRows, error } = await supabase
        .from("prayer_request_comments")
        .select("*")
        .eq("prayer_request_id", request.id)
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      const commentIds = (commentRows ?? []).map((comment) => comment.id);
      const { data: reactionRows, error: reactionsError } = commentIds.length
        ? await supabase
            .from("prayer_request_comment_reactions")
            .select("comment_id, user_id, emoji")
            .in("comment_id", commentIds)
        : { data: [], error: null };

      if (reactionsError) {
        throw reactionsError;
      }

      const groupedReactions = new Map<string, Map<string, Set<string>>>();

      (reactionRows ?? []).forEach((reaction) => {
        if (!groupedReactions.has(reaction.comment_id)) {
          groupedReactions.set(reaction.comment_id, new Map());
        }

        const emojiMap = groupedReactions.get(reaction.comment_id)!;
        if (!emojiMap.has(reaction.emoji)) {
          emojiMap.set(reaction.emoji, new Set());
        }

        emojiMap.get(reaction.emoji)!.add(reaction.user_id);
      });

      return ((commentRows ?? []) as any[]).map((comment) => ({
        id: comment.id,
        author_name: comment.author_name,
        created_at: comment.created_at,
        body: comment.comment,
        reactions: Array.from(groupedReactions.get(comment.id)?.entries() ?? []).map(
          ([emoji, userIds]): CommentReactionSummary => ({
            emoji,
            count: userIds.size,
            reacted: user ? userIds.has(user.id) : false,
          }),
        ),
      })) as ThreadComment[];
    },
    enabled: showComments,
  });

  const togglePrayer = useMutation({
    mutationFn: async () => {
      attemptedPrayerOperation.current = prayerStats.prayedByMe ? "delete" : "insert";

      if (!churchId) throw new Error(t("member_prayer_requests.errors.no_church_context"));
      if (!member?.id) throw new Error(t("member_prayer_requests.errors.member_profile_required"));

      if (prayerStats.prayedByMe) {
        const { error } = await supabase
          .from("prayer_request_prayers")
          .delete()
          .eq("prayer_request_id", request.id)
          .eq("member_id", member.id);

        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("prayer_request_prayers").insert({
        prayer_request_id: request.id,
        church_id: churchId,
        member_id: member.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prayer-request-prayers", churchId] });
      toast({
        title: prayerStats.prayedByMe
          ? t("member_prayer_requests.toasts.prayer_mark_removed")
          : t("member_prayer_requests.toasts.marked_as_prayed"),
      });
    },
    onError: (error: Error) => {
      logSupabaseError(error, {
        page: "Portal Prayer Requests",
        component: "PortalPrayerRequests",
        function: "togglePrayer",
        church_id: churchId,
        operation: attemptedPrayerOperation.current,
        table: "prayer_request_prayers",
        metadata: {
          member_id: member?.id,
          prayer_request_id: request.id,
          prayed_by_me: prayerStats.prayedByMe,
        },
      });
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!churchId) throw new Error(t("member_prayer_requests.errors.no_church_context"));
      if (!commentText.trim()) throw new Error(t("member_prayer_requests.errors.comment_empty"));

      const { error } = await supabase.from("prayer_request_comments").insert({
        prayer_request_id: request.id,
        church_id: churchId,
        member_id: member?.id ?? null,
        author_name: member?.full_name || "Member",
        comment: commentText.trim(),
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prayer-request-comments", request.id] });
      toast({ title: t("member_prayer_requests.toasts.comment_posted") });
      setCommentText("");
      setShowComments(true);
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  const toggleCommentReaction = useMutation({
    mutationFn: async ({
      commentId,
      emoji,
      reacted,
    }: {
      commentId: string;
      emoji: string;
      reacted: boolean;
    }) => {
      if (!user) throw new Error(t("member_prayer_requests.errors.sign_in_to_react"));

      if (reacted) {
        const { error } = await supabase
          .from("prayer_request_comment_reactions")
          .delete()
          .eq("comment_id", commentId)
          .eq("user_id", user.id);

        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from("prayer_request_comment_reactions")
        .upsert({ comment_id: commentId, user_id: user.id, emoji }, {
          onConflict: "comment_id,user_id",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prayer-request-comments", request.id] });
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  const statusTone = (status: string) => {
    if (status === "approved") return "border-success/30 bg-success/10 text-success";
    if (status === "pending") return "border-primary/25 bg-primary/10 text-primary";
    return "border-muted-foreground/20 bg-muted text-muted-foreground";
  };

  const statusLabel = (status: string) => {
    if (status === "approved") return t("member_prayer_requests.status.approved");
    if (status === "pending") return t("member_prayer_requests.status.pending");
    if (status === "rejected") return t("member_prayer_requests.status.rejected");
    return status;
  };

  const statusHelp = (status: string) => {
    if (status === "pending") {
      return t("member_prayer_requests.status_help.pending");
    }
    if (status === "rejected") {
      return t("member_prayer_requests.status_help.rejected");
    }
    return null;
  };

  const requesterName = request.privacy === "anonymous_public" ? t("member_prayer_requests.anonymous_requester") : request.member_name;
  const helpText = statusHelp(request.status);

  return (
    <Card className="min-w-0 max-w-full border-border/70 bg-card/90 shadow-sm">
      <CardContent className="min-w-0 max-w-full space-y-4 p-4 sm:p-5">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 break-words text-sm font-semibold text-foreground">{requesterName}</span>
            <Badge variant="outline" className={`max-w-full whitespace-normal ${statusTone(request.status)}`}>
              {statusLabel(request.status)}
            </Badge>
            {Number(request.offering_amount) > 0 && (
              <Badge variant="outline" className="max-w-full whitespace-normal border-primary/20 bg-primary/5 text-xs text-primary">
                <Star className="mr-1 h-3 w-3" />
                {t("member_prayer_requests.offering.badge")}
              </Badge>
            )}
          </div>
          <p className="whitespace-pre-wrap break-words text-base leading-7 text-foreground">{request.request_text}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{formatAppDate(request.created_at, i18n.language)}</span>
            {Number(request.offering_amount) > 0 && <span>{t("member_prayer_requests.offering.request_amount", { amount: formatTZS(request.offering_amount) })}</span>}
          </div>
          {helpText && <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">{helpText}</p>}
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-2 border-t border-border/60 pt-3 min-[420px]:grid-cols-2 sm:flex sm:flex-wrap sm:items-center">
          <Button
            size="sm"
            variant={prayerStats.prayedByMe ? "default" : "outline"}
            className="min-h-10 min-w-0 max-w-full whitespace-normal text-center leading-snug"
            onClick={() => togglePrayer.mutate()}
            disabled={togglePrayer.isPending || !member?.id}
          >
            {togglePrayer.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Heart className={`h-3.5 w-3.5 ${prayerStats.prayedByMe ? "fill-current" : ""}`} />
            )}
            {prayerStats.prayedByMe ? t("member_prayer_requests.actions.prayed") : t("member_prayer_requests.actions.pray")} ({prayerStats.count})
          </Button>

          <Button size="sm" variant="outline" className="min-h-10 min-w-0 max-w-full whitespace-normal text-center leading-snug" onClick={() => setShowComments((current) => !current)}>
            <MessageCircle className="h-3.5 w-3.5" />
            {t("member_prayer_requests.comments.heading")} {comments.length > 0 ? `(${comments.length})` : ""}
          </Button>
        </div>

        {showComments && (
          <CommentThread
            className="min-w-0 max-w-full"
            headingLabel={t("member_prayer_requests.comments.heading")}
            comments={comments}
            draft={commentText}
            onDraftChange={setCommentText}
            onSubmit={() => addComment.mutate()}
            submitDisabled={addComment.isPending || !commentText.trim()}
            submitPending={addComment.isPending}
            reactionPending={toggleCommentReaction.isPending}
            quickEmojis={QUICK_COMMENT_EMOJIS}
            reactionEmojis={QUICK_COMMENT_EMOJIS}
            draftPlaceholder={t("member_prayer_requests.comments.placeholder")}
            emptyState={t("member_prayer_requests.comments.empty")}
            onToggleReaction={(commentId, emoji, reacted) =>
              toggleCommentReaction.mutate({ commentId, emoji, reacted })
            }
          />
        )}
      </CardContent>
    </Card>
  );
}

export default function PortalPrayerRequests() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [requestText, setRequestText] = useState("");
  const [offeringAmount, setOfferingAmount] = useState("");
  const [privacy, setPrivacy] = useState<PrayerRequestPrivacy>("public_to_church");
  const [tab, setTab] = useState("community");
  const { churchId } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { data: member } = useMemberRecord();
  const offlineQueue = useOfflineSyncQueue();
  const prayerDraftKey = churchId ? `offline-draft:prayer-request:${churchId}:${member?.id || "member"}` : null;
  const communityPrayerCacheKey = churchId ? `offline-cache:portal-prayer-requests:${churchId}` : null;
  const myPrayerCacheKey = member?.id ? `offline-cache:my-prayer-requests:${member.id}` : null;
  const pendingPrayerRequests = useMemo(
    () =>
      offlineQueue
        .filter((item) => isOfflineSyncActionType(item, "prayer_request_create"))
        .filter(
          (item) =>
            item.payload.churchId === churchId &&
            item.payload.memberId === member?.id,
        ),
    [churchId, member?.id, offlineQueue],
  );
  const [isSyncingPending, setIsSyncingPending] = useState(false);

  useEffect(() => {
    if (!prayerDraftKey) return;
    const draft = readOfflineDraft(prayerDraftKey, {
      requestText: "",
      offeringAmount: "",
      privacy: "public_to_church" as PrayerRequestPrivacy,
    });
    setRequestText(draft.requestText || "");
    setOfferingAmount(draft.offeringAmount || "");
    setPrivacy(draft.privacy === "private_to_pastor_admin" || draft.privacy === "anonymous_public" ? draft.privacy : "public_to_church");
  }, [prayerDraftKey]);

  useEffect(() => {
    if (!prayerDraftKey) return;
    writeOfflineDraft(prayerDraftKey, { requestText, offeringAmount, privacy });
  }, [prayerDraftKey, requestText, offeringAmount, privacy]);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["portal-prayer-requests", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      if (!isOnline) {
        return readOfflineCache(communityPrayerCacheKey, [] as PrayerRequestWithMember[]);
      }
      return withOfflineCache(
        communityPrayerCacheKey,
        async () => {
          const { data, error } = await supabase
            .from("prayer_requests")
            .select(PRAYER_REQUEST_SELECT)
            .eq("church_id", churchId)
            .eq("status", "approved")
            .in("privacy", ["public_to_church", "anonymous_public"])
            .order("created_at", { ascending: false })
            .limit(25);

          if (error) {
            logSupabaseError(error, {
              page: "Portal Prayer Requests",
              component: "PortalPrayerRequests",
              function: "communityPrayerRequestsQuery",
              church_id: churchId,
              operation: "select",
              table: "prayer_requests",
              metadata: {
                code: error.code,
                details: error.details,
                hint: error.hint,
              },
            });
            throw error;
          }

          return (data ?? [])
            .sort((a: any, b: any) => {
              const aOff = Number(a.offering_amount) || 0;
              const bOff = Number(b.offering_amount) || 0;
              if (aOff !== bOff) return bOff - aOff;
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            })
            .map((row: any) => mapPrayerRequestRecord(row as PrayerRequestWithMember));
        },
        readOfflineCache(communityPrayerCacheKey, [] as PrayerRequestWithMember[]),
      );
    },
    enabled: !!churchId,
  });
  const visiblePrayerRequestIds = useMemo(() => requests.map((request) => request.id), [requests]);

  const { data: myRequests = [] } = useQuery({
    queryKey: ["my-prayer-requests", member?.id],
    queryFn: async () => {
      if (!member?.id) return [];
      if (!isOnline) {
        return readOfflineCache(myPrayerCacheKey, [] as PrayerRequestWithMember[]);
      }
      return withOfflineCache(
        myPrayerCacheKey,
        async () => {
          const { data, error } = await supabase
            .from("prayer_requests")
            .select(PRAYER_REQUEST_SELECT)
            .eq("member_id", member.id)
            .order("created_at", { ascending: false })
            .limit(25);

          if (error) throw error;

          return (data ?? []).map((row: any) => mapPrayerRequestRecord(row as PrayerRequestWithMember));
        },
        readOfflineCache(myPrayerCacheKey, [] as PrayerRequestWithMember[]),
      );
    },
    enabled: !!member?.id,
  });

  const { data: prayerMarks = [] } = useQuery({
    queryKey: ["prayer-request-prayers", churchId, visiblePrayerRequestIds],
    queryFn: async () => {
      if (!churchId || visiblePrayerRequestIds.length === 0) return [];
      const { data, error } = await supabase
        .from("prayer_request_prayers")
        .select("prayer_request_id, member_id")
        .eq("church_id", churchId)
        // Query safety: only load prayer marks for the visible, capped request page.
        .in("prayer_request_id", visiblePrayerRequestIds);

      if (error) {
        throw error;
      }

      return data ?? [];
    },
    enabled: !!churchId && visiblePrayerRequestIds.length > 0,
  });

  const prayerStatsByRequest = useMemo(() => {
    const stats = new Map<string, { count: number; prayedByMe: boolean }>();

    prayerMarks.forEach((mark: any) => {
      const current = stats.get(mark.prayer_request_id) ?? { count: 0, prayedByMe: false };
      current.count += 1;
      if (member?.id && mark.member_id === member.id) {
        current.prayedByMe = true;
      }
      stats.set(mark.prayer_request_id, current);
    });

    return stats;
  }, [prayerMarks, member?.id]);

  const PLATFORM_FEE_PERCENT = 1;
  const requestedChurchAmount = offeringAmount ? parseFloat(offeringAmount) : 0;
  const grossOffering = requestedChurchAmount > 0 ? Number((requestedChurchAmount / (1 - PLATFORM_FEE_PERCENT / 100)).toFixed(2)) : 0;
  const feeAmount = grossOffering > 0 ? Number((grossOffering - requestedChurchAmount).toFixed(2)) : 0;

  const submit = useMutation({
    mutationFn: async () => {
      if (!churchId) throw new Error(t("member_prayer_requests.errors.no_church_context"));
      if (!member?.id) throw new Error(t("member_prayer_requests.errors.no_member_profile"));
      assertClientRateLimit(`prayer-request:${churchId}:${member.id}`, 5, 60 * 60 * 1000, "prayer request submissions");
      const requestedOffering = offeringAmount ? parseFloat(offeringAmount) : null;
      if (requestedOffering !== null && (Number.isNaN(requestedOffering) || requestedOffering < 0)) {
        throw new Error(t("member_prayer_requests.errors.offering_negative"));
      }

      if (!isOnline) {
        enqueueOfflineSyncAction({
          type: "prayer_request_create",
          payload: {
            churchId,
            memberId: member.id,
            memberName: member.full_name,
            requestText,
            offeringAmount: requestedOffering,
            privacy,
          },
        });
        return { queuedOffline: true };
      }

      await submitPortalPrayerRequest({
        request_text: requestText,
        member_id: member.id,
        church_id: churchId,
        offering_amount: requestedOffering || null,
        privacy,
        idempotency_key: crypto.randomUUID(),
      });
      return { queuedOffline: false };
    },
    onSuccess: (result) => {
      clearOfflineDraft(prayerDraftKey);
      if (!result?.queuedOffline) {
        queryClient.invalidateQueries({ queryKey: ["portal-prayer-requests"] });
        queryClient.invalidateQueries({ queryKey: ["my-prayer-requests"] });
        queryClient.invalidateQueries({ queryKey: ["my-prayers"] });
        queryClient.invalidateQueries({ queryKey: ["my-contributions-all"] });
        queryClient.invalidateQueries({ queryKey: ["contributions"] });
        queryClient.invalidateQueries({ queryKey: ["simple-member-home"] });
      }
      const offering = offeringAmount ? parseFloat(offeringAmount) : 0;
      const gross = offering > 0 ? Number((offering / (1 - PLATFORM_FEE_PERCENT / 100)).toFixed(2)) : 0;
      const fee = gross > 0 ? Number((gross - offering).toFixed(2)) : 0;
      toast({
        title: result?.queuedOffline
          ? t("member_prayer_requests.toasts.queued_title")
          : t("member_prayer_requests.toasts.submitted_title"),
        description: result?.queuedOffline
          ? t("member_prayer_requests.toasts.queued_description")
          : offering > 0
            ? t("member_prayer_requests.toasts.submitted_with_offering", {
                churchAmount: formatTZS(offering),
                totalAmount: formatTZS(gross),
                feeAmount: formatTZS(fee),
              })
            : t("member_prayer_requests.toasts.submitted_without_offering"),
      });
      setDialogOpen(false);
      setRequestText("");
      setOfferingAmount("");
      setPrivacy("public_to_church");
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="mx-auto min-w-0 w-full max-w-full animate-fade-in px-4 py-5 pb-28 sm:max-w-4xl sm:px-6 lg:px-8 lg:py-8 lg:pb-12">
      <div className="min-w-0 space-y-5">
        <div className="flex min-w-0 max-w-full flex-col gap-4 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Kanisa Connect</p>
            <h1 className="font-serif text-3xl font-bold leading-tight text-foreground md:text-4xl">{t("member_prayer_requests.title")}</h1>
            <p className="max-w-2xl break-words text-sm leading-6 text-muted-foreground">
              {t("member_prayer_requests.subtitle")}
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="min-h-12 w-full min-w-0 max-w-full whitespace-normal text-center leading-snug sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                {t("member_prayer_requests.actions.create")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl">{t("member_prayer_requests.actions.create")}</DialogTitle>
              </DialogHeader>

              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  submit.mutate();
                }}
              >
                {member && (
                  <div className="flex items-center gap-3 rounded-xl border border-primary/10 bg-primary/5 p-3">
                    <User className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{t("member_prayer_requests.form.submitting_as")}</p>
                      <p className="truncate text-sm font-medium">{member.full_name}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="request_text">{t("member_prayer_requests.form.request_label")}</Label>
                  <Textarea
                    id="request_text"
                    rows={5}
                    placeholder={t("member_prayer_requests.form.request_placeholder")}
                    value={requestText}
                    onChange={(event) => setRequestText(event.target.value)}
                    required
                    className="min-h-32 resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prayer_privacy">{t("member_prayer_requests.form.privacy_label")}</Label>
                  <select
                    id="prayer_privacy"
                    value={privacy}
                    onChange={(event) => setPrivacy(event.target.value as PrayerRequestPrivacy)}
                    className="flex min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  >
                    {PRAYER_PRIVACY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </select>
                  <div className="space-y-1 rounded-xl bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">
                    {PRAYER_PRIVACY_OPTIONS.map((option) => (
                      <p key={option.value}>{t(option.descriptionKey)}</p>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-3">
                  <div className="space-y-1">
                    <Label htmlFor="offering_amount">{t("member_prayer_requests.offering.label")}</Label>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {t("member_prayer_requests.offering.helper")}
                    </p>
                  </div>
                  <Input
                    id="offering_amount"
                    type="number"
                    placeholder={t("member_prayer_requests.offering.placeholder")}
                    value={offeringAmount}
                    onChange={(event) => setOfferingAmount(event.target.value)}
                  />
                  <p className="flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
                    <Star className="h-3 w-3 text-primary" />
                    {t("member_prayer_requests.offering.reassurance")}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("member_prayer_requests.form.draft_saved")}
                </p>

                {requestedChurchAmount > 0 && (
                  <div className="space-y-1 rounded-xl border border-border bg-background/80 p-3">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t("member_prayer_requests.offering.church_receives")}</span>
                      <span>{formatTZS(requestedChurchAmount)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t("member_prayer_requests.offering.platform_fee", { percent: PLATFORM_FEE_PERCENT })}</span>
                      <span>{formatTZS(feeAmount)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-1 text-sm font-medium">
                      <span>{t("member_prayer_requests.offering.total")}</span>
                      <span className="text-primary">{formatTZS(grossOffering)}</span>
                    </div>
                  </div>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variant="outline" type="button" className="min-w-0 whitespace-normal" onClick={() => setDialogOpen(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" className="min-w-0 whitespace-normal text-center leading-snug" disabled={submit.isPending || !requestText.trim() || !member?.id}>
                    {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {requestedChurchAmount > 0
                      ? t("member_prayer_requests.actions.submit_with_offering", { amount: formatTZS(grossOffering) })
                      : t("member_prayer_requests.actions.submit")}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {pendingPrayerRequests.length > 0 ? (
          <Card className="min-w-0 max-w-full border-primary/20 bg-primary/5">
            <CardContent className="min-w-0 max-w-full space-y-3 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t("member_prayer_requests.offline.title")}</p>
                  <p className="break-words text-sm text-muted-foreground">
                    {t("member_prayer_requests.offline.description")}
                  </p>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Badge variant="outline" className="max-w-full whitespace-normal">
                    {t("member_prayer_requests.offline.count", { count: pendingPrayerRequests.length })}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-w-0 max-w-full whitespace-normal text-center leading-snug"
                    disabled={!isOnline || isSyncingPending}
                    onClick={async () => {
                      setIsSyncingPending(true);
                      const result = await processOfflineSyncQueue(queryClient);
                      setIsSyncingPending(false);
                      if (result.processedCount === 0 && result.error) {
                        toast({ title: t("member_prayer_requests.errors.sync_failed"), description: result.error.message, variant: "destructive" });
                      }
                    }}
                  >
                    {isSyncingPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                    {t("common.sync_now")}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {pendingPrayerRequests.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border/60 bg-background/70 p-3">
                    <div className="flex min-w-0 flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
                      <div className="min-w-0">
                        <p className="break-words text-sm">{item.payload.requestText}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("member_prayer_requests.offline.saved_at", {
                            date: formatAppDate(item.createdAt, i18n.language, { dateStyle: "medium", timeStyle: "short" }),
                          })}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full min-w-0 max-w-full whitespace-normal text-destructive min-[420px]:w-auto"
                        onClick={() => removeOfflineSyncAction(item.id)}
                      >
                        {t("common.remove")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Tabs
          className="min-w-0 max-w-full"
          value={tab}
          onValueChange={(nextTab) => {
            setTab(nextTab);
            if (nextTab === "community" && churchId) {
              void queryClient.refetchQueries({ queryKey: ["portal-prayer-requests", churchId], exact: true });
            }
          }}
        >
          <TabsList className="mb-4 grid h-auto min-w-0 max-w-full grid-cols-2 bg-secondary p-1">
            <TabsTrigger value="community" className="min-h-11 min-w-0 max-w-full whitespace-normal break-words px-1.5 text-center text-sm leading-snug sm:px-2">{t("member_prayer_requests.tabs.community")}</TabsTrigger>
            <TabsTrigger value="mine" className="min-h-11 min-w-0 max-w-full whitespace-normal break-words px-1.5 text-center text-sm leading-snug sm:px-2">{t("member_prayer_requests.tabs.mine", { count: myRequests.length })}</TabsTrigger>
          </TabsList>

          <TabsContent value="community" className="mt-0 min-w-0 max-w-full">
            {isLoading ? (
              <Card className="min-w-0 max-w-full border-border/70 bg-card/80">
                <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  {t("member_prayer_requests.states.loading")}
                </CardContent>
              </Card>
            ) : requests.length === 0 ? (
              <Card className="min-w-0 max-w-full border-dashed border-border/80 bg-card/70">
                <CardContent className="px-4 py-14 text-center sm:px-6">
                  <MessageCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
                  <h2 className="text-lg font-semibold">{t("member_prayer_requests.states.community_empty_title")}</h2>
                  <p className="mx-auto mt-2 max-w-sm break-words text-sm leading-6 text-muted-foreground">
                    {t("member_prayer_requests.states.community_empty_description")}
                  </p>
                  <Button className="mt-5 min-h-11 min-w-0 max-w-full whitespace-normal text-center leading-snug" onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                    {t("member_prayer_requests.actions.create")}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="min-w-0 space-y-3">
                {requests.map((request) => (
                  <PrayerRequestCard
                    key={request.id}
                    request={request}
                    member={member}
                    churchId={churchId}
                    prayerStats={prayerStatsByRequest.get(request.id) ?? { count: 0, prayedByMe: false }}
                    queryClient={queryClient}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="mine" className="mt-0 min-w-0 max-w-full">
            {myRequests.length === 0 ? (
              <Card className="min-w-0 max-w-full border-dashed border-border/80 bg-card/70">
                <CardContent className="px-4 py-14 text-center sm:px-6">
                  <MessageCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
                  <h2 className="text-lg font-semibold">{t("member_prayer_requests.states.mine_empty_title")}</h2>
                  <p className="mx-auto mt-2 max-w-sm break-words text-sm leading-6 text-muted-foreground">
                    {t("member_prayer_requests.states.mine_empty_description")}
                  </p>
                  <Button className="mt-5 min-h-11 min-w-0 max-w-full whitespace-normal text-center leading-snug" onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                    {t("member_prayer_requests.actions.create")}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="min-w-0 space-y-3">
                {myRequests.map((request) => (
                  <PrayerRequestCard
                    key={request.id}
                    request={request}
                    member={member}
                    churchId={churchId}
                    prayerStats={prayerStatsByRequest.get(request.id) ?? { count: 0, prayedByMe: false }}
                    queryClient={queryClient}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
