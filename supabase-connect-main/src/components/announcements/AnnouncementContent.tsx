import { ScriptureText } from "@/components/bible";
import { isAnnouncementRichText, sanitizeAnnouncementHtml } from "@/lib/announcement-content";
import { cn } from "@/lib/utils";

type AnnouncementContentProps = {
  content: string | null | undefined;
  className?: string;
};

export function AnnouncementContent({ content, className }: AnnouncementContentProps) {
  if (!content) return null;

  if (!isAnnouncementRichText(content)) {
    return (
      <div className={cn("whitespace-pre-wrap", className)}>
        <ScriptureText text={content} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "announcement-rich-text break-words text-sm leading-7 text-muted-foreground",
        "[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4",
        "[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:pl-4 [&_blockquote]:italic",
        "[&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-foreground",
        "[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:font-serif [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-foreground",
        "[&_hr]:my-5 [&_hr]:border-border [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6",
        "[&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: sanitizeAnnouncementHtml(content) }}
    />
  );
}
