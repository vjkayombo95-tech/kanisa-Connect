import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageToolbar, getWorkspacePageActions, useWorkspacePage } from "@/components/workspace";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Heart, Loader2, MessageCircle, Star, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatTZSForLanguage } from "@/lib/currency";
import { formatLocalizedDate, normalizeAppLanguage } from "@/lib/localization";
import { EmptyState, LoadingState } from "@/components/ui/page-state";
import { getFriendlyErrorMessage, pilotToast } from "@/lib/pilot-polish";
import { PRAYER_REQUEST_SELECT, mapPrayerRequestRecord, submitPortalPrayerRequest, type PrayerRequestPrivacy, type PrayerRequestWithMember } from "@/lib/prayer-requests";
import { clearOfflineDraft, readOfflineDraft, writeOfflineDraft } from "@/lib/offline-drafts";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { enqueueOfflineSyncAction, processOfflineSyncQueue, removeOfflineSyncAction } from "@/lib/offline-sync";
import { useOfflineSyncQueue } from "@/hooks/useOfflineSyncQueue";
import { readOfflineCache, withOfflineCache } from "@/lib/offline-cache";
import { CommentThread, type CommentReactionSummary, type ThreadComment } from "@/components/portal/CommentThread";
import { assertClientRateLimit } from "@/lib/client-rate-limit";
import { logSupabaseError } from "@/lib/error-logger";
import { ScriptureText } from "@/components/bible";

