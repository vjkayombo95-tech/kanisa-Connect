import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, BookOpen, CheckCircle2, ExternalLink, XCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  fetchBibleTranslationMetadata,
  getBibleTranslationAttribution,
  getBibleTranslationSource,
  validateBibleTranslationMetadata,
  type BibleTranslationAttribution,
} from "@/lib/bible-translation";

function StatusBadge({ enabled }: { enabled: boolean | null | undefined }) {
  return (
    <Badge variant={enabled ? "default" : "outline"} className={enabled ? "bg-emerald-600 hover:bg-emerald-600" : ""}>
      {enabled ? "Yes" : "No"}
    </Badge>
  );
}

function DetailLine({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}

function TranslationDetails({ translation }: { translation: BibleTranslationAttribution | null }) {
  if (!translation) {
    return (
      <Card className="rounded-lg border-border/70 bg-card/90">
        <CardContent className="flex min-h-64 flex-col items-center justify-center p-6 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-semibold">Select a translation</h2>
          <p className="mt-1 text-sm text-muted-foreground">Choose a row to inspect attribution and import details.</p>
        </CardContent>
      </Card>
    );
  }

  const source = getBibleTranslationSource(translation);
  const attribution = getBibleTranslationAttribution(translation);

  return (
    <Card className="rounded-lg border-border/70 bg-card/90">
      <CardContent className="space-y-5 p-5">
        <div>
          <p className="text-sm font-medium text-primary">{translation.code}</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">{translation.name}</h2>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailLine label="Language" value={translation.language_code} />
          <DetailLine label="Canon" value={translation.canon_type} />
          <DetailLine label="Publisher" value={translation.publisher} />
          <DetailLine label="License" value={translation.license_name} />
          <DetailLine label="Book Count" value={translation.book_count} />
          <DetailLine label="Chapter Count" value={translation.chapter_count} />
          <DetailLine label="Verse Count" value={translation.verse_count} />
          <DetailLine label="Import Date" value={translation.created_at ? new Date(translation.created_at).toLocaleString() : null} />
        </dl>
        <div className="grid gap-3 sm:grid-cols-2">
          {translation.license_url ? (
            <Button asChild variant="outline" className="justify-start rounded-lg">
              <a href={translation.license_url} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                License URL
              </a>
            </Button>
          ) : null}
          {source ? (
            <Button asChild variant="outline" className="justify-start rounded-lg">
              <a href={source} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                Source URL
              </a>
            </Button>
          ) : null}
        </div>
        <section className="rounded-lg border border-border/70 bg-background/60 p-4">
          <h3 className="text-sm font-semibold">Copyright Notice</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{translation.copyright_notice || "Not provided."}</p>
        </section>
        <section className="rounded-lg border border-border/70 bg-background/60 p-4">
          <h3 className="text-sm font-semibold">Required Attribution</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{attribution || "Not provided."}</p>
        </section>
      </CardContent>
    </Card>
  );
}

export default function BibleTranslationManagerPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: translations = [], isLoading, isError, error } = useQuery({
    queryKey: ["super-admin-bible-translation-metadata"],
    queryFn: fetchBibleTranslationMetadata,
  });

  const selectedTranslation = useMemo(
    () => translations.find((translation) => translation.id === selectedId) ?? translations.find((translation) => translation.default_translation) ?? translations[0] ?? null,
    [selectedId, translations],
  );
  const validationIssues = useMemo(() => validateBibleTranslationMetadata(translations), [translations]);

  return (
    <main className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <p className="text-sm font-medium text-primary">Compliance</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Bible Translation Manager</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Review installed Bible translations, licensing, attribution, and eligibility metadata.</p>
        </div>

        {validationIssues.length > 0 ? (
          <Alert className="rounded-lg border-amber-500/40 bg-amber-500/10">
            <AlertCircle className="h-4 w-4 text-amber-600" aria-hidden="true" />
            <AlertTitle>Metadata validation needs attention</AlertTitle>
            <AlertDescription>
              {validationIssues.map((issue) => `${issue.translation.name || issue.translation.code}: missing ${issue.missing.join(", ")}`).join("; ")}
            </AlertDescription>
          </Alert>
        ) : translations.length > 0 ? (
          <Alert className="rounded-lg border-emerald-500/40 bg-emerald-500/10">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            <AlertTitle>Metadata validation passed</AlertTitle>
            <AlertDescription>Every installed translation includes name, language, license, attribution, and source metadata.</AlertDescription>
          </Alert>
        ) : null}

        {isLoading ? <Skeleton className="h-96 rounded-lg" /> : null}
        {isError ? (
          <Alert variant="destructive" className="rounded-lg">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Unable to load translations</AlertTitle>
            <AlertDescription>{error instanceof Error ? error.message : "Please try again."}</AlertDescription>
          </Alert>
        ) : null}

        {!isLoading && !isError ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
            <Card className="rounded-lg border-border/70 bg-card/90">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Translation Name</TableHead>
                      <TableHead>Language</TableHead>
                      <TableHead>Canon</TableHead>
                      <TableHead>Publisher</TableHead>
                      <TableHead>License</TableHead>
                      <TableHead>Audio Eligible</TableHead>
                      <TableHead>AI Eligible</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Default</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {translations.map((translation) => (
                      <TableRow
                        key={translation.id}
                        className="cursor-pointer"
                        data-state={selectedTranslation?.id === translation.id ? "selected" : undefined}
                        onClick={() => setSelectedId(translation.id)}
                      >
                        <TableCell className="font-medium">{translation.name}</TableCell>
                        <TableCell>{translation.language_code}</TableCell>
                        <TableCell>{translation.canon_type || "-"}</TableCell>
                        <TableCell>{translation.publisher || "-"}</TableCell>
                        <TableCell>{translation.license_name || "-"}</TableCell>
                        <TableCell><StatusBadge enabled={translation.audio_generation_allowed} /></TableCell>
                        <TableCell><StatusBadge enabled={translation.ai_processing_allowed} /></TableCell>
                        <TableCell>{translation.active ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}</TableCell>
                        <TableCell>{translation.default_translation ? <Badge>Default</Badge> : <Badge variant="outline">No</Badge>}</TableCell>
                      </TableRow>
                    ))}
                    {translations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">No translations installed.</TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <TranslationDetails translation={selectedTranslation} />
          </div>
        ) : null}
      </div>
    </main>
  );
}
