import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CommentThread, type CommentReactionSummary } from "@/components/portal/CommentThread";
import { ScriptureText } from "@/components/bible";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { fetchPortalAnnouncements, getPortalAnnouncementsCache } from "@/lib/portal-announcements";
import { useTranslation } from "react-i18next";
import { formatLocalizedDate, normalizeAppLanguage } from "@/lib/localization";

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
  const { i18n, t } = useTranslation();
  const language = normalizeAppLanguage(i18n.language) ?? "en";
  const { user, churchId } = useAuth();
  const { isFeatureEnabled } = useFeatureAccess();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const { data: announcements = [], isLoading } = useQuery({
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

      const profileMap = new Map((profiles ?? []).map((profile: any) => [profile.id, profile.full_name || t("member_portal.common.member")]));
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
          author_name: profileMap.get(comment.user_id) || t("member_portal.common.member"),
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
      if (!user) throw new Error(t("member_portal.parish_life.sign_in_to_react"));

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
      toast({ title: t("member_portal.parish_life.unable_save_reaction"), description: error.message, variant: "destructive" });
    },
  });

  const addComment = useMutation({
    mutationFn: async (announcementId: string) => {
      if (!user) throw new Error(t("member_portal.parish_life.sign_in_to_comment"));

      const body = (commentDrafts[announcementId] || "").trim();
      if (!body) throw new Error(t("member_portal.parish_life.write_comment_first"));

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
      toast({ title: t("member_portal.parish_life.unable_add_comment"), description: error.message, variant: "destructive" });
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
      if (!user) throw new Error(t("member_portal.parish_life.sign_in_to_react"));

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
      toast({ title: t("member_portal.parish_life.unable_save_comment_reaction"), description: error.message, variant: "destructive" });
    },
  });

  const celebrationAnnouncements = useMemo(
    () => announcements.filter((announcement: any) => announcement.isCelebration),
    [announcements],
  );

  return (
    <div className="container mx-auto px-4 py-10 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold font-serif mb-2">{t("member_portal.parish_life.announcements")}</h1>
        <p className="text-muted-foreground mb-8">{t("member_portal.parish_life.announcements_description")}</p>

        {isLoading ? (
          <p className="text-muted-foreground">{t("member_portal.parish_life.loading_announcements")}</p>
        ) : announcements.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="py-16 text-center text-muted-foreground">
              <Megaphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              {t("member_portal.parish_life.no_announcements")}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement: any) => (
              <Card key={announcement.id} className="glass-card">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-lg">{announcement.title}</h3>
                      {announcement.isCelebration && (
                        <Badge variant="outline" className="mt-2 border-primary/30 bg-primary/10 text-primary">
                          {t("member_portal.parish_life.celebration")}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                    <ScriptureText text={announcement.content} />
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-4">
                    {formatLocalizedDate(announcement.created_at, language, {
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
                        draftPlaceholder={t("member_portal.parish_life.write_kind_message")}
                        emptyState={t("member_portal.parish_life.no_comments_celebrate")}
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
            {t("member_portal.parish_life.celebration_reactions_hint")}
          </p>
        )}
      </div>
    </div>
  );
}
