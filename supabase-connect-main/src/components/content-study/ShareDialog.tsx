import { Copy, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ShareDialogProps = {
  open: boolean;
  reference: string;
  excerpt: string;
  url?: string;
  onOpenChange: (open: boolean) => void;
  onCopy: (text: string) => Promise<unknown> | void;
  onShare: () => Promise<unknown> | void;
};

export function ShareDialog({ open, reference, excerpt, url, onOpenChange, onCopy, onShare }: ShareDialogProps) {
  const shareText = [reference, excerpt, url].filter(Boolean).join("\n");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share {reference}</DialogTitle>
          <DialogDescription>Share the selected content, reference, or the current reading link.</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-border/70 bg-muted/40 p-3 text-sm leading-6">
          <p className="font-medium">{reference}</p>
          <p className="mt-1 text-muted-foreground">{excerpt}</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => void onCopy(shareText)} className="gap-2">
            <Copy className="h-4 w-4" aria-hidden="true" />
            Copy
          </Button>
          <Button type="button" onClick={() => void onShare()} className="gap-2">
            <Share2 className="h-4 w-4" aria-hidden="true" />
            Share
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
