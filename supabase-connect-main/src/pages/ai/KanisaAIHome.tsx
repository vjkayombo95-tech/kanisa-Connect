import { useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, Clock, ExternalLink, Send, Sparkles, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getWorkspaceIdForRole, useWorkspaceContext } from "@/components/workspace";
import { KanisaAIPreviewDialog } from "@/components/ai/KanisaAIPreviewDialog";
import {
  answerKanisaAIConversationAsync,
  createKanisaAIContext,
  createKanisaAssistantMessage,
  createKanisaUserMessage,
  getControlledQuickQuestionIntent,
  resolveKanisaAIExperience,
  type KanisaAIConversationMessage,
  type KanisaAIConversationPreview,
  type KanisaAIConversationResponse,
  type ControlledKanisaAIIntent,
} from "@/lib/ai";
import type { WorkspaceId } from "@/components/workspace";
import type { RecentCommand } from "@/components/ai/command-types";
import { formatLocalizedTime, type AppLanguage } from "@/lib/localization";

const COMMAND_HISTORY_KEY = "kanisa-command-center-history:v1";

function readRecentCommands() {
  if (typeof window === "undefined") return [] as RecentCommand[];
  try {
    return (JSON.parse(window.localStorage.getItem(COMMAND_HISTORY_KEY) || "[]") as RecentCommand[]).slice(0, 5);
  } catch {
    return [];
  }
}

function statusVariant(status: KanisaAIConversationResponse["status"]) {
  if (status === "success") return "secondary";
  if (status === "provider_required" || status === "unavailable") return "outline";
  if (status === "unauthorized" || status === "forbidden" || status === "error") return "destructive";
  return "outline";
}

