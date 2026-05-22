import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { PRAYER_REQUEST_SELECT, mapPrayerRequestRecord, submitPrayerRequest, type PrayerRequestWithMember } from "@/lib/prayer-requests";
import { clearOfflineDraft, readOfflineDraft, writeOfflineDraft } from "@/lib/offline-drafts";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { enqueueOfflineSyncAction, processOfflineSyncQueue, removeOfflineSyncAction } from "@/lib/offline-sync";
import { useOfflineSyncQueue } from "@/hooks/useOfflineSyncQueue";
import { readOfflineCache, withOfflineCache } from "@/lib/offline-cache";
import { CommentThread, type CommentReactionSummary, type ThreadComment } from "@/components/portal/CommentThread";

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
  const { toast } = useToast();

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
      toast({ title: prayerStats.prayedByMe ? "Prayer mark removed" : "Marked as prayed" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
      toast({ title: "Comment posted" });
      setCommentText("");
      setShowComments(true);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
              <p className="text-sm font-medium">{request.member_name}</p>
              <Badge variant="outline" className={statusColor(request.status)}>
                {request.status}
              </Badge>
              {Number(request.offering_amount) > 0 && (
                <Badge variant="outline" className="border-primary/20 bg-primary/10 text-xs text-primary">
                  <Star className="mr-1 h-3 w-3" />
                  Priority
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{request.request_text}</p>
            {Number(request.offering_amount) > 0 && (
              <p className="mt-1 text-xs text-primary">Offering: {formatTZS(request.offering_amount)}</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground/60">
              {new Date(request.created_at).toLocaleDateString()}
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
            {prayerStats.prayedByMe ? "Prayed" : "Mark as Prayed"} ({prayerStats.count})
          </Button>

          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowComments((current) => !current)}>
            <MessageCircle className="h-3.5 w-3.5" />
            Comments {comments.length > 0 ? `(${comments.length})` : ""}
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
            draftPlaceholder="Share encouragement or pray with them in words..."
            emptyState="No comments yet. Leave a prayer or a word of encouragement."
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
  const [tab, setTab] = useState("community");
  const { churchId } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: member } = useMemberRecord();
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
    });
    setRequestText(draft.requestText || "");
    setOfferingAmount(draft.offeringAmount || "");
  }, [prayerDraftKey]);

  useEffect(() => {
    if (!prayerDraftKey) return;
    writeOfflineDraft(prayerDraftKey, { requestText, offeringAmount });
  }, [prayerDraftKey, requestText, offeringAmount]);

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
            .order("created_at", { ascending: false });

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
            .order("created_at", { ascending: false });

          if (error) throw error;

          return (data ?? []).map((row: any) => mapPrayerRequestRecord(row as PrayerRequestWithMember));
        },
        readOfflineCache(myPrayerCacheKey, [] as PrayerRequestWithMember[]),
      );
    },
    enabled: !!member?.id,
  });

  const { data: prayerMarks = [] } = useQuery({
    queryKey: ["prayer-request-prayers", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from("prayer_request_prayers")
        .select("prayer_request_id, member_id")
        .eq("church_id", churchId);

      if (error) {
        throw error;
      }

      return data ?? [];
    },
    enabled: !!churchId,
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

      if (!isOnline) {
        enqueueOfflineSyncAction({
          type: "prayer_request_create",
          payload: {
            churchId,
            memberId: member.id,
            memberName: member.full_name,
            requestText,
            offeringAmount: offeringAmount ? parseFloat(offeringAmount) : null,
          },
        });
        return { queuedOffline: true };
      }

      const churchAmount = offeringAmount ? parseFloat(offeringAmount) : null;
      const offering = churchAmount && churchAmount > 0
        ? Number((churchAmount / (1 - PLATFORM_FEE_PERCENT / 100)).toFixed(2))
        : null;
      const fee = offering && offering > 0 ? Number((offering - churchAmount!).toFixed(2)) : 0;
      const net = churchAmount ?? 0;

      const prayerRequest = await submitPrayerRequest({
        request_text: requestText,
        member_id: member.id,
        church_id: churchId,
        offering_amount: net || null,
      });

      if (offering && offering > 0) {
        await supabase.from("platform_fees").insert({
          church_id: churchId,
          source_type: "prayer_request",
          source_id: prayerRequest.id,
          gross_amount: offering,
          fee_percentage: PLATFORM_FEE_PERCENT,
          fee_amount: fee,
          net_amount: net,
          member_id: member.id,
        });

        await supabase.from("contributions").insert({
          church_id: churchId,
          amount: net,
          donor_name: member.full_name,
          member_id: member.id,
          notes: `Prayer Request Offering - ${requestText.trim().slice(0, 80)} (${formatTZS(fee)} platform fee)`,
        });
      }
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
      }
      const offering = offeringAmount ? parseFloat(offeringAmount) : 0;
      const gross = offering > 0 ? Number((offering / (1 - PLATFORM_FEE_PERCENT / 100)).toFixed(2)) : 0;
      const fee = gross > 0 ? Number((gross - offering).toFixed(2)) : 0;
      toast({
        title: result?.queuedOffline ? "Prayer request queued" : "Prayer request submitted",
        description: result?.queuedOffline
          ? "Your prayer request will sync automatically when internet returns."
          : offering > 0
            ? `${formatTZS(offering)} will go to the church. Total paid was ${formatTZS(gross)}, including a ${formatTZS(fee)} platform fee.`
            : "Your prayer has been shared.",
      });
      setDialogOpen(false);
      setRequestText("");
      setOfferingAmount("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="container mx-auto px-4 py-10 animate-fade-in">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold md:text-3xl">Prayer Requests</h1>
            <p className="mt-1 text-muted-foreground">Share your prayer needs with the community.</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Submit Request
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">Submit Prayer Request</DialogTitle>
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
                  <Label htmlFor="request_text">Prayer Request *</Label>
                  <Textarea
                    id="request_text"
                    rows={4}
                    placeholder="Share your prayer need..."
                    value={requestText}
                    onChange={(event) => setRequestText(event.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="offering_amount">Offering Amount (TZS)</Label>
                  <Input
                    id="offering_amount"
                    type="number"
                    placeholder="Optional - amount church should receive"
                    value={offeringAmount}
                    onChange={(event) => setOfferingAmount(event.target.value)}
                  />
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="h-3 w-3 text-primary" />
                    Offering is optional. Paid requests receive higher priority with the pastor.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  This draft is saved on this device while you type.
                </p>

                {requestedChurchAmount > 0 && (
                  <div className="space-y-1 rounded-lg border border-border bg-muted/50 p-3">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Church receives</span>
                      <span>{formatTZS(requestedChurchAmount)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Platform fee ({PLATFORM_FEE_PERCENT}%)</span>
                      <span>{formatTZS(feeAmount)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-1 text-sm font-medium">
                      <span>You pay</span>
                      <span className="text-primary">{formatTZS(grossOffering)}</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submit.isPending || !requestText.trim() || !member?.id}>
                    {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {requestedChurchAmount > 0 ? `Submit & Pay ${formatTZS(grossOffering)}` : "Submit"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {pendingPrayerRequests.length > 0 ? (
          <Card className="mb-6 border-primary/20 bg-primary/5">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Pending offline prayer requests</p>
                  <p className="text-sm text-muted-foreground">
                    These will sync automatically when internet returns.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{pendingPrayerRequests.length} pending</Badge>
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
              </div>
              <div className="space-y-2">
                {pendingPrayerRequests.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border/60 bg-background/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm">{item.payload.requestText}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Saved {new Date(item.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => removeOfflineSyncAction(item.id)}
                      >
                        Remove
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
            <TabsTrigger value="community">Community Prayers</TabsTrigger>
            <TabsTrigger value="mine">My Requests ({myRequests.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="community">
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : requests.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="py-16 text-center text-muted-foreground">
                  <MessageCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
                  No prayer requests yet.
                </CardContent>
              </Card>
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
              <Card className="glass-card">
                <CardContent className="py-16 text-center text-muted-foreground">
                  <MessageCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
                  You haven't submitted any prayer requests yet.
                </CardContent>
              </Card>
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
