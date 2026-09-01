import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Megaphone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CommentThread, type CommentReactionSummary } from "@/components/portal/CommentThread";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { fetchPortalAnnouncements, getPortalAnnouncementsCache } from "@/lib/portal-announcements";

const ANNOUNCEMENT_REACTION_EMOJIS = ["🎉", "❤️", "🙏", "🥳", "👏", "😊"] as const;
const ANNOUNCEMENT_COMMENT_EMOJIS = ["🎉", "❤️", "🙏", "👏", "😊"] as const;

function isCelebrationAnnouncement(title: string, content: string) {
  const text = `${title} ${content}`.toLowerCase();
  return (
    text.includes("birthday") ||
    text.includes("birthdays") ||
    text.includes("anniversary") ||
    text.includes("wedding anniversary") ||
    text.includes("wedding")
  );
}

export default function PortalAnnouncements() {
  const { user, churchId } = useAuth();
  const { isFeatureEnabled } = useFeatureAccess();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const { data: announcements = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["portal-announcements-all", user?.id, churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const announcementRows = await fetchPortalAnnouncements(churchId, 25);
      const celebrationRows = announcementRows.filter((announcement) =>
        isCelebrationAnnouncement(announcement.title, announcement.content),
      );
      const announcementIds = celebrationRows.map((row) => row.id);

      if (announcementIds.length === 0) {
        return announcementRows.map((announcement) => ({
          ...announcement,
          isCelebration: false,
          reactions: [],
          comments: [],
        }));
      }

      const [{ data: reactions, error: reactionsError }, { data: comments, error: commentsError }] = await Promise.all([
        supabase
          .from("announcement_reactions" as never)
          .select("announcement_id, user_id, emoji")
          .in("announcement_id", announcementIds),
        supabase
          .from("announcement_comments" as never)
          .select("id, announcement_id, user_id, body, created_at")
          .in("announcement_id", announcementIds)
          .order("created_at", { ascending: true }),
      ]);

      if (reactionsError || commentsError) {
        console.warn("Announcement reactions/comments unavailable; showing announcements only.", reactionsError || commentsError);
        return announcementRows.map((announcement) => ({
          ...announcement,
          isCelebration: isCelebrationAnnouncement(announcement.title, announcement.content),
          reactions: [],
          comments: [],
        }));
      }

      const commenterIds = [...new Set(((comments as any[]) ?? []).map((comment) => comment.user_id).filter(Boolean))];
      const { data: profiles, error: profilesError } = commenterIds.length
        ? await supabase.from("profiles").select("id, full_name").in("id", commenterIds)
        : { data: [], error: null };

      if (profilesError) throw profilesError;

      const commentIds = ((comments as any[]) ?? []).map((comment) => comment.id);
      const { data: commentReactions, error: commentReactionsError } = commentIds.length
        ? await supabase
            .from("announcement_comment_reactions" as never)
            .select("comment_id, user_id, emoji")
            .in("comment_id", commentIds)
        : { data: [], error: null };

      if (commentReactionsError) throw commentReactionsError;

      const profileMap = new Map((profiles ?? []).map((profile: any) => [profile.id, profile.full_name || "Member"]));
      const reactionMap = new Map<string, Array<{ emoji: string; count: number; reacted: boolean }>>();
      const groupedReactions = new Map<string, Map<string, Set<string>>>();
      const groupedCommentReactions = new Map<string, Map<string, Set<string>>>();

      ((reactions as any[]) ?? []).forEach((reaction) => {
        if (!groupedReactions.has(reaction.announcement_id)) {
          groupedReactions.set(reaction.announcement_id, new Map());
        }

        const emojiMap = groupedReactions.get(reaction.announcement_id)!;
        if (!emojiMap.has(reaction.emoji)) {
          emojiMap.set(reaction.emoji, new Set());
        }

        emojiMap.get(reaction.emoji)!.add(reaction.user_id);
      });

      groupedReactions.forEach((emojiMap, announcementId) => {
        reactionMap.set(
          announcementId,
          Array.from(emojiMap.entries()).map(([emoji, userIds]) => ({
            emoji,
            count: userIds.size,
            reacted: user ? userIds.has(user.id) : false,
          })),
        );
      });

      ((commentReactions as any[]) ?? []).forEach((reaction) => {
        if (!groupedCommentReactions.has(reaction.comment_id)) {
          groupedCommentReactions.set(reaction.comment_id, new Map());
        }

        const emojiMap = groupedCommentReactions.get(reaction.comment_id)!;
        if (!emojiMap.has(reaction.emoji)) {
          emojiMap.set(reaction.emoji, new Set());
        }

        emojiMap.get(reaction.emoji)!.add(reaction.user_id);
      });

      const commentsMap = new Map<string, any[]>();
      ((comments as any[]) ?? []).forEach((comment) => {
        const list = commentsMap.get(comment.announcement_id) ?? [];
        list.push({
          ...comment,
          author_name: profileMap.get(comment.user_id) || "Member",
          reactions: Array.from(groupedCommentReactions.get(comment.id)?.entries() ?? []).map(
            ([emoji, userIds]): CommentReactionSummary => ({
              emoji,
              count: userIds.size,
              reacted: user ? userIds.has(user.id) : false,
            }),
          ),
        });
        commentsMap.set(comment.announcement_id, list);
      });

      return announcementRows.map((announcement) => ({
        ...announcement,
        isCelebration: isCelebrationAnnouncement(announcement.title, announcement.content),
        reactions: reactionMap.get(announcement.id) ?? [],
        comments: commentsMap.get(announcement.id) ?? [],
      }));
    },
    enabled: !!churchId && isFeatureEnabled("announcements"),
    initialData: () =>
      getPortalAnnouncementsCache(churchId, 25).map((announcement) => ({
        ...announcement,
        isCelebration: isCelebrationAnnouncement(announcement.title, announcement.content),
        reactions: [],
        comments: [],
      })),
    staleTime: 30_000,
  });

  const toggleReaction = useMutation({
    mutationFn: async ({ announcementId, emoji, reacted }: { announcementId: string; emoji: string; reacted: boolean }) => {
      if (!user) throw new Error("You need to sign in to react.");

      if (reacted) {
        const { error } = await supabase
          .from("announcement_reactions" as never)
          .delete()
          .eq("announcement_id", announcementId)
          .eq("user_id", user.id);

        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from("announcement_reactions" as never)
        .upsert({ announcement_id: announcementId, user_id: user.id, emoji } as never, {
          onConflict: "announcement_id,user_id",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-announcements-all"] });
    },
    onError: (error: any) => {
      toast({ title: "Unable to save reaction", description: error.message, variant: "destructive" });
    },
  });

  const addComment = useMutation({
    mutationFn: async (announcementId: string) => {
      if (!user) throw new Error("You need to sign in to comment.");

      const body = (commentDrafts[announcementId] || "").trim();
      if (!body) throw new Error("Write a comment first.");

      const { error } = await supabase
        .from("announcement_comments" as never)
        .insert({ announcement_id: announcementId, user_id: user.id, body } as never);

      if (error) throw error;
    },
    onSuccess: (_, announcementId) => {
      setCommentDrafts((current) => ({ ...current, [announcementId]: "" }));
      queryClient.invalidateQueries({ queryKey: ["portal-announcements-all"] });
    },
    onError: (error: any) => {
      toast({ title: "Unable to add comment", description: error.message, variant: "destructive" });
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
          .from("announcement_comment_reactions" as never)
          .delete()
          .eq("comment_id", commentId)
          .eq("user_id", user.id);

        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from("announcement_comment_reactions" as never)
        .upsert({ comment_id: commentId, user_id: user.id, emoji } as never, {
          onConflict: "comment_id,user_id",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-announcements-all"] });
    },
    onError: (error: any) => {
      toast({ title: "Unable to save comment reaction", description: error.message, variant: "destructive" });
    },
  });

  const celebrationAnnouncements = useMemo(
    () => announcements.filter((announcement: any) => announcement.isCelebration),
    [announcements],
  );

  return (
    <main className="min-h-full overflow-x-hidden bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.28))] px-4 py-5 pb-28 lg:px-8 lg:pb-10">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="space-y-1">
          <p className="text-sm font-bold text-primary">Kanisa Connect</p>
          <h1 className="break-words font-serif text-2xl font-bold md:text-3xl">Matangazo</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Pata taarifa na habari mpya kutoka parokiani.
          </p>
        </header>

        {isLoading ? (
          <div role="status" aria-live="polite" className="space-y-3">
            <Skeleton className="h-28 rounded-[24px]" />
            <Skeleton className="h-28 rounded-[24px]" />
            <span className="sr-only">Matangazo yanapakiwa...</span>
          </div>
        ) : isError ? (
          <Card className="rounded-[24px] border-destructive/30 bg-card/85">
            <CardContent className="flex flex-col items-center gap-3 px-5 py-8 text-center" role="alert">
              <AlertCircle className="h-9 w-9 text-destructive" />
              <div>
                <p className="font-semibold text-destructive">Imeshindikana kupakia matangazo.</p>
                <p className="mt-1 text-sm text-muted-foreground">Jaribu tena kupata taarifa mpya za parokia.</p>
              </div>
              <Button type="button" variant="outline" onClick={() => void refetch()}>
                Jaribu tena
              </Button>
            </CardContent>
          </Card>
        ) : announcements.length === 0 ? (
          <Card className="rounded-[24px] border-border/70 bg-card/80">
            <CardContent className="flex items-start gap-4 p-5 text-muted-foreground">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Megaphone className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-foreground">Hakuna matangazo kwa sasa.</p>
                <p className="mt-1 text-sm">Matangazo mapya yataonekana hapa yatakapochapishwa.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement: any) => (
              <Card key={announcement.id} className="rounded-[24px] border-border/70 bg-card/85 shadow-sm">
                <CardContent className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-lg">{announcement.title}</h3>
                      {announcement.isCelebration && (
                        <Badge variant="outline" className="mt-2 border-primary/30 bg-primary/10 text-primary">
                          Sherehe
                        </Badge>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{announcement.content}</p>
                  <p className="text-xs text-muted-foreground/60 mt-4">
                    {new Date(announcement.created_at).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>

                  {announcement.isCelebration && (
                    <div className="mt-5 space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {announcement.reactions.map((reaction: any) => (
                          <Button
                            key={`${announcement.id}-${reaction.emoji}`}
                            type="button"
                            variant="outline"
                            size="sm"
                            className={`h-8 rounded-full px-2 text-xs ${
                              reaction.reacted ? "border-primary/40 bg-primary/10 text-primary" : ""
                            }`}
                            onClick={() =>
                              toggleReaction.mutate({
                                announcementId: announcement.id,
                                emoji: reaction.emoji,
                                reacted: reaction.reacted,
                              })
                            }
                            disabled={toggleReaction.isPending}
                          >
                            <span className="mr-1">{reaction.emoji}</span>
                            {reaction.count}
                          </Button>
                        ))}
                        {ANNOUNCEMENT_REACTION_EMOJIS.map((emoji) => {
                          const existing = announcement.reactions.find((reaction: any) => reaction.emoji === emoji);
                          if (existing) return null;

                          return (
                            <Button
                              key={`${announcement.id}-${emoji}`}
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 rounded-full px-2 text-xs"
                              onClick={() =>
                                toggleReaction.mutate({
                                  announcementId: announcement.id,
                                  emoji,
                                  reacted: false,
                                })
                              }
                              disabled={toggleReaction.isPending}
                            >
                              {emoji}
                            </Button>
                          );
                        })}
                      </div>

                      <CommentThread
                        comments={announcement.comments}
                        draft={commentDrafts[announcement.id] || ""}
                        onDraftChange={(value) =>
                          setCommentDrafts((current) => ({ ...current, [announcement.id]: value }))
                        }
                        onSubmit={() => addComment.mutate(announcement.id)}
                        submitDisabled={addComment.isPending || !(commentDrafts[announcement.id] || "").trim()}
                        submitPending={addComment.isPending}
                        reactionPending={toggleCommentReaction.isPending}
                        quickEmojis={ANNOUNCEMENT_COMMENT_EMOJIS}
                        reactionEmojis={ANNOUNCEMENT_COMMENT_EMOJIS}
                        draftPlaceholder="Andika ujumbe mwema..."
                        emptyState="Hakuna maoni bado. Kuwa wa kwanza kusherehekea."
                        className="mt-0 border-white/10 bg-white/[0.03]"
                        onToggleReaction={(commentId, emoji, reacted) =>
                          toggleCommentReaction.mutate({ commentId, emoji, reacted })
                        }
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && celebrationAnnouncements.length === 0 && announcements.length > 0 && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Maoni na hisia za emoji huonekana kwenye matangazo ya siku za kuzaliwa na maadhimisho ya ndoa.
          </p>
        )}
      </div>
    </main>
  );
}
