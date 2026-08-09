import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  getBibleTranslationAttribution,
  getBibleTranslationSource,
  type BibleTranslationAttribution,
} from "@/lib/bible-translation";

type TranslationInformationDialogProps = {
  translation: BibleTranslationAttribution | null | undefined;
};

function MetadataLine({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}

export function TranslationInformationDialog({ translation }: TranslationInformationDialogProps) {
  const source = getBibleTranslationSource(translation);
  const attribution = getBibleTranslationAttribution(translation);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-10 rounded-lg">
          <Info className="mr-2 h-4 w-4" aria-hidden="true" />
          Translation Information
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Translation Information</DialogTitle>
          <DialogDescription>License and attribution details for this Bible translation.</DialogDescription>
        </DialogHeader>
        {translation ? (
          <div className="space-y-5">
            <dl className="grid gap-4 sm:grid-cols-2">
              <MetadataLine label="Translation" value={translation.name} />
              <MetadataLine label="Publisher" value={translation.publisher} />
              <MetadataLine label="License" value={translation.license_name} />
              <MetadataLine label="Source" value={source} />
              <MetadataLine label="Language" value={translation.language_code} />
              <MetadataLine label="Canon" value={translation.canon_type} />
            </dl>
            {translation.license_url ? (
              <a className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline" href={translation.license_url} target="_blank" rel="noreferrer">
                {translation.license_url}
              </a>
            ) : null}
            {attribution ? (
              <section className="rounded-lg border border-border/70 bg-muted/30 p-4">
                <h3 className="text-sm font-semibold text-foreground">Required Attribution</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{attribution}</p>
              </section>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Translation metadata is not available yet.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
