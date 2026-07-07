import { useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, Clock, ExternalLink, Send, Sparkles, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { getWorkspaceIdForRole, useWorkspaceContext } from "@/components/workspace";
import { KanisaAIPreviewDialog } from "@/components/ai/KanisaAIPreviewDialog";
import {
  answerKanisaAIConversationAsync,
  createKanisaAIContext,
  createKanisaAssistantMessage,
  createKanisaUserMessage,
  resolveKanisaAIExperience,
  type KanisaAIConversationMessage,
  type KanisaAIConversationPreview,
  type KanisaAIConversationResponse,
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
  if (status === "unauthorized" || status === "error") return "destructive";
  return "outline";
}

function ConversationResponseCard({
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

  const submitQuestion = (question: string) => {
    const text = question.trim();
    if (!text || isProcessing) return;
    setDraft("");
    setIsProcessing(true);
    const userMessage = createKanisaUserMessage(text);
    setMessages((current) => [...current, userMessage]);

    window.setTimeout(() => {
      try {
        void answerKanisaAIConversationAsync(text, aiContext).then((response) => {
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
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-lg border border-border/70 bg-card/95 p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" />
                {t("ai.brand")}
              </p>
              <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-foreground">{experience.title}</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
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
            <Badge variant="outline" className="w-fit rounded-full">
              {t("ai.workspace_badge", { workspace: workspace.replace("_", " ") })}
            </Badge>
          </div>
        </section>

        <section className="rounded-lg border border-border/70 bg-card/95 p-4 shadow-sm sm:p-5" aria-label={t("ai.conversation_label")}>
          <form onSubmit={onSubmit} className="space-y-3">
            <label htmlFor="kanisa-ai-composer" className="font-serif text-xl font-bold">
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
                className="min-h-24 flex-1 resize-y rounded-lg border border-input bg-background px-3 py-3 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                    composerRef.current?.focus();
                  }}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  {t("ai.clear")}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t("ai.enter_hint")}</p>
          </form>

          <div className="mt-4 flex flex-wrap gap-2" aria-label="Suggested prompts">
            {experience.suggestedPrompts.map((prompt) => (
              <Button key={prompt} type="button" variant="outline" size="sm" className="h-auto whitespace-normal rounded-full py-1.5 text-left" onClick={() => submitQuestion(prompt)}>
                {prompt}
              </Button>
            ))}
          </div>

          <div className="mt-5 space-y-4" aria-live="polite" aria-busy={isProcessing}>
            {messages.length ? (
              messages.map((message) => <ConversationMessage key={message.id} message={message} onPreview={setActivePreview} onRetry={submitQuestion} />)
            ) : (
              <div className="rounded-lg border border-dashed border-border/80 bg-background/50 p-5 text-sm text-muted-foreground">
                {t("ai.empty_thread")}
              </div>
            )}
            {isProcessing ? (
              <div className="rounded-lg border border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                {t("ai.checking_data")}
              </div>
            ) : null}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <Card className="rounded-lg border-border/70 bg-card/95 shadow-sm">
            <CardContent className="space-y-3 p-5">
              <h2 className="font-serif text-xl font-bold">{t("ai.scope_title")}</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                {t("ai.scope_description")}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-border/70 bg-card/95 shadow-sm">
            <CardContent className="space-y-3 p-5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4 text-primary" />
                {t("ai.recent_commands")}
              </p>
              {recentCommands.length ? (
                <div className="space-y-2">
                  {recentCommands.map((command) => (
                    <div key={command.id} className="rounded-lg border border-border/70 px-3 py-2">
                      <p className="text-sm font-medium">{command.title}</p>
                      <p className="text-xs text-muted-foreground">{command.intent}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("ai.no_recent_commands")}</p>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="mb-3">
            <h2 className="font-serif text-2xl font-bold">{t("ai.explore_assistants")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("ai.assistant_cards_description")}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Kanisa AI assistants">
          {assistants.map((assistant) => {
            const route = assistant.route;

            return (
              <Card key={assistant.id} className="rounded-lg border-border/70 bg-card/95 shadow-sm">
                <CardContent className="flex h-full flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Bot className="h-5 w-5" />
                    </span>
                    <Badge variant={assistant.requiresAI ? "outline" : "secondary"} className="rounded-full">
                      {assistant.requiresAI ? t("ai.provider_required") : t("ai.available")}
                    </Badge>
                  </div>
                  <div>
                    <h2 className="font-serif text-xl font-bold">{assistant.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{assistant.description}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">{t("ai.available_capabilities")}</p>
                    <div className="flex flex-wrap gap-2">
                      {assistant.capabilities.length ? (
                        assistant.capabilities.slice(0, 6).map((capability) => (
                          <Badge key={capability.id} variant="secondary" className="rounded-full">
                            {capability.label}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">{t("ai.none_available")}</span>
                      )}
                    </div>
                  </div>

                  {assistant.futureCapabilities.length ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">{t("ai.future_capabilities")}</p>
                      <div className="flex flex-wrap gap-2">
                        {assistant.futureCapabilities.slice(0, 5).map((capability) => (
                          <Badge key={capability.id} variant="outline" className="rounded-full">
                            {capability.label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-auto pt-2">
                    {route ? (
                      <Button asChild className="w-full justify-center">
                        <Link to={route}>
                          {t("ai.open")}
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    ) : (
                      <Button disabled className="w-full justify-center">
                        {t("ai.not_available")}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
