import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { KanisaAIConversationPreview } from "@/lib/ai";

type KanisaAIPreviewDialogProps = {
  preview: KanisaAIConversationPreview | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function KanisaAIPreviewDialog({ preview, open, onOpenChange }: KanisaAIPreviewDialogProps) {
  if (!preview) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              {preview.badge ? <Badge className="mb-2 rounded-full">{preview.badge}</Badge> : null}
              <DialogTitle className="font-serif text-2xl">{preview.title}</DialogTitle>
              {preview.subtitle ? <DialogDescription>{preview.subtitle}</DialogDescription> : null}
            </div>
          </div>
        </DialogHeader>

        {preview.imageUrl ? (
          <div className="overflow-hidden rounded-lg border border-border/70 bg-muted">
            <img src={preview.imageUrl} alt="" className="max-h-72 w-full object-cover" />
          </div>
        ) : null}

        {preview.metadata?.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {preview.metadata.map((item) => (
              <div key={`${item.label}-${item.value}`} className="rounded-lg border border-border/70 bg-card/70 px-3 py-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {preview.sections?.length ? (
          <div className="space-y-4">
            {preview.sections.map((section) => (
              <section key={section.title} className="space-y-2">
                <h3 className="text-sm font-semibold uppercase text-muted-foreground">{section.title}</h3>
                <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{section.content}</p>
              </section>
            ))}
          </div>
        ) : null}

        {(preview.primaryAction?.route || preview.secondaryAction?.route) ? (
          <div className="flex flex-wrap gap-2 pt-2">
            {preview.primaryAction?.route ? (
              <Button asChild>
                <Link to={preview.primaryAction.route}>
                  {preview.primaryAction.label}
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : null}
            {preview.secondaryAction?.route ? (
              <Button asChild variant="outline">
                <Link to={preview.secondaryAction.route}>
                  {preview.secondaryAction.label}
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