const QUICK_COMMENT_EMOJIS = ["🙏", "❤️", "🙌", "🕊️"];

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
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const language = normalizeAppLanguage(i18n.language) ?? "en";

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
            .from("prayer_request_comment_reactions" as never)
            .select("comment_id, user_id, emoji")
            .in("comment_id", commentIds)
        : { data: [], error: null };

      if (reactionsError) {
        throw reactionsError;
      }

      const groupedReactions = new Map<string, Map<string, Set<string>>>();

      ((reactionRows as any[]) ?? []).forEach((reaction) => {
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
      if (!churchId) throw new Error("No church context");
      if (!member?.id) throw new Error("Your member profile is required");

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
      pilotToast({
        title: prayerStats.prayedByMe
          ? t("member_portal.parish_life.prayer_mark_removed")
          : t("member_portal.parish_life.marked_as_prayed"),
        description: prayerStats.prayedByMe
          ? t("member_portal.parish_life.prayer_mark_removed_description")
          : t("member_portal.parish_life.marked_as_prayed_description"),
      });
    },
    onError: (error: Error) => {
      logSupabaseError(error, {
        page: "Portal Prayer Requests",
        component: "PortalPrayerRequests",
        function: "submitPrayerRequest",
        church_id: churchId,
        operation: "insert",
        table: "prayer_requests",
        metadata: { member_id: member?.id, has_offering: Number(offeringAmount || 0) > 0 },
      });
      pilotToast({
        title: t("member_portal.parish_life.prayer_action_failed"),
        description: getFriendlyErrorMessage(error),
        intent: "error",
      });
    },
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!churchId) throw new Error("No church context");
      if (!commentText.trim()) throw new Error("Comment cannot be empty");

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
      pilotToast({
        title: t("member_portal.parish_life.comment_posted"),
        description: t("member_portal.parish_life.comment_posted_description"),
      });
      setCommentText("");
      setShowComments(true);
    },
    onError: (error: Error) => {
      pilotToast({
        title: t("member_portal.parish_life.comment_post_failed"),
        description: getFriendlyErrorMessage(error),
        intent: "error",
      });
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
      if (!user) throw new Error("You need to sign in to react.");

      if (reacted) {
        const { error } = await supabase
          .from("prayer_request_comment_reactions" as never)
          .delete()
          .eq("comment_id", commentId)
          .eq("user_id", user.id);

        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from("prayer_request_comment_reactions" as never)
        .upsert({ comment_id: commentId, user_id: user.id, emoji } as never, {
          onConflict: "comment_id,user_id",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prayer-request-comments", request.id] });
    },
    onError: (error: Error) => {
      pilotToast({
        title: t("member_portal.parish_life.reaction_save_failed"),
        description: getFriendlyErrorMessage(error),
        intent: "error",
      });
    },
  });

  const statusColor = (status: string) => {
    if (status === "approved") return "bg-success/20 text-success border-success/30";
    if (status === "pending") return "bg-primary/20 text-primary border-primary/30";
    return "bg-destructive/10 text-destructive border-destructive/20";
  };

  return (
    <Card className="glass-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <p className="text-sm font-medium">{request.privacy === "anonymous_public" ? t("member_portal.parish_life.anonymous") : request.member_name}</p>
              <Badge variant="outline" className={statusColor(request.status)}>
                {t(`member_portal.parish_life.prayer_status.${request.status}`, request.status)}
              </Badge>
              {Number(request.offering_amount) > 0 && (
                <Badge variant="outline" className="border-primary/20 bg-primary/10 text-xs text-primary">
                  <Star className="mr-1 h-3 w-3" />
                  {t("member_portal.parish_life.priority")}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              <ScriptureText text={request.request_text} />
            </p>
            {Number(request.offering_amount) > 0 && (
              <p className="mt-1 text-xs text-primary">
                {t("member_portal.parish_life.offering_amount", { amount: formatTZSForLanguage(request.offering_amount, language) })}
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground/60">
              {formatLocalizedDate(request.created_at, language, { dateStyle: "medium" })}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
          <Button
            size="sm"
            variant={prayerStats.prayedByMe ? "default" : "outline"}
            className="gap-1.5"
            onClick={() => togglePrayer.mutate()}
            disabled={togglePrayer.isPending || !member?.id}
          >
            {togglePrayer.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Heart className={`h-3.5 w-3.5 ${prayerStats.prayedByMe ? "fill-current" : ""}`} />
            )}
            {prayerStats.prayedByMe ? t("member_portal.parish_life.prayed") : t("member_portal.parish_life.mark_as_prayed")} ({prayerStats.count})
          </Button>

          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowComments((current) => !current)}>
            <MessageCircle className="h-3.5 w-3.5" />
            {t("member_portal.parish_life.comments")} {comments.length > 0 ? `(${comments.length})` : ""}
          </Button>
        </div>

        {showComments && (
          <CommentThread
            comments={comments}
            draft={commentText}
            onDraftChange={setCommentText}
            onSubmit={() => addComment.mutate()}
            submitDisabled={addComment.isPending || !commentText.trim()}
            submitPending={addComment.isPending}
            reactionPending={toggleCommentReaction.isPending}
            quickEmojis={QUICK_COMMENT_EMOJIS}
            reactionEmojis={QUICK_COMMENT_EMOJIS}
            draftPlaceholder={t("member_portal.parish_life.prayer_comment_placeholder")}
            emptyState={t("member_portal.parish_life.no_prayer_comments")}
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
  const page = useWorkspacePage();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [requestText, setRequestText] = useState("");
  const [offeringAmount, setOfferingAmount] = useState("");
  const [privacy, setPrivacy] = useState<PrayerRequestPrivacy>("public_to_church");
  const [tab, setTab] = useState("community");
  const { churchId } = useAuth();
  const { isOnline } = useNetworkStatus();
  const queryClient = useQueryClient();
  const { data: member } = useMemberRecord();
  const { t, i18n } = useTranslation();
  const language = normalizeAppLanguage(i18n.language) ?? "en";
  const offlineQueue = useOfflineSyncQueue();
  const prayerDraftKey = churchId ? `offline-draft:prayer-request:${churchId}:${member?.id || "member"}` : null;
  const communityPrayerCacheKey = churchId ? `offline-cache:portal-prayer-requests:${churchId}` : null;
  const myPrayerCacheKey = member?.id ? `offline-cache:my-prayer-requests:${member.id}` : null;
  const pendingPrayerRequests = useMemo(
    () =>
      offlineQueue.filter(
        (item) =>
          item.type === "prayer_request_create" &&
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
            .order("created_at", { ascending: false })
            .limit(25);

          if (error) throw error;

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
      if (!churchId) throw new Error("No church context");
      if (!member?.id) throw new Error("No member profile found");
      assertClientRateLimit(`prayer-request:${churchId}:${member.id}`, 5, 60 * 60 * 1000, "prayer request submissions");
      const requestedOffering = offeringAmount ? parseFloat(offeringAmount) : null;
      if (requestedOffering !== null && (Number.isNaN(requestedOffering) || requestedOffering < 0)) {
        throw new Error("Offering amount cannot be negative.");
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
      pilotToast({
        title: result?.queuedOffline
          ? t("member_portal.parish_life.prayer_request_queued")
          : t("member_portal.parish_life.prayer_request_submitted"),
        description: result?.queuedOffline
          ? t("member_portal.parish_life.prayer_request_queued_description")
          : offering > 0
            ? t("member_portal.parish_life.prayer_request_offering_description", {
                offering: formatTZSForLanguage(offering, language),
                gross: formatTZSForLanguage(gross, language),
                fee: formatTZSForLanguage(fee, language),
              })
            : t("member_portal.parish_life.prayer_request_shared_description"),
      });
      setDialogOpen(false);
      setRequestText("");
      setOfferingAmount("");
      setPrivacy("public_to_church");
    },
    onError: (error: Error) => {
      pilotToast({
        title: t("member_portal.parish_life.prayer_request_submit_failed"),
        description: getFriendlyErrorMessage(error),
        intent: "error",
      });
    },
  });
  const toolbarActions = useMemo(
    () => getWorkspacePageActions("prayer_requests", page, { create: () => setDialogOpen(true) }),
    [page],
  );

  return (
    <div className="container mx-auto px-4 py-10 animate-fade-in">
      <div className="mx-auto max-w-3xl space-y-6">
        <PageToolbar
          title={t("member_portal.parish_life.prayer_requests")}
          description={t("member_portal.parish_life.prayer_requests_description")}
          actions={toolbarActions}
        />

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">{t("member_portal.parish_life.submit_prayer_request")}</DialogTitle>
              </DialogHeader>

              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  submit.mutate();
                }}
              >
                {member && (
                  <div className="flex items-center gap-3 rounded-lg border border-primary/10 bg-primary/5 p-3">
                    <User className="h-4 w-4 shrink-0 text-primary" />
                    <p className="text-sm font-medium">{member.full_name}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="request_text">{t("member_portal.parish_life.prayer_request_required")}</Label>
                  <Textarea
                    id="request_text"
                    rows={4}
                    placeholder={t("member_portal.parish_life.prayer_request_placeholder")}
                    value={requestText}
                    onChange={(event) => setRequestText(event.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prayer_privacy">{t("member_portal.parish_life.prayer_privacy_label")}</Label>
                  <select
                    id="prayer_privacy"
                    value={privacy}
                    onChange={(event) => setPrivacy(event.target.value as PrayerRequestPrivacy)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="public_to_church">{t("member_portal.parish_life.privacy_public_to_church")}</option>
                    <option value="private_to_pastor_admin">{t("member_portal.parish_life.privacy_private_to_pastor_admin")}</option>
                    <option value="anonymous_public">{t("member_portal.parish_life.privacy_anonymous_public")}</option>
                  </select>
                  <p className="text-xs text-muted-foreground">{t("member_portal.parish_life.prayer_privacy_hint")}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="offering_amount">{t("member_portal.parish_life.offering_amount_label")}</Label>
                  <Input
                    id="offering_amount"
                    type="number"
                    placeholder={t("member_portal.parish_life.offering_amount_placeholder")}
                    value={offeringAmount}
                    onChange={(event) => setOfferingAmount(event.target.value)}
                  />
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="h-3 w-3 text-primary" />
                    {t("member_portal.parish_life.offering_optional_hint")}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("member_portal.parish_life.draft_saved_hint")}
                </p>

                {requestedChurchAmount > 0 && (
                  <div className="space-y-1 rounded-lg border border-border bg-muted/50 p-3">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t("member_portal.parish_life.church_receives")}</span>
                      <span>{formatTZSForLanguage(requestedChurchAmount, language)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t("member_portal.parish_life.platform_fee", { percent: PLATFORM_FEE_PERCENT })}</span>
                      <span>{formatTZSForLanguage(feeAmount, language)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-1 text-sm font-medium">
                      <span>{t("member_portal.parish_life.you_pay")}</span>
                      <span className="text-primary">{formatTZSForLanguage(grossOffering, language)}</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
                    {t("member_portal.common.cancel")}
                  </Button>
                  <Button type="submit" disabled={submit.isPending || !requestText.trim() || !member?.id}>
                    {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {requestedChurchAmount > 0
                      ? t("member_portal.parish_life.submit_and_pay", { amount: formatTZSForLanguage(grossOffering, language) })
                      : t("member_portal.parish_life.submit")}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

        {pendingPrayerRequests.length > 0 ? (
          <Card className="mb-6 border-primary/20 bg-primary/5">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{t("member_portal.parish_life.pending_offline_prayer_requests")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("member_portal.parish_life.pending_offline_prayer_description")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{t("member_portal.parish_life.pending_count", { count: pendingPrayerRequests.length })}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!isOnline || isSyncingPending}
                    onClick={async () => {
                      setIsSyncingPending(true);
                      const result = await processOfflineSyncQueue(queryClient);
                      setIsSyncingPending(false);
                      if (result.processedCount === 0 && result.error) {
                        pilotToast({
                          title: t("member_portal.parish_life.sync_failed"),
                          description: getFriendlyErrorMessage(result.error),
                          intent: "error",
                        });
                      }
                    }}
                  >
                    {isSyncingPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                    {t("member_portal.parish_life.sync_now")}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {pendingPrayerRequests.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border/60 bg-background/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm">
                          <ScriptureText text={item.payload.requestText} />
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("member_portal.parish_life.saved_at", {
                            date: formatLocalizedDate(item.createdAt, language, { dateStyle: "medium", timeStyle: "short" }),
                          })}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => removeOfflineSyncAction(item.id)}
                      >
                        {t("member_portal.parish_life.remove")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 bg-secondary">
            <TabsTrigger value="community">{t("member_portal.parish_life.community_prayers")}</TabsTrigger>
            <TabsTrigger value="mine">{t("member_portal.parish_life.my_requests", { count: myRequests.length })}</TabsTrigger>
          </TabsList>

          <TabsContent value="community">
            {isLoading ? (
              <LoadingState title={t("member_portal.parish_life.loading_community_prayers")} rows={3} />
            ) : requests.length === 0 ? (
              <EmptyState
                icon={<MessageCircle className="h-6 w-6" aria-hidden="true" />}
                title={t("member_portal.parish_life.no_prayer_requests")}
                description={t("member_portal.parish_life.no_prayer_requests_description")}
                action={<Button onClick={() => setDialogOpen(true)}>{t("member_portal.parish_life.submit_prayer_request")}</Button>}
              />
            ) : (
              <div className="space-y-3">
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

          <TabsContent value="mine">
            {myRequests.length === 0 ? (
              <EmptyState
                icon={<MessageCircle className="h-6 w-6" aria-hidden="true" />}
                title={t("member_portal.parish_life.no_my_prayer_requests")}
                description={t("member_portal.parish_life.no_my_prayer_requests_description")}
                action={<Button onClick={() => setDialogOpen(true)}>{t("member_portal.parish_life.submit_prayer_request")}</Button>}
              />
            ) : (
              <div className="space-y-3">
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
