import { FormEvent, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  Bot,
  BrainCircuit,
  Download,
  Loader2,
  SendHorizonal,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  exportAnalyticsPdf,
  fetchAnalyticsAssistant,
  formatAssistantCurrency,
  type AnalyticsResponse,
} from "@/lib/analytics-assistant";
import { setAnalyticsAssistantPresence } from "@/lib/analytics-assistant-presence";

type ChatMessage =
  | { id: string; role: "assistant"; text: string; report?: AnalyticsResponse }
  | { id: string; role: "user"; text: string };

const SUGGESTED_QUERIES = [
  "Show top contributors",
  "Generate monthly report",
  "Show category breakdown for offerings",
];

export default function AnalyticsAssistantPage() {
  const { churchId, session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [prefillHandled, setPrefillHandled] = useState("");
  const [churchBranding, setChurchBranding] = useState({
    churchName: "Church Analytics",
    churchLocation: "",
    churchLogoUrl: "",
  });
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "intro",
      role: "assistant",
      text: "Ask about giving trends, top contributors, or monthly summaries and I'll turn it into a structured church report.",
    },
  ]);

  const latestReport = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant" && message.report)?.report ?? null,
    [messages],
  );

  useEffect(() => {
    const queuedPrompt = searchParams.get("q")?.trim() || "";
    if (!queuedPrompt || queuedPrompt === prefillHandled || isSubmitting) return;

    setPrefillHandled(queuedPrompt);
    setQuery(queuedPrompt);
    void handleSubmit(undefined, queuedPrompt);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("q");
        return next;
      },
      { replace: true },
    );
  }, [isSubmitting, prefillHandled, searchParams, setSearchParams]);

  useEffect(() => {
    if (!churchId) return;

    let isActive = true;

    const loadChurchBranding = async () => {
      const { data, error: churchError } = await supabase
        .from("churches")
        .select("name, address, logo_url")
        .eq("id", churchId)
        .maybeSingle();

      if (churchError) {
        console.error("Failed to load church branding for analytics PDF export:", churchError);
        return;
      }

      if (!isActive || !data) return;

      setChurchBranding({
        churchName: data.name || "Church Analytics",
        churchLocation: data.address || "",
        churchLogoUrl: data.logo_url || "",
      });
    };

    void loadChurchBranding();

    return () => {
      isActive = false;
    };
  }, [churchId]);

  const handleSubmit = async (event?: FormEvent, overrideQuery?: string) => {
    event?.preventDefault();

    const trimmedQuery = (overrideQuery ?? query).trim();
    if (!trimmedQuery) return;

    if (!churchId || !session?.access_token) {
      setError("Church context or session is missing. Please sign in again and retry.");
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmedQuery,
    };

    setMessages((current) => [...current, userMessage]);
    setQuery("");
    setError("");
    setIsSubmitting(true);
    setAnalyticsAssistantPresence("thinking");

    try {
      const report = await fetchAnalyticsAssistant({
        query: trimmedQuery,
        churchId,
        accessToken: session.access_token,
      });
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: report.warning
          ? `I prepared a ${report.intent.type.replaceAll("_", " ")} view using mock fallback data because live analytics is currently unavailable.`
          : `I found a ${report.intent.type.replaceAll("_", " ")} view for ${report.intent.dateRange.replaceAll("_", " ")} with ${report.intent.category} data from ${report.source === "supabase" ? "live Supabase records" : "mock fallback data"}.`,
        report,
      };

      setMessages((current) => [...current, assistantMessage]);
      setAnalyticsAssistantPresence("success");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "The analytics assistant could not complete that request.",
      );
      setAnalyticsAssistantPresence("idle");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38 }}
        className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/80">AI Analytics</p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">Analytics Assistant</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Explore church giving with natural language prompts, instant summaries, and downloadable PDF reports.
          </p>
        </div>

        {latestReport ? (
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.99 }}>
            <Button className="rounded-xl" onClick={() => exportAnalyticsPdf(latestReport, churchBranding)}>
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </motion.div>
        ) : null}
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden rounded-[30px] border-white/8 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.1),transparent_30%),linear-gradient(180deg,rgba(12,16,24,0.98),rgba(16,22,33,0.94))] shadow-[0_30px_90px_-48px_rgba(0,0,0,0.9)]">
          <CardContent className="p-0">
            <div className="border-b border-white/8 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <BrainCircuit className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Church intelligence workspace</p>
                  <p className="text-sm text-muted-foreground">Type a question and get a structured report back.</p>
                </div>
              </div>
            </div>

            <div className="max-h-[620px] space-y-4 overflow-y-auto px-4 py-5 premium-scrollbar sm:px-6">
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.28 }}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-3xl rounded-[24px] border px-4 py-4 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.8)] ${
                        message.role === "user"
                          ? "border-primary/25 bg-primary/10 text-foreground"
                          : "border-white/8 bg-white/[0.03] text-foreground"
                      }`}
                    >
                      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em]">
                        {message.role === "user" ? (
                          <>
                            <UserRound className="h-3.5 w-3.5 text-primary" />
                            <span className="text-primary/85">You</span>
                          </>
                        ) : (
                          <>
                            <Bot className="h-3.5 w-3.5 text-primary" />
                            <span className="text-primary/85">Assistant</span>
                          </>
                        )}
                      </div>

                      <p className="text-sm leading-6 text-foreground">{message.text}</p>

                      {message.report ? (
                        <div className="mt-5 space-y-4">
                          {message.report.warning ? (
                            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                              {message.report.warning}
                            </div>
                          ) : null}

                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl border border-white/8 bg-background/60 p-4">
                              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total Giving</p>
                              <p className="mt-2 text-lg font-semibold text-foreground">
                                {formatAssistantCurrency(message.report.summary.totalGiving)}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-white/8 bg-background/60 p-4">
                              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Contributors</p>
                              <p className="mt-2 text-lg font-semibold text-foreground">
                                {message.report.summary.contributorCount}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-white/8 bg-background/60 p-4">
                              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Average Gift</p>
                              <p className="mt-2 text-lg font-semibold text-foreground">
                                {formatAssistantCurrency(message.report.summary.averageGift)}
                              </p>
                            </div>
                          </div>

                          <div className="grid gap-4 lg:grid-cols-2">
                            <div className="rounded-2xl border border-white/8 bg-background/60 p-4">
                              <p className="text-sm font-medium text-foreground">Top contributors</p>
                              <div className="mt-3 space-y-2">
                                {message.report.topContributors.map((contributor, index) => (
                                  <div
                                    key={`${message.id}-contributor-${contributor.name}`}
                                    className="flex items-center justify-between rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2"
                                  >
                                    <div>
                                      <p className="text-sm text-foreground">
                                        {index + 1}. {contributor.name}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {contributor.percentage.toFixed(1)}% of filtered giving
                                      </p>
                                    </div>
                                    <p className="text-sm font-medium text-primary">
                                      {formatAssistantCurrency(contributor.total)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-2xl border border-white/8 bg-background/60 p-4">
                              <p className="text-sm font-medium text-foreground">Category breakdown</p>
                              <div className="mt-3 space-y-2">
                                {message.report.categoryBreakdown.map((category) => (
                                  <div
                                    key={`${message.id}-category-${category.category}`}
                                    className="rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2"
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="text-sm text-foreground">{category.category}</p>
                                      <p className="text-sm font-medium text-primary">
                                        {formatAssistantCurrency(category.total)}
                                      </p>
                                    </div>
                                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
                                      <div
                                        className="h-full rounded-full gradient-gold"
                                        style={{ width: `${Math.max(category.percentage, 6)}%` }}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                            <p className="text-sm font-medium text-foreground">Insights</p>
                            <div className="mt-3 space-y-2">
                              {message.report.insights.map((insight, index) => (
                                <div
                                  key={`${message.id}-insight-${index}`}
                                  className="flex items-start gap-2 text-sm text-muted-foreground"
                                >
                                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                  <span>{insight}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isSubmitting ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      Processing your analytics request...
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </div>

            <div className="border-t border-white/8 px-4 py-4 sm:px-6">
              <div className="mb-3 flex flex-wrap gap-2">
                {SUGGESTED_QUERIES.map((suggestion) => (
                  <motion.button
                    key={suggestion}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/25 hover:text-foreground"
                    onClick={() => void handleSubmit(undefined, suggestion)}
                    disabled={isSubmitting}
                  >
                    {suggestion}
                  </motion.button>
                ))}
              </div>

              <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => void handleSubmit(event)}>
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder='Try "Show top contributors" or "Generate monthly report"'
                  className="h-12 rounded-2xl border-white/10 bg-background/70 px-4"
                />
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.99 }}>
                  <Button
                    type="submit"
                    className="h-12 min-w-[140px] rounded-2xl"
                    disabled={isSubmitting || !query.trim()}
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
                    Ask AI
                  </Button>
                </motion.div>
              </form>

              {error ? (
                <p className="mt-3 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="overflow-hidden rounded-[28px] border-white/8 bg-card/90 shadow-[0_24px_70px_-40px_rgba(0,0,0,0.82)]">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-base font-medium text-foreground">What it understands</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    The backend maps keywords to structured intents, then pulls real contribution rows from Supabase using your signed-in church context.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-background/50 p-4 text-sm text-muted-foreground">
                <p>`type`</p>
                <p>`dateRange`</p>
                <p>`category`</p>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-[28px] border-white/8 bg-card/90 shadow-[0_24px_70px_-40px_rgba(0,0,0,0.82)]">
            <CardContent className="space-y-4 p-6">
              <p className="text-base font-medium text-foreground">Recommended prompts</p>
              <div className="space-y-2">
                {SUGGESTED_QUERIES.map((suggestion) => (
                  <div
                    key={suggestion}
                    className="rounded-2xl border border-white/8 bg-background/50 px-4 py-3 text-sm text-muted-foreground"
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
