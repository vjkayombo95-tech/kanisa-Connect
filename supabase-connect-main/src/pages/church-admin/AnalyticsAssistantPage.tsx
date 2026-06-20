import { FormEvent, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  Bot,
  BrainCircuit,
  Download,
  Edit3,
  Loader2,
  MessageSquare,
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
import type {
  AnalyticsContext,
  AnalyticsDashboardSnapshot,
  AnalyticsInsightSeverity,
  AnalyticsReportSection,
  ChartSummary,
  AnalyticsResponse,
} from "@/lib/analytics-assistant";
import { setAnalyticsAssistantPresence } from "@/lib/analytics-assistant-presence";

type ChatMessage =
  | { id: string; role: "assistant"; text: string; report?: AnalyticsResponse }
  | { id: string; role: "user"; text: string };

const SUGGESTED_QUERIES = [
  "Show top contributors",
  "Why did giving change this month?",
  "Show inactive contributors",
  "Generate monthly treasurer report",
  "Show offerings vs tithes",
  "Create WhatsApp follow-up message",
  "Export PDF report",
];

const dashboardCache = new Map<string, AnalyticsDashboardSnapshot>();

function formatAssistantCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getSeverityClasses(severity: AnalyticsInsightSeverity) {
  const classes: Record<AnalyticsInsightSeverity, string> = {
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
    info: "border-sky-500/30 bg-sky-500/10 text-sky-100",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-100",
    danger: "border-red-500/30 bg-red-500/10 text-red-100",
  };
  return classes[severity];
}

function getConfidenceClasses(confidence = 0) {
  if (confidence >= 0.75) return "text-emerald-300";
  if (confidence >= 0.5) return "text-amber-300";
  return "text-red-300";
}

function ChartBars({ chart }: { chart: ChartSummary }) {
  const points = chart?.data ?? [];
  const maxValue = Math.max(...points.map((point) => point.value), 1);

  return (
    <div className="rounded-2xl border border-white/8 bg-background/60 p-4">
      <p className="text-sm font-medium text-foreground">{chart.title}</p>
      <div className="mt-3 space-y-2">
        {points.slice(0, 6).map((point) => (
          <div key={`${chart.kind}-${point.label}`} className="grid grid-cols-[minmax(82px,0.8fr)_1.4fr_auto] items-center gap-3">
            <p className="truncate text-xs text-muted-foreground">{point.label}</p>
            <div className="h-2 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full gradient-gold"
                style={{ width: `${Math.max((point.value / maxValue) * 100, 8)}%` }}
              />
            </div>
            <p className="text-xs font-medium text-primary">{formatAssistantCurrency(point.value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function getReportArrays(report: AnalyticsResponse) {
  return {
    keyMetrics: report.keyMetrics ?? [],
    topContributors: report.topContributors ?? [],
    categoryBreakdown: report.categoryBreakdown ?? [],
    paymentMethodBreakdown: report.paymentMethodBreakdown ?? [],
    charts: report.chartData ?? report.charts ?? [],
    inactiveContributors: report.inactiveContributors ?? [],
    pledgeFollowUps: report.pledgeFollowUps ?? [],
    insights: report.insights ?? [],
  };
}

function shouldShowSection(report: AnalyticsResponse, section: AnalyticsReportSection) {
  return (report.reportSections ?? []).includes(section);
}

export default function AnalyticsAssistantPage() {
  const { churchId, session, user, userRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [prefillHandled, setPrefillHandled] = useState("");
  const [assistantContext, setAssistantContext] = useState<AnalyticsContext | null>(null);
  const [dashboard, setDashboard] = useState<AnalyticsDashboardSnapshot | null>(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [churchBranding, setChurchBranding] = useState({
    churchName: "Church Analytics",
    churchLocation: "",
    churchLogoUrl: "",
  });
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "intro",
      role: "assistant",
      text: "Ask about giving trends, top contributors, monthly summaries, pledges, or announcement drafts. I will read live Supabase records and turn them into a structured church insight.",
    },
  ]);

  const latestReport = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant" && message.report)?.report ?? null,
    [messages],
  );
  const exportReport = async (report: AnalyticsResponse) => {
    const { exportAnalyticsPdf } = await import("@/lib/analytics-assistant");
    await exportAnalyticsPdf({ ...report, proactiveDashboard: dashboard }, churchBranding);
  };

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

  useEffect(() => {
    if (!churchId || !session?.access_token) return;
    const cacheKey = `${churchId}:${userRole || "member"}:${user?.id || ""}`;
    const cached = dashboardCache.get(cacheKey);
    if (cached) {
      setDashboard(cached);
      return;
    }

    let isActive = true;
    setIsDashboardLoading(true);
    import("@/lib/analytics-assistant")
      .then(({ fetchAnalyticsDashboard }) => fetchAnalyticsDashboard({ churchId, userRole, userId: user?.id }))
      .then((snapshot) => {
        if (!isActive) return;
        dashboardCache.set(cacheKey, snapshot);
        setDashboard(snapshot);
      })
      .catch((dashboardError) => {
        console.error("Failed to load proactive analytics dashboard:", dashboardError);
      })
      .finally(() => {
        if (isActive) setIsDashboardLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [churchId, session?.access_token, user?.id, userRole]);

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
      const { fetchAnalyticsAssistant } = await import("@/lib/analytics-assistant");
      const report = await fetchAnalyticsAssistant({
        query: trimmedQuery,
        churchId,
        accessToken: session.access_token,
        userId: user?.id,
        userRole,
        previousContext: assistantContext,
      });
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: report.shortSummary || "I couldn't load the analytics data right now. Please try again.",
        report,
      };

      setMessages((current) => [...current, assistantMessage]);
      if (!report.needsClarification) {
        setAssistantContext({ intent: report.intent, filters: report.detectedFilters });
      }
      setAnalyticsAssistantPresence("success");
    } catch (submissionError) {
      setError("I couldn't load the analytics data right now. Please try again.");
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
            Explore church giving with local intent detection, live Supabase records, instant summaries, and downloadable PDF reports.
          </p>
        </div>

        {latestReport ? (
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.99 }}>
            <Button className="rounded-xl" onClick={() => exportReport(latestReport)}>
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </motion.div>
        ) : null}
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="xl:col-span-2 space-y-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            {[
              { label: "Church Health Score", value: dashboard ? `${dashboard.healthScore.score}/100` : "...", sub: dashboard?.healthScore.status || "Loading" },
              { label: "Giving Trend", value: dashboard?.metrics.givingTrend || "...", sub: "vs last month" },
              { label: "Active Contributors", value: String(dashboard?.metrics.activeContributors ?? "..."), sub: "recent records" },
              { label: "Inactive Members", value: String(dashboard?.metrics.inactiveMembers ?? "..."), sub: "this month" },
              { label: "Outstanding Pledges", value: dashboard ? formatAssistantCurrency(dashboard.metrics.outstandingPledges) : "...", sub: "open balance" },
              { label: "Pledge Completion", value: dashboard ? `${dashboard.metrics.pledgeCompletionRate.toFixed(1)}%` : "...", sub: "collected" },
              { label: "First-Time Contributors", value: String(dashboard?.metrics.firstTimeContributors ?? "..."), sub: "this month" },
            ].map((metric) => (
              <Card key={metric.label} className="rounded-2xl border-white/8 bg-card/90">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{metric.label}</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">{metric.value}</p>
                  <p className="text-xs text-muted-foreground">{metric.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="rounded-[28px] border-white/8 bg-card/90">
            <CardContent className="p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-base font-medium text-foreground">AI Insights Feed</p>
                  <p className="text-sm text-muted-foreground">
                    {isDashboardLoading ? "Reading live Supabase data..." : dashboard?.healthScore.mainReason || "Live proactive insights from church activity."}
                  </p>
                </div>
                {dashboard ? (
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {dashboard.healthScore.status}
                  </span>
                ) : null}
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {(dashboard?.insights ?? []).map((insight) => (
                  <div key={insight.id} className={`rounded-2xl border px-4 py-3 ${getSeverityClasses(insight.severity)}`}>
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 text-base">{insight.severity === "danger" ? "!" : insight.severity === "warning" ? "!" : "+"}</span>
                      <div>
                        <p className="text-sm font-semibold">{insight.title}</p>
                        <p className="mt-1 text-xs opacity-85">{insight.explanation}</p>
                        <p className="mt-2 text-xs font-medium">{insight.recommendedAction}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {!dashboard && !isDashboardLoading ? (
                  <p className="text-sm text-muted-foreground">Insights are unavailable right now.</p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

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

                      {message.report ? (() => {
                        const report = message.report;
                        const reportArrays = getReportArrays(report);
                        const comparison = report.comparison;
                        const showComparison = shouldShowSection(report, "comparison");
                        const showTopContributors = shouldShowSection(report, "top_contributors");
                        const showCategories = shouldShowSection(report, "category_breakdown");
                        const showPaymentMethods = shouldShowSection(report, "payment_methods");
                        const showCharts = shouldShowSection(report, "charts");
                        const showInactive = shouldShowSection(report, "inactive_contributors");
                        const showPledges = shouldShowSection(report, "pledge_follow_ups");
                        const showAnnouncement = shouldShowSection(report, "announcement_draft");
                        const amountFilter = report.detectedFilters?.amountFilter;
                        const amountLabel = amountFilter
                          ? `${amountFilter.operator} ${formatAssistantCurrency(amountFilter.amount)}`
                          : "Any amount";
                        const confidenceClass = getConfidenceClasses(report.confidence);

                        return (
                        <div className="mt-5 space-y-4">
                          {report.warning ? (
                            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                              {report.warning}
                            </div>
                          ) : null}

                          {report.reportTitle ? (
                            <div className="rounded-2xl border border-white/8 bg-background/60 px-4 py-3">
                              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Report</p>
                              <p className="mt-1 text-base font-semibold text-foreground">{report.reportTitle}</p>
                            </div>
                          ) : null}

                          <div className="grid gap-2 rounded-2xl border border-white/8 bg-background/50 p-4 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                              <p className="uppercase tracking-[0.18em] text-muted-foreground/80">Intent</p>
                              <p className="mt-1 text-foreground">{report.intent?.type?.replaceAll("_", " ") || "Unknown"}</p>
                            </div>
                            <div>
                              <p className="uppercase tracking-[0.18em] text-muted-foreground/80">Date Range</p>
                              <p className="mt-1 text-foreground">{report.detectedFilters?.dateLabel || report.dateRangeLabel || "All time"}</p>
                            </div>
                            <div>
                              <p className="uppercase tracking-[0.18em] text-muted-foreground/80">Category</p>
                              <p className="mt-1 text-foreground">{report.detectedFilters?.category || report.intent?.category || "all"}</p>
                            </div>
                            <div>
                              <p className="uppercase tracking-[0.18em] text-muted-foreground/80">Confidence</p>
                              <p className={`mt-1 ${confidenceClass}`}>{Math.round((report.confidence ?? 0) * 100)}% · {amountLabel}</p>
                            </div>
                            <div>
                              <p className="uppercase tracking-[0.18em] text-muted-foreground/80">Member</p>
                              <p className="mt-1 text-foreground">{report.detectedFilters?.memberName || "All allowed"}</p>
                            </div>
                          </div>

                          {report.needsClarification && report.clarificationQuestion ? (
                            <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
                              {report.clarificationQuestion}
                            </div>
                          ) : null}

                          <div className="grid gap-3 sm:grid-cols-3">
                            {reportArrays.keyMetrics.slice(0, 3).map((metric) => (
                              <div key={`${message.id}-${metric.label}`} className="rounded-2xl border border-white/8 bg-background/60 p-4">
                                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{metric.label}</p>
                                <p className="mt-2 text-lg font-semibold text-foreground">{metric.value}</p>
                              </div>
                            ))}
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                              <p className="text-xs uppercase tracking-[0.2em] text-primary/80">Insight</p>
                              <p className="mt-2 text-sm leading-6 text-foreground">{report.insight || "No insight is available yet."}</p>
                            </div>
                            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                              <p className="text-xs uppercase tracking-[0.2em] text-primary/80">Recommended action</p>
                              <p className="mt-2 text-sm leading-6 text-foreground">{report.recommendedAction || "Please try again."}</p>
                            </div>
                          </div>

                          {showComparison && comparison ? (
                            <div className="rounded-2xl border border-white/8 bg-background/60 p-4">
                              <p className="text-sm font-medium text-foreground">Month comparison</p>
                              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                <div>
                                  <p className="text-xs text-muted-foreground">Previous month</p>
                                  <p className="text-sm font-medium text-foreground">
                                    {formatAssistantCurrency(comparison.previousTotal ?? 0)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Change</p>
                                  <p className="text-sm font-medium text-primary">
                                    {formatAssistantCurrency(comparison.changeAmount ?? 0)} (
                                    {(comparison.changePercent ?? 0).toFixed(1)}%)
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Changed most</p>
                                  <p className="text-sm font-medium text-foreground">
                                    {comparison.changedMostCategory || "No category movement"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ) : null}

                          {(showTopContributors || showCategories) ? (
                          <div className="grid gap-4 lg:grid-cols-2">
                            {showTopContributors ? (
                            <div className="rounded-2xl border border-white/8 bg-background/60 p-4">
                              <p className="text-sm font-medium text-foreground">Top contributors</p>
                              <div className="mt-3 space-y-2">
                                {reportArrays.topContributors.map((contributor, index) => (
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
                            ) : null}

                            {showCategories ? (
                            <div className="rounded-2xl border border-white/8 bg-background/60 p-4">
                              <p className="text-sm font-medium text-foreground">Category breakdown</p>
                              <div className="mt-3 space-y-2">
                                {reportArrays.categoryBreakdown.map((category) => (
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
                            ) : null}
                          </div>
                          ) : null}

                          {showPaymentMethods ? (
                            <div className="rounded-2xl border border-white/8 bg-background/60 p-4">
                              <p className="text-sm font-medium text-foreground">Payment method breakdown</p>
                              <div className="mt-3 space-y-2">
                                {reportArrays.paymentMethodBreakdown.map((method) => (
                                  <div
                                    key={`${message.id}-payment-${method.category}`}
                                    className="rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2"
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="text-sm text-foreground">{method.category}</p>
                                      <p className="text-sm font-medium text-primary">
                                        {formatAssistantCurrency(method.total)}
                                      </p>
                                    </div>
                                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
                                      <div
                                        className="h-full rounded-full gradient-gold"
                                        style={{ width: `${Math.max(method.percentage, 6)}%` }}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {showCharts && reportArrays.charts.length > 0 ? (
                            <div className="grid gap-4 lg:grid-cols-2">
                              {reportArrays.charts.map((chart) => (
                                <ChartBars key={`${message.id}-${chart.kind}`} chart={chart} />
                              ))}
                            </div>
                          ) : null}

                          {report.forecast ? (
                            <div className="rounded-2xl border border-white/8 bg-background/60 p-4">
                              <p className="text-sm font-medium text-foreground">Contribution forecast</p>
                              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                                <div>
                                  <p className="text-xs text-muted-foreground">Expected</p>
                                  <p className="text-sm font-semibold text-primary">{formatAssistantCurrency(report.forecast.expectedAmount)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Best case</p>
                                  <p className="text-sm font-semibold text-emerald-300">{formatAssistantCurrency(report.forecast.bestCase)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Worst case</p>
                                  <p className="text-sm font-semibold text-amber-300">{formatAssistantCurrency(report.forecast.worstCase)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Confidence</p>
                                  <p className="text-sm font-semibold text-foreground">{Math.round(report.forecast.confidence * 100)}%</p>
                                </div>
                              </div>
                              <p className="mt-3 text-xs text-muted-foreground">{report.forecast.basis} Trend direction: {report.forecast.direction}.</p>
                            </div>
                          ) : null}

                          {showInactive ? (
                            <div className="rounded-2xl border border-white/8 bg-background/60 p-4">
                              <p className="text-sm font-medium text-foreground">Follow-up priorities</p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {reportArrays.inactiveContributors.length > 0 ? reportArrays.inactiveContributors.map((contributor) => (
                                  <span
                                    key={`${message.id}-inactive-${contributor.name}`}
                                    className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-muted-foreground"
                                  >
                                    {contributor.name} - {formatAssistantCurrency(contributor.total)}
                                  </span>
                                )) : (
                                  <span className="text-sm text-muted-foreground">No inactive contributors were found for this comparison.</span>
                                )}
                              </div>
                            </div>
                          ) : null}

                          {showPledges ? (
                            <div className="rounded-2xl border border-white/8 bg-background/60 p-4">
                              <p className="text-sm font-medium text-foreground">Pledge balance priorities</p>
                              <div className="mt-3 space-y-2">
                                {reportArrays.pledgeFollowUps.length > 0 ? reportArrays.pledgeFollowUps.map((pledge) => (
                                  <div key={`${message.id}-pledge-${pledge.name}`} className="flex items-center justify-between rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2">
                                    <span className="text-sm text-foreground">{pledge.name}</span>
                                    <span className="text-sm font-medium text-primary">{formatAssistantCurrency(pledge.total)}</span>
                                  </div>
                                )) : (
                                  <p className="text-sm text-muted-foreground">No outstanding pledge balances were found.</p>
                                )}
                              </div>
                            </div>
                          ) : null}

                          {showAnnouncement && report.announcementDraft ? (
                            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                              <div className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-primary" />
                                <p className="text-sm font-medium text-foreground">Announcement draft preview</p>
                              </div>
                              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                                {report.announcementDraft}
                              </p>
                              <div className="mt-4 flex flex-wrap gap-2">
                                <Button type="button" size="sm" variant="outline" className="rounded-xl border-white/10">
                                  <Edit3 className="h-4 w-4" />
                                  Edit
                                </Button>
                                <Button type="button" size="sm" className="rounded-xl" disabled>
                                  <SendHorizonal className="h-4 w-4" />
                                  Send
                                </Button>
                              </div>
                            </div>
                          ) : null}

                          {report.actionDraft ? (
                            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                              <div className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-primary" />
                                <p className="text-sm font-medium text-foreground">{report.actionDraft.title}</p>
                              </div>
                              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                                {report.actionDraft.body}
                              </p>
                              <div className="mt-4 flex flex-wrap gap-2">
                                <Button type="button" size="sm" variant="outline" className="rounded-xl border-white/10">
                                  <Edit3 className="h-4 w-4" />
                                  Edit
                                </Button>
                                <Button type="button" size="sm" className="rounded-xl" disabled>
                                  <SendHorizonal className="h-4 w-4" />
                                  Send
                                </Button>
                              </div>
                            </div>
                          ) : null}

                          {(report.followUpPrompts ?? []).length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {(report.followUpPrompts ?? []).map((prompt) => (
                                <button
                                  key={`${message.id}-follow-${prompt}`}
                                  type="button"
                                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/25 hover:text-foreground"
                                  onClick={() =>
                                    prompt.toLowerCase().includes("export") && latestReport
                                      ? exportReport(latestReport)
                                      : void handleSubmit(undefined, prompt)
                                  }
                                >
                                  {prompt}
                                </button>
                              ))}
                            </div>
                          ) : null}

                          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                            <p className="text-sm font-medium text-foreground">Assistant answer</p>
                            <div className="mt-3 space-y-2">
                              {reportArrays.insights.map((insight, index) => (
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
                        );
                      })() : null}
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
                    onClick={() =>
                      suggestion === "Export PDF report" && latestReport
                        ? exportReport(latestReport)
                        : void handleSubmit(undefined, suggestion)
                    }
                    disabled={isSubmitting || (suggestion === "Export PDF report" && !latestReport)}
                  >
                    {suggestion}
                  </motion.button>
                ))}
              </div>

              <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => void handleSubmit(event)}>
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder='Try "Why did giving change this month?"'
                  className="h-12 rounded-2xl border-white/10 bg-background/70 px-4"
                />
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.99 }}>
                  <Button
                    type="submit"
                    className="h-12 min-w-[140px] rounded-2xl"
                    disabled={isSubmitting || !query.trim()}
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
                    Ask
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
                    Local keyword detection maps prompts to structured intents, then reads live Supabase data using your signed-in church context.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-background/50 p-4 text-sm text-muted-foreground">
                <p>`type`</p>
                <p>`privacyMode`</p>
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
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() =>
                      suggestion === "Export PDF report" && latestReport
                        ? exportReport(latestReport)
                        : void handleSubmit(undefined, suggestion)
                    }
                    disabled={isSubmitting || (suggestion === "Export PDF report" && !latestReport)}
                    className="rounded-2xl border border-white/8 bg-background/50 px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary/25 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
