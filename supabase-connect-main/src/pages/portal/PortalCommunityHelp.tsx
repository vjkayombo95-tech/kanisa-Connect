import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HelpCircle, Plus, Loader2, User, HandCoins, MessageCircle } from "lucide-react";
import { formatTZS } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { COMMUNITY_HELP_SELECT, enrichCommunityHelpRequests, submitCommunityHelpRequest, type CommunityHelpRequestWithMember } from "@/lib/member-linked-requests";
import { clearOfflineDraft, readOfflineDraft, writeOfflineDraft } from "@/lib/offline-drafts";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { enqueueOfflineSyncAction, processOfflineSyncQueue, removeOfflineSyncAction } from "@/lib/offline-sync";
import { useOfflineSyncQueue } from "@/hooks/useOfflineSyncQueue";
import { readOfflineCache, withOfflineCache } from "@/lib/offline-cache";
import { CommentThread, type CommentReactionSummary, type ThreadComment } from "@/components/portal/CommentThread";

const helpCategories = ["Medical", "Education", "Housing", "Food", "Emergency", "Funeral", "Other"];
const HELP_COMMENT_EMOJIS = ["🙏", "❤️", "🙌", "🤝", "💛"] as const;

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

export default function PortalCommunityHelp() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [tab, setTab] = useState("approved");
  const { churchId, user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: member } = useMemberRecord();
  const offlineQueue = useOfflineSyncQueue();
  const helpDraftKey = churchId ? `offline-draft:community-help:${churchId}:${member?.id || "member"}` : null;
  const approvedHelpCacheKey = churchId ? `offline-cache:portal-community-help-approved:${churchId}` : null;
  const myHelpCacheKey = member?.id ? `offline-cache:my-help-requests:${member.id}:${churchId || "church"}` : null;
  const pendingHelpRequests = useMemo(
    () =>
    offlineQueue.filter(
      (item) =>
        item.type === "community_help_request_create" &&
        item.payload.churchId === churchId &&
        item.payload.memberId === member?.id,
    ),
    [churchId, member?.id, offlineQueue],
  );
  const [isSyncingPending, setIsSyncingPending] = useState(false);

  useEffect(() => {
    if (!helpDraftKey) return;
    const draft = readOfflineDraft(helpDraftKey, {
      category: "",
      description: "",
      targetAmount: "",
    });
    setCategory(draft.category || "");
    setDescription(draft.description || "");
    setTargetAmount(draft.targetAmount || "");
  }, [helpDraftKey]);

  useEffect(() => {
    if (!helpDraftKey) return;
    writeOfflineDraft(helpDraftKey, { category, description, targetAmount });
  }, [helpDraftKey, category, description, targetAmount]);

  const { data: approvedRequests = [], isLoading } = useQuery({
    queryKey: ["portal-community-help-approved", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      if (!isOnline) {
        return readOfflineCache(approvedHelpCacheKey, [] as CommunityHelpRequestWithMember[]);
      }
      return withOfflineCache(
        approvedHelpCacheKey,
        async () => {
          const { data, error } = await supabase
            .from("community_help_requests")
            .select(COMMUNITY_HELP_SELECT)
            .eq("church_id", churchId)
            .eq("status", "approved")
            .order("created_at", { ascending: false });

          if (error) throw error;

          return enrichCommunityHelpRequests((data ?? []) as any[]);
        },
        readOfflineCache(approvedHelpCacheKey, [] as CommunityHelpRequestWithMember[]),
      );
    },
    enabled: !!churchId,
  });

  const { data: myRequests = [] } = useQuery({
    queryKey: ["my-help-requests", member?.id, churchId],
    queryFn: async () => {
      if (!member?.id || !churchId) return [];
      if (!isOnline) {
        return readOfflineCache(myHelpCacheKey, [] as CommunityHelpRequestWithMember[]);
      }
      return withOfflineCache(
        myHelpCacheKey,
        async () => {
          const { data, error } = await supabase
            .from("community_help_requests")
            .select(COMMUNITY_HELP_SELECT)
            .eq("church_id", churchId)
            .eq("member_id", member.id)
            .order("created_at", { ascending: false });

            if (error) throw error;

          return enrichCommunityHelpRequests((data ?? []) as any[]);
        },
        readOfflineCache(myHelpCacheKey, [] as CommunityHelpRequestWithMember[]),
      );
    },
    enabled: !!member?.id && !!churchId,
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!churchId) throw new Error("No church context");
      if (!member?.id) throw new Error("No member profile found");
      if (!isOnline) {
        enqueueOfflineSyncAction({
          type: "community_help_request_create",
          payload: {
            churchId,
            memberId: member.id,
            category: category || "other",
            description,
            targetAmount: targetAmount ? parseFloat(targetAmount) : null,
          },
        });
        return { queuedOffline: true };
      }
      return submitCommunityHelpRequest({
        category: category || "other",
        description,
        target_amount: targetAmount ? parseFloat(targetAmount) : null,
        member_id: member.id,
        church_id: churchId,
      });
    },
    onSuccess: (result) => {
      clearOfflineDraft(helpDraftKey);
      if (!(result as { queuedOffline?: boolean } | undefined)?.queuedOffline) {
        queryClient.invalidateQueries({ queryKey: ["community-help"] });
        queryClient.invalidateQueries({ queryKey: ["portal-community-help-approved"] });
        queryClient.invalidateQueries({ queryKey: ["my-help-requests"] });
        queryClient.invalidateQueries({ queryKey: ["my-help-requests-dashboard"] });
      }
      toast({
        title: (result as { queuedOffline?: boolean } | undefined)?.queuedOffline ? "Help request queued" : "Help request submitted",
        description: (result as { queuedOffline?: boolean } | undefined)?.queuedOffline
          ? "Your help request will sync automatically when internet returns."
          : "Your request will be reviewed by a church admin before being published.",
      });
      setDialogOpen(false);
      setCategory("");
      setDescription("");
      setTargetAmount("");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const statusColor = (status: string) => {
    if (status === "approved") return "bg-success/20 text-success border-success/30";
    if (status === "pending") return "bg-primary/20 text-primary border-primary/30";
    return "bg-destructive/10 text-destructive border-destructive/20";
  };

  return (
    <div className="container mx-auto px-4 py-10 animate-fade-in">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-serif">Community Help</h1>
            <p className="mt-1 text-muted-foreground">Support members of your community who need help.</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Request Help</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle className="font-serif">Request Community Help</DialogTitle></DialogHeader>
              <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); submit.mutate(); }}>
                {member && (
                  <div className="flex items-center gap-3 rounded-lg border border-primary/10 bg-primary/5 p-3">
                    <User className="h-4 w-4 shrink-0 text-primary" />
                    <p className="text-sm font-medium">{member.full_name}</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {helpCategories.map((value) => <SelectItem key={value} value={value.toLowerCase()}>{value}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description *</Label>
                  <Textarea rows={3} placeholder="Describe the need..." value={description} onChange={(event) => setDescription(event.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Target Amount (TZS)</Label>
                  <Input type="number" placeholder="Optional goal amount" value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} />
                </div>
                <p className="text-xs text-muted-foreground">Your request will be reviewed by a church admin before being visible to the community.</p>
                <p className="text-xs text-muted-foreground">This draft is saved on this device while you type.</p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={submit.isPending || !description.trim() || !member?.id}>
                    {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {pendingHelpRequests.length > 0 ? (
          <Card className="mb-6 border-primary/20 bg-primary/5">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Pending offline help requests</p>
                  <p className="text-sm text-muted-foreground">
                    These will sync automatically when internet returns.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{pendingHelpRequests.length} pending</Badge>
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
                {pendingHelpRequests.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border/60 bg-background/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{item.payload.category}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.payload.description}</p>
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
          <TabsList className="bg-secondary mb-4">
            <TabsTrigger value="approved">Community Requests</TabsTrigger>
            <TabsTrigger value="mine">My Requests ({myRequests.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="approved">
            {isLoading ? <p className="text-muted-foreground">Loading...</p> : approvedRequests.length === 0 ? (
              <Card className="glass-card"><CardContent className="py-16 text-center text-muted-foreground">
                <HelpCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                No approved help requests at this time.
              </CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {approvedRequests.map((request) => <HelpCardWithActions key={request.id} request={request} member={member} user={user} churchId={churchId} queryClient={queryClient} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="mine">
            {myRequests.length === 0 ? (
              <Card className="glass-card"><CardContent className="py-16 text-center text-muted-foreground">
                <HelpCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                You haven't submitted any help requests yet.
              </CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {myRequests.map((request) => (
                  <Card key={request.id} className="glass-card">
                    <CardContent className="space-y-3 p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{request.category}</p>
                          <Badge variant="outline" className={`${statusColor(request.status)} mt-1`}>{request.status}</Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{request.description}</p>
                      {request.target_amount && (
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{formatTZS(request.current_amount || 0)} raised</span>
                            <span>{formatTZS(request.target_amount)} goal</span>
                          </div>
                          <Progress value={Math.min(100, ((request.current_amount || 0) / request.target_amount) * 100)} className="h-2" />
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground/60">{new Date(request.created_at).toLocaleDateString()}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function HelpCardWithActions({
  request,
  member,
  user,
  churchId,
  queryClient,
}: {
  request: CommunityHelpRequestWithMember;
  member: { id: string; full_name: string } | null | undefined;
  user: { id: string } | null;
  churchId: string | null;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [donateOpen, setDonateOpen] = useState(false);
  const [donateAmount, setDonateAmount] = useState("");
  const [commentText, setCommentText] = useState("");
  const [showComments, setShowComments] = useState(false);
  const { toast } = useToast();
  const PLATFORM_FEE_PERCENT = 1;

  const progress = request.target_amount ? Math.min(100, (((request.current_amount || 0) / request.target_amount) * 100)) : 0;
  const requestAmount = parseFloat(donateAmount) || 0;
  const grossAmount = requestAmount > 0 ? Number((requestAmount / (1 - PLATFORM_FEE_PERCENT / 100)).toFixed(2)) : 0;
  const feeAmount = grossAmount > 0 ? Number((grossAmount - requestAmount).toFixed(2)) : 0;

  const { data: comments = [] } = useQuery({
    queryKey: ["help-comments", request.id, user?.id],
    queryFn: async () => {
      const { data: commentRows, error: commentsError } = await supabase
        .from("help_comments")
        .select("*")
        .eq("help_request_id", request.id)
        .order("created_at", { ascending: true });

      if (commentsError) throw commentsError;

      const commentIds = (commentRows ?? []).map((comment) => comment.id);

      const { data: reactionRows, error: reactionsError } = commentIds.length
        ? await supabase
            .from("help_comment_reactions" as never)
            .select("comment_id, user_id, emoji")
            .in("comment_id", commentIds)
        : { data: [], error: null };

      if (reactionsError) throw reactionsError;

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

  const donate = useMutation({
    mutationFn: async () => {
      const net = parseFloat(donateAmount);
      if (!net || net <= 0) throw new Error("Enter a valid amount");
      const amount = Number((net / (1 - PLATFORM_FEE_PERCENT / 100)).toFixed(2));
      const fee = Number((amount - net).toFixed(2));

      const { error } = await supabase.from("help_donations").insert({
        help_request_id: request.id,
        amount,
        donor_name: member?.full_name || "Anonymous",
        is_anonymous: false,
      });
      if (error) throw error;

      if (churchId) {
        const { error: feeError } = await supabase.from("platform_fees").insert({
          church_id: churchId,
          source_type: "community_help",
          source_id: request.id,
          gross_amount: amount,
          fee_percentage: PLATFORM_FEE_PERCENT,
          fee_amount: fee,
          net_amount: net,
          member_id: member?.id ?? null,
        });

        if (feeError) throw feeError;
      }

      await supabase.from("community_help_requests").update({
        current_amount: (request.current_amount || 0) + net,
      }).eq("id", request.id);

      if (member?.id && churchId) {
        await supabase.from("contributions").insert({
          church_id: churchId,
          amount: net,
          donor_name: member.full_name,
          member_id: member.id,
          created_by: user?.id || null,
          notes: `Community Help Donation - ${request.category}: ${request.description?.slice(0, 60)} (${formatTZS(fee)} platform fee)`,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-community-help-approved"] });
      queryClient.invalidateQueries({ queryKey: ["my-help-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-contributions-all"] });
      queryClient.invalidateQueries({ queryKey: ["contributions"] });
      toast({
        title: "Donation recorded!",
        description: `${formatTZS(requestAmount)} will go to the help request. Total paid was ${formatTZS(grossAmount)}, including a ${formatTZS(feeAmount)} platform fee.`,
      });
      setDonateOpen(false);
      setDonateAmount("");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!commentText.trim()) throw new Error("Comment cannot be empty");
      const { error } = await supabase.from("help_comments").insert({
        help_request_id: request.id,
        member_id: member?.id || null,
        author_name: member?.full_name || "Member",
        comment: commentText.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["help-comments", request.id] });
      toast({ title: "Comment posted" });
      setCommentText("");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
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
          .from("help_comment_reactions" as never)
          .delete()
          .eq("comment_id", commentId)
          .eq("user_id", user.id);

        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from("help_comment_reactions" as never)
        .upsert({ comment_id: commentId, user_id: user.id, emoji } as never, {
          onConflict: "comment_id,user_id",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["help-comments", request.id] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const statusColor = (status: string) => {
    if (status === "approved") return "bg-success/20 text-success border-success/30";
    if (status === "pending") return "bg-primary/20 text-primary border-primary/30";
    return "bg-destructive/10 text-destructive border-destructive/20";
  };

  return (
    <Card className="glass-card hover:gold-glow transition-shadow">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium">{request.member_name}</p>
            <Badge variant="outline" className={`${statusColor(request.status)} mt-1`}>{request.status}</Badge>
          </div>
          <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">{request.category}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{request.description}</p>
        {request.target_amount && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatTZS(request.current_amount || 0)} raised</span>
              <span>{formatTZS(request.target_amount)} goal</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}
        <p className="text-xs text-muted-foreground/60">{new Date(request.created_at).toLocaleDateString()}</p>

        <div className="flex items-center gap-2 border-t border-border/50 pt-2">
          <Dialog open={donateOpen} onOpenChange={setDonateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="default" className="gap-1.5">
                <HandCoins className="h-3.5 w-3.5" /> Donate
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle className="font-serif">Donate to Help Request</DialogTitle></DialogHeader>
              <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); donate.mutate(); }}>
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <p className="font-medium">{request.member_name} - {request.category}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{request.description?.slice(0, 100)}</p>
                </div>
                {member && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-primary" />
                    <span className="font-medium">{member.full_name}</span>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Amount (TZS) *</Label>
                  <Input type="number" placeholder="Amount help request should receive" value={donateAmount} onChange={(event) => setDonateAmount(event.target.value)} required min="1000" />
                </div>
                {requestAmount > 0 && (
                  <div className="space-y-1 rounded-lg border border-border bg-muted/50 p-3">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Help request receives</span>
                      <span>{formatTZS(requestAmount)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Platform fee ({PLATFORM_FEE_PERCENT}%)</span>
                      <span>{formatTZS(feeAmount)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-1 text-sm font-medium">
                      <span>You pay</span>
                      <span className="text-primary">{formatTZS(grossAmount)}</span>
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" type="button" onClick={() => setDonateOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={donate.isPending || !donateAmount}>
                    {donate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Donate {requestAmount ? formatTZS(grossAmount) : ""}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowComments(!showComments)}>
            <MessageCircle className="h-3.5 w-3.5" /> Comments {comments.length > 0 ? `(${comments.length})` : ""}
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
            quickEmojis={HELP_COMMENT_EMOJIS}
            reactionEmojis={HELP_COMMENT_EMOJIS}
            draftPlaceholder="Share encouragement or ask a follow-up question..."
            emptyState="No comments yet. Offer encouragement or ask how you can help."
            onToggleReaction={(commentId, emoji, reacted) =>
              toggleCommentReaction.mutate({ commentId, emoji, reacted })
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
