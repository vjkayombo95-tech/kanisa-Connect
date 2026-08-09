import { MessageCircle, Send, SmilePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type CommentReactionSummary = {
  emoji: string;
  count: number;
  reacted: boolean;
};

export type ThreadComment = {
  id: string;
  author_name: string;
  created_at: string;
  body: string;
  reactions?: CommentReactionSummary[];
};

type CommentThreadProps = {
  comments: ThreadComment[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  submitDisabled?: boolean;
  submitPending?: boolean;
  reactionPending?: boolean;
  className?: string;
  emptyState?: string;
  draftPlaceholder?: string;
  quickEmojis?: readonly string[];
  reactionEmojis?: readonly string[];
  onToggleReaction?: (commentId: string, emoji: string, reacted: boolean) => void;
};

export function CommentThread({
  comments,
  draft,
  onDraftChange,
  onSubmit,
  submitDisabled,
  submitPending,
  reactionPending,
  className,
  emptyState = "No comments yet. Start the conversation.",
  draftPlaceholder = "Write a comment...",
  quickEmojis = [],
  reactionEmojis = [],
  onToggleReaction,
}: CommentThreadProps) {
  return (
    <div
      className={cn(
        "mt-4 space-y-4 rounded-2xl border border-border/60 bg-background/40 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <MessageCircle className="h-4 w-4 text-primary" />
        <span>Comments</span>
        <span className="text-muted-foreground">({comments.length})</span>
      </div>

      {comments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 px-4 py-5 text-sm text-muted-foreground">
          {emptyState}
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => {
            const knownReactionEmojis = new Set((comment.reactions ?? []).map((reaction) => reaction.emoji));

            return (
              <div
                key={comment.id}
                className="space-y-3 rounded-2xl border border-white/10 bg-gradient-to-b from-[#141922] to-[#0b0f14] px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.22)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{comment.author_name}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{comment.body}</p>
                  </div>
                  <p className="shrink-0 text-[11px] text-muted-foreground">
                    {new Date(comment.created_at).toLocaleString()}
                  </p>
                </div>

                {onToggleReaction ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {(comment.reactions ?? []).map((reaction) => (
                      <Button
                        key={`${comment.id}-${reaction.emoji}`}
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn(
                          "h-8 rounded-full border-white/10 bg-white/[0.03] px-2.5 text-xs text-muted-foreground",
                          reaction.reacted && "border-primary/40 bg-primary/12 text-primary shadow-[0_0_18px_rgba(250,204,21,0.16)]",
                        )}
                        onClick={() => onToggleReaction(comment.id, reaction.emoji, reaction.reacted)}
                        disabled={reactionPending}
                      >
                        <span className="mr-1">{reaction.emoji}</span>
                        {reaction.count}
                      </Button>
                    ))}

                    {reactionEmojis
                      .filter((emoji) => !knownReactionEmojis.has(emoji))
                      .map((emoji) => (
                        <Button
                          key={`${comment.id}-${emoji}`}
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 rounded-full px-2.5 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary"
                          onClick={() => onToggleReaction(comment.id, emoji, false)}
                          disabled={reactionPending}
                        >
                          {emoji}
                        </Button>
                      ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-3 rounded-2xl border border-primary/10 bg-primary/[0.04] p-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-primary/80">
          <SmilePlus className="h-3.5 w-3.5" />
          Add Your Voice
        </div>

        {quickEmojis.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {quickEmojis.map((emoji) => (
              <Button
                key={emoji}
                type="button"
                size="sm"
                variant="outline"
                className="h-8 rounded-full border-white/10 bg-white/[0.03] px-2.5 text-sm hover:border-primary/30 hover:bg-primary/10"
                onClick={() => onDraftChange(draft ? `${draft} ${emoji}` : emoji)}
              >
                {emoji}
              </Button>
            ))}
          </div>
        ) : null}

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <Textarea
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder={draftPlaceholder}
            className="min-h-[92px] resize-none rounded-2xl border-white/10 bg-background/70 text-sm leading-6"
          />

          <div className="flex justify-end">
            <Button type="submit" disabled={submitDisabled} className="gap-2">
              <Send className="h-4 w-4" />
              {submitPending ? "Posting..." : "Post Comment"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
