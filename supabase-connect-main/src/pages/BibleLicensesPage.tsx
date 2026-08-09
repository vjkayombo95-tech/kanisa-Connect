import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, BookOpen, CheckCircle2, ExternalLink, Volume2 } from "lucide-react";
import { Link } from "react-router-dom";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchBibleTranslationMetadata,
  getBibleTranslationAttribution,
  getBibleTranslationSource,
  validateBibleTranslationMetadata,
} from "@/lib/bible-translation";

export default function BibleLicensesPage() {
  const { data: translations = [], isLoading, isError, error } = useQuery({
    queryKey: ["public-bible-translation-metadata"],
    queryFn: fetchBibleTranslationMetadata,
  });
  const validationIssues = useMemo(() => validateBibleTranslationMetadata(translations), [translations]);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-4">
          <Button asChild variant="ghost" className="rounded-lg px-3">
            <Link to="/">Kanisa Connect</Link>
          </Button>
          <div className="max-w-3xl">
            <p className="flex items-center gap-2 text-sm font-medium text-primary">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              Bible Licenses
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground">Bible Licenses</h1>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Kanisa Connect supports multiple Bible translations. Each translation is licensed independently, carries its own attribution requirements, and may have different permissions for Bible Audio availability.
            </p>
          </div>
        </header>

        {validationIssues.length > 0 ? (
          <Alert className="rounded-lg border-amber-500/40 bg-amber-500/10">
            <AlertCircle className="h-4 w-4 text-amber-600" aria-hidden="true" />
            <AlertTitle>Some translation metadata is incomplete</AlertTitle>
            <AlertDescription>{validationIssues.map((issue) => `${issue.translation.name || issue.translation.code}: missing ${issue.missing.join(", ")}`).join("; ")}</AlertDescription>
          </Alert>
        ) : translations.length > 0 ? (
          <Alert className="rounded-lg border-emerald-500/40 bg-emerald-500/10">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            <AlertTitle>Attribution metadata available</AlertTitle>
            <AlertDescription>Every installed translation includes the required license and attribution fields.</AlertDescription>
          </Alert>
        ) : null}

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-72 rounded-lg" />)}
          </div>
        ) : null}

        {isError ? (
          <Alert variant="destructive" className="rounded-lg">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Unable to load Bible licenses</AlertTitle>
            <AlertDescription>{error instanceof Error ? error.message : "Please try again."}</AlertDescription>
          </Alert>
        ) : null}

        {!isLoading && !isError ? (
          <section className="grid gap-4 md:grid-cols-2">
            {translations.map((translation) => {
              const source = getBibleTranslationSource(translation);
              const attribution = getBibleTranslationAttribution(translation);
              return (
                <Card key={translation.id} className="rounded-lg border-border/70 bg-card/90">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-primary">{translation.code}</p>
                        <h2 className="mt-1 text-xl font-semibold">{translation.name}</h2>
                      </div>
                      {translation.default_translation ? <Badge>Default</Badge> : null}
                    </div>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div><dt className="text-muted-foreground">Language</dt><dd className="font-medium">{translation.language_code}</dd></div>
                      <div><dt className="text-muted-foreground">Canon</dt><dd className="font-medium">{translation.canon_type || "-"}</dd></div>
                      <div><dt className="text-muted-foreground">Publisher</dt><dd className="font-medium">{translation.publisher || "-"}</dd></div>
                      <div><dt className="text-muted-foreground">License</dt><dd className="font-medium">{translation.license_name || "-"}</dd></div>
                    </dl>
                    <div className="flex flex-wrap gap-2">
                      {translation.license_url ? (
                        <Button asChild variant="outline" size="sm" className="rounded-lg">
                          <a href={translation.license_url} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                            License
                          </a>
                        </Button>
                      ) : null}
                      {source ? (
                        <Button asChild variant="outline" size="sm" className="rounded-lg">
                          <a href={source} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                            Source
                          </a>
                        </Button>
                      ) : null}
                      <Badge variant={translation.audio_generation_allowed ? "default" : "outline"} className="gap-1">
                        <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Audio Eligible: {translation.audio_generation_allowed ? "Yes" : "No"}
                      </Badge>
                    </div>
                    <section className="rounded-lg border border-border/70 bg-background/60 p-3">
                      <h3 className="text-sm font-semibold">Required Attribution</h3>
                      <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{attribution || "Not provided."}</p>
                    </section>
                  </CardContent>
                </Card>
              );
            })}
            {translations.length === 0 ? (
              <Card className="rounded-lg border-border/70 bg-card/90 md:col-span-2">
                <CardContent className="py-16 text-center text-muted-foreground">No Bible translations are installed yet.</CardContent>
              </Card>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
