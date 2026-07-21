import { useEffect, useState, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExtension from "@tiptap/extension-underline";
import LinkExtension from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  RemoveFormatting,
  Underline,
  Undo2,
  Unlink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  getAnnouncementContentStats,
  isSafeAnnouncementUrl,
  normalizeAnnouncementContent,
  sanitizeAnnouncementHtml,
} from "@/lib/announcement-content";
import { cn } from "@/lib/utils";

type AnnouncementRichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  error?: string;
  "aria-describedby"?: string;
};

type ToolbarButtonProps = {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
};

function ToolbarButton({ label, pressed, disabled, onClick, children }: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-pressed={pressed}
          disabled={disabled}
          onClick={onClick}
          className={cn("h-9 w-9 shrink-0", pressed && "bg-primary/15 text-primary")}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function createAnnouncementEditorExtensions(placeholder: string) {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      link: false,
      underline: false,
    }),
    UnderlineExtension,
    LinkExtension.configure({
      autolink: false,
      openOnClick: false,
      linkOnPaste: false,
      protocols: ["http", "https"],
      isAllowedUri: (url) => isSafeAnnouncementUrl(url),
      HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
    }),
    TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right"] }),
    Placeholder.configure({ placeholder }),
  ];
}

export function AnnouncementRichTextEditor({
  value,
  onChange,
  disabled = false,
  placeholder = "Write the announcement members should receive...",
  error,
  "aria-describedby": ariaDescribedBy,
}: AnnouncementRichTextEditorProps) {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: createAnnouncementEditorExtensions(placeholder),
    content: normalizeAnnouncementContent(value),
    editorProps: {
      attributes: {
        class:
          "tiptap min-h-[240px] w-full px-4 py-4 text-sm leading-7 text-foreground outline-none [&_a]:text-primary [&_a]:underline [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:pl-4 [&_h2]:my-3 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:my-3 [&_h3]:font-serif [&_h3]:text-xl [&_h3]:font-semibold [&_hr]:my-5 [&_hr]:border-border [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_p:first-child]:mt-0 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Announcement message",
        "aria-describedby": ariaDescribedBy ?? "",
        "aria-invalid": error ? "true" : "false",
      },
      transformPastedHTML: (html) => sanitizeAnnouncementHtml(html),
    },
    onUpdate: ({ editor: currentEditor }) => onChange(currentEditor.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;
    const normalizedValue = normalizeAnnouncementContent(value);
    if (editor.getHTML() !== normalizedValue) {
      editor.commands.setContent(normalizedValue, { emitUpdate: false });
    }
  }, [editor, value]);

  const editorState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      canUndo: currentEditor?.can().chain().focus().undo().run() ?? false,
      canRedo: currentEditor?.can().chain().focus().redo().run() ?? false,
      bold: currentEditor?.isActive("bold") ?? false,
      italic: currentEditor?.isActive("italic") ?? false,
      underline: currentEditor?.isActive("underline") ?? false,
      bulletList: currentEditor?.isActive("bulletList") ?? false,
      orderedList: currentEditor?.isActive("orderedList") ?? false,
      blockquote: currentEditor?.isActive("blockquote") ?? false,
      link: currentEditor?.isActive("link") ?? false,
      alignment: currentEditor?.isActive({ textAlign: "center" })
        ? "center"
        : currentEditor?.isActive({ textAlign: "right" })
          ? "right"
          : "left",
      blockStyle: currentEditor?.isActive("heading", { level: 2 })
        ? "h2"
        : currentEditor?.isActive("heading", { level: 3 })
          ? "h3"
          : "paragraph",
    }),
  });

  const stats = getAnnouncementContentStats(value);
  const controlsDisabled = disabled || !editor;

  const openLinkDialog = () => {
    if (!editor) return;
    setLinkUrl((editor.getAttributes("link").href as string | undefined) ?? "https://");
    setLinkError("");
    setLinkDialogOpen(true);
  };

  const applyLink = () => {
    const trimmedUrl = linkUrl.trim();
    if (!isSafeAnnouncementUrl(trimmedUrl)) {
      setLinkError("Enter a valid HTTP or HTTPS URL.");
      return;
    }
    editor?.chain().focus().extendMarkRange("link").setLink({ href: trimmedUrl }).run();
    setLinkDialogOpen(false);
  };

  return (
    <TooltipProvider delayDuration={250}>
      <div
        className={cn(
          "overflow-hidden rounded-xl border bg-background/40 transition-shadow focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20",
          error && "border-destructive/70",
          disabled && "opacity-60",
        )}
      >
        <div className="flex flex-wrap items-center gap-1 border-b border-border/60 bg-muted/25 p-2">
          <ToolbarButton label="Undo (Ctrl+Z)" disabled={controlsDisabled || !editorState?.canUndo} onClick={() => editor?.chain().focus().undo().run()}>
            <Undo2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Redo (Ctrl+Y)" disabled={controlsDisabled || !editorState?.canRedo} onClick={() => editor?.chain().focus().redo().run()}>
            <Redo2 className="h-4 w-4" />
          </ToolbarButton>
          <div className="mx-1 h-6 w-px bg-border" />
          <Select
            value={editorState?.blockStyle ?? "paragraph"}
            disabled={controlsDisabled}
            onValueChange={(style) => {
              if (style === "h2") editor?.chain().focus().toggleHeading({ level: 2 }).run();
              else if (style === "h3") editor?.chain().focus().toggleHeading({ level: 3 }).run();
              else editor?.chain().focus().setParagraph().run();
            }}
          >
            <SelectTrigger aria-label="Paragraph style" className="h-9 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="paragraph">Paragraph</SelectItem>
              <SelectItem value="h2">Heading 2</SelectItem>
              <SelectItem value="h3">Heading 3</SelectItem>
            </SelectContent>
          </Select>
          <div className="mx-1 h-6 w-px bg-border" />
          <ToolbarButton label="Bold (Ctrl+B)" pressed={editorState?.bold} disabled={controlsDisabled} onClick={() => editor?.chain().focus().toggleBold().run()}>
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Italic (Ctrl+I)" pressed={editorState?.italic} disabled={controlsDisabled} onClick={() => editor?.chain().focus().toggleItalic().run()}>
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Underline (Ctrl+U)" pressed={editorState?.underline} disabled={controlsDisabled} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
            <Underline className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Bullet list" pressed={editorState?.bulletList} disabled={controlsDisabled} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Numbered list" pressed={editorState?.orderedList} disabled={controlsDisabled} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Blockquote" pressed={editorState?.blockquote} disabled={controlsDisabled} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Insert link" pressed={editorState?.link} disabled={controlsDisabled} onClick={openLinkDialog}>
            <Link2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Remove link" disabled={controlsDisabled || !editorState?.link} onClick={() => editor?.chain().focus().unsetLink().run()}>
            <Unlink className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Align left" pressed={editorState?.alignment === "left"} disabled={controlsDisabled} onClick={() => editor?.chain().focus().setTextAlign("left").run()}>
            <AlignLeft className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Align center" pressed={editorState?.alignment === "center"} disabled={controlsDisabled} onClick={() => editor?.chain().focus().setTextAlign("center").run()}>
            <AlignCenter className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Align right" pressed={editorState?.alignment === "right"} disabled={controlsDisabled} onClick={() => editor?.chain().focus().setTextAlign("right").run()}>
            <AlignRight className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Horizontal divider" disabled={controlsDisabled} onClick={() => editor?.chain().focus().setHorizontalRule().run()}>
            <Minus className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Clear formatting" disabled={controlsDisabled} onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}>
            <RemoveFormatting className="h-4 w-4" />
          </ToolbarButton>
        </div>

        <EditorContent
          editor={editor}
          className="max-w-full overflow-x-hidden [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-muted-foreground [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]"
        />
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
          <span>{stats.words} {stats.words === 1 ? "word" : "words"}</span>
          <span aria-hidden="true">{"\u00b7"}</span>
          <span>{stats.characters} characters</span>
          {stats.readingMinutes > 0 && (
            <>
              <span aria-hidden="true">{"\u00b7"}</span>
              <span>About {stats.readingMinutes} min read</span>
            </>
          )}
        </div>
      </div>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Insert link</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              applyLink();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="announcement-link-url">Web address</Label>
              <Input
                id="announcement-link-url"
                type="url"
                autoFocus
                value={linkUrl}
                aria-invalid={Boolean(linkError)}
                aria-describedby={linkError ? "announcement-link-error" : undefined}
                onChange={(event) => {
                  setLinkUrl(event.target.value);
                  setLinkError("");
                }}
                placeholder="https://example.com"
              />
              {linkError && <p id="announcement-link-error" className="text-sm text-destructive">{linkError}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Apply link</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
