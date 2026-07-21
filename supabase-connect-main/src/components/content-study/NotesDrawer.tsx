import { FormEvent, useMemo, useState } from "react";
import { MessageSquarePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ContentNote } from "@/lib/content-study";

type NotesDrawerProps = {
  open: boolean;
  reference?: string;
  notes: ContentNote[];
  onOpenChange: (open: boolean) => void;
  onAddNote: (body: string) => Promise<unknown> | void;
};

export function NotesDrawer({ open, reference, notes, onOpenChange, onAddNote }: NotesDrawerProps) {
  const [body, setBody] = useState("");
  const [search, setSearch] = useState("");
  const visibleNotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return notes;
    return notes.filter((note) => [note.reference, note.title, note.body].filter(Boolean).join(" ").toLowerCase().includes(query));
  }, [notes, search]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextBody = body.trim();
    if (!nextBody) return;
    await onAddNote(nextBody);
    setBody("");
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88vh]">
        <DrawerHeader>
          <DrawerTitle>{reference ? `Notes for ${reference}` : "Study notes"}</DrawerTitle>
          <DrawerDescription>Notes are scoped to this content segment and reusable across study workspaces.</DrawerDescription>
        </DrawerHeader>
        <div className="space-y-4 overflow-y-auto px-4 pb-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write a note..." className="min-h-28" />
            <Button type="submit" className="gap-2" disabled={!body.trim()}>
              <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
              Save note
            </Button>
          </form>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes" aria-label="Search notes" />
          <div className="space-y-2">
            {visibleNotes.map((note) => (
              <article key={note.id} className="rounded-lg border border-border/70 bg-card p-3">
                <p className="text-xs font-medium text-muted-foreground">{note.reference ?? "Content note"}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{note.body}</p>
              </article>
            ))}
            {!visibleNotes.length ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No notes yet.</p> : null}
          </div>
        </div>
        <DrawerFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