export function ConversationResponseCard({
  response,
  onPreview,
  onRetry,
}: {
  response: KanisaAIConversationResponse;
  onPreview: (preview: KanisaAIConversationPreview) => void;
  onRetry: (input: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-3 space-y-3 rounded-lg border border-border/70 bg-background/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-serif text-lg font-bold text-foreground">{response.title}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{response.summary}</p>
        </div>
        <Badge variant={statusVariant(response.status)} className="rounded-full">
          {response.status.replace("_", " ")}
        </Badge>
      </div>

      {response.sections.map((section) => (
        <section key={section.id} className="space-y-3" aria-label={section.title}>
          <p className="text-xs font-semibold uppercase text-muted-foreground">{section.title}</p>
          {section.metrics?.length ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {section.metrics.map((metric) => (
                <div key={metric.label} className="rounded-lg border border-border/70 bg-card/70 px-3 py-2">
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                  <p className="text-sm font-semibold text-foreground">{metric.value}</p>
                </div>
              ))}
            </div>
          ) : null}
          {section.items?.length ? (
            <div className="space-y-2">
              {section.items.map((item) => (
                <div key={item.id} className="rounded-lg border border-border/70 bg-card/70 px-3 py-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.title}</p>
                      {item.description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p> : null}
                      {item.metadata ? <p className="mt-1 text-xs text-primary">{item.metadata}</p> : null}
                    </div>
                    {item.preview ? (
                      <Button size="sm" variant="outline" className="shrink-0" onClick={() => onPreview(item.preview!)}>
                        {t("ai.preview")}
                      </Button>
                    ) : item.route ? (
                      <Button asChild size="sm" variant="outline" className="shrink-0">
                        <Link to={item.route}>{t("ai.open")}</Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ))}

      {response.actions.length ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {response.actions.map((item) =>
            item.route ? (
              <Button key={item.id} asChild size="sm">
                <Link to={item.route}>
                  {item.label}
                  <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : item.preview ? (
              <Button key={item.id} size="sm" variant="outline" onClick={() => onPreview(item.preview!)}>
                {item.label}
              </Button>
            ) : item.retryInput ? (
              <Button key={item.id} size="sm" variant="outline" onClick={() => onRetry(item.retryInput!)}>
                {item.label}
              </Button>
            ) : (
              <Button key={item.id} size="sm" disabled>
                {item.label}
              </Button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

function ConversationMessage({
  message,
  onPreview,
  onRetry,
}: {
  message: KanisaAIConversationMessage;
  onPreview: (preview: KanisaAIConversationPreview) => void;
  onRetry: (input: string) => void;
}) {
  const { i18n, t } = useTranslation();
  const isUser = message.role === "user";
  const language = i18n.language === "sw" ? "sw" : "en";
  return (
    <article className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-3xl rounded-lg border px-4 py-3 ${isUser ? "border-primary/40 bg-primary/10" : "border-border/70 bg-card/95"}`}>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{isUser ? t("ai.you") : message.role === "system" ? t("ai.notice") : t("ai.brand")}</span>
          <span>{formatLocalizedTime(message.timestamp, language)}</span>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{message.text}</p>
        {message.response ? <ConversationResponseCard response={message.response} onPreview={onPreview} onRetry={onRetry} /> : null}
      </div>
    </article>
  );
}

export default function KanisaAIHome() {
  const { i18n, t } = useTranslation();
  const { churchId, isSuperAdmin, userRole, user } = useAuth();
  const workspaceContext = useWorkspaceContext();
  const location = useLocation();
  const queryClient = useQueryClient();
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const lastControlledIntentRef = useRef<ControlledKanisaAIIntent | null>(null);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<KanisaAIConversationMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activePreview, setActivePreview] = useState<KanisaAIConversationPreview | null>(null);
  const workspace = workspaceContext?.workspace.id ?? getWorkspaceIdForRole(userRole, isSuperAdmin);
  const language = (i18n.language === "sw" ? "sw" : "en") satisfies AppLanguage;
  const aiContext = useMemo(
    () =>
      createKanisaAIContext({
        workspace,
        role: userRole,
        isSuperAdmin,
        church: { id: churchId },
        tenant: { id: churchId },
        route: location.pathname,
        page: "kanisa-ai-home",
        language,
        queryClient,
        user,
      }),
    [churchId, isSuperAdmin, language, location.pathname, queryClient, user, userRole, workspace],
  );
  const experience = useMemo(() => resolveKanisaAIExperience(aiContext), [aiContext]);
  const assistants = experience.assistants;
  const recentCommands = useMemo(() => readRecentCommands(), [churchId, workspace]);

  const submitQuestion = (question: string, controlledIntent?: ControlledKanisaAIIntent | null) => {
    const text = question.trim();
    if (!text || isProcessing) return;
    setDraft("");
    setIsProcessing(true);
    const userMessage = createKanisaUserMessage(text);
    setMessages((current) => [...current, userMessage]);

    window.setTimeout(() => {
      try {
        void answerKanisaAIConversationAsync(text, aiContext, {
          controlledIntent,
          lastIntent: lastControlledIntentRef.current,
        }).then((response) => {
          if (["PENDING_INVITATIONS", "UPCOMING_EVENTS", "UNRESOLVED_PRAYER_REQUESTS", "CONTRIBUTION_SUMMARY"].includes(response.intent)) {
            lastControlledIntentRef.current = response.intent as ControlledKanisaAIIntent;
          }
          setMessages((current) => [...current, createKanisaAssistantMessage(response)]);
        }).catch(() => {
          const response: KanisaAIConversationResponse = {
            id: `kanisa-ai-error-${Date.now()}`,
            intent: "UNKNOWN",
            status: "error",
            title: "Kanisa AI Could Not Load This",
            summary: "Kanisa AI could not load this information right now. Please try again.",
            message: "Kanisa AI could not load this information right now. Please try again.",
            sections: [],
            actions: [],
            suggestions: [],
            sourceType: "local-router",
            providerRequired: false,
          };
          setMessages((current) => [...current, createKanisaAssistantMessage(response)]);
        }).finally(() => {
          setIsProcessing(false);
          window.setTimeout(() => composerRef.current?.focus(), 0);
        });
      } catch {
        const response: KanisaAIConversationResponse = {
          id: `kanisa-ai-error-${Date.now()}`,
          intent: "UNKNOWN",
          status: "error",
          title: "Kanisa AI Could Not Load This",
          summary: "Kanisa AI could not load this information right now. Please try again.",
          message: "Kanisa AI could not load this information right now. Please try again.",
          sections: [],
          actions: [],
          suggestions: [],
          sourceType: "local-router",
          providerRequired: false,
        };
        setMessages((current) => [...current, createKanisaAssistantMessage(response)]);
        setIsProcessing(false);
        window.setTimeout(() => composerRef.current?.focus(), 0);
      }
    }, 120);
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitQuestion(draft);
  };

  const onComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitQuestion(draft);
    }
  };

  return (
    <main className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-6 pb-28 lg:px-8 lg:pb-10">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="overflow-hidden rounded-2xl border border-primary/20 bg-card/95 shadow-sm" aria-label={t("ai.conversation_label")}>
          <div className="border-b border-border/70 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_34rem)] p-5 sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <p className="flex items-center gap-2 text-sm font-medium text-primary">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  {t("ai.brand")}
                </p>
                <h1 className="mt-4 font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  {experience.title}
                </h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
                  {experience.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {experience.sections.map((section) => (
                    <Badge key={section} variant="secondary" className="rounded-full">
                      {section}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 p-3 text-sm text-muted-foreground lg:max-w-xs">
                <Badge variant="outline" className="mb-3 w-fit rounded-full">
                  {t("ai.workspace_badge", { workspace: workspace.replace("_", " ") })}
                </Badge>
                <p>{t("ai.scope_description")}</p>
              </div>
            </div>
          </div>

          <div className="grid min-h-[58vh] bg-background/30 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="flex min-h-[58vh] flex-col">
              <div className="flex-1 space-y-4 p-4 sm:p-6" aria-live="polite" aria-busy={isProcessing}>
                {messages.length ? (
                  messages.map((message) => <ConversationMessage key={message.id} message={message} onPreview={setActivePreview} onRetry={submitQuestion} />)
                ) : (
                  <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/70 p-6 text-center">
                    <div className="max-w-2xl">
                      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Bot className="h-7 w-7" />
                      </span>
                      <h2 className="mt-4 font-serif text-2xl font-bold text-foreground">{t("ai.ask")}</h2>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("ai.empty_thread")}</p>
                      <div className="mt-5 flex flex-wrap justify-center gap-2" aria-label="Suggested prompts">
                        {experience.suggestedPrompts.slice(0, 4).map((prompt) => (
                          <Button
                            key={prompt}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-auto whitespace-normal rounded-full py-1.5 text-left"
                            onClick={() => submitQuestion(prompt, getControlledQuickQuestionIntent(prompt))}
                          >
                            {prompt}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {isProcessing ? (
                  <div className="rounded-lg border border-border/70 bg-card/90 px-4 py-3 text-sm text-muted-foreground">
                    {t("ai.checking_data")}
                  </div>
                ) : null}
              </div>

              <form onSubmit={onSubmit} className="border-t border-border/70 bg-card/95 p-4 sm:p-5">
                <label htmlFor="kanisa-ai-composer" className="sr-only">
                  {t("ai.ask")}
                </label>
                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                  <textarea
                    ref={composerRef}
                    id="kanisa-ai-composer"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={onComposerKeyDown}
                    rows={3}
                    className="min-h-24 flex-1 resize-y rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder={t(`ai.placeholder.${workspace}`)}
                    aria-label={t("ai.ask_aria")}
                  />
                  <div className="flex gap-2 md:flex-col">
                    <Button type="submit" disabled={!draft.trim() || isProcessing} className="min-w-32 gap-2">
                      <Send className="h-4 w-4" />
                      {isProcessing ? t("ai.checking") : t("ai.ask")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!messages.length || isProcessing}
                      onClick={() => {
                        setMessages([]);
                        setDraft("");
                        lastControlledIntentRef.current = null;
                        composerRef.current?.focus();
                      }}
                      className="gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      {t("ai.clear")}
                    </Button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{t("ai.enter_hint")}</p>
              </form>
            </div>

            <aside className="border-t border-border/70 bg-card/70 p-4 lg:border-l lg:border-t-0 sm:p-5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4 text-primary" />
                {t("ai.recent_commands")}
              </p>
              {recentCommands.length ? (
                <div className="mt-3 space-y-2">
                  {recentCommands.map((command) => (
                    <div key={command.id} className="rounded-lg border border-border/70 bg-background/70 px-3 py-2">
                      <p className="text-sm font-medium">{command.title}</p>
                      <p className="text-xs text-muted-foreground">{command.intent}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">{t("ai.no_recent_commands")}</p>
              )}

              <div className="mt-5 space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">{t("ai.explore_assistants")}</p>
                {assistants.slice(0, 4).map((assistant) => (
                  <div key={assistant.id} className="rounded-lg border border-border/70 bg-background/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{assistant.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{assistant.description}</p>
                      </div>
                      <Badge variant={assistant.requiresAI ? "outline" : "secondary"} className="shrink-0 rounded-full">
                        {assistant.requiresAI ? t("ai.provider_required") : t("ai.available")}
                      </Badge>
                    </div>
                    {assistant.route ? (
                      <Button asChild variant="link" size="sm" className="mt-2 h-auto p-0 text-primary">
                        <Link to={assistant.route}>
                          {t("ai.open")}
                          <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

      </div>
      <KanisaAIPreviewDialog
        preview={activePreview}
        open={Boolean(activePreview)}
        onOpenChange={(open) => {
          if (!open) setActivePreview(null);
        }}
      />
    </main>
  );
}
