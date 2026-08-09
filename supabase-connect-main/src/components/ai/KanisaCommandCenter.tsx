import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, Command, Sparkles, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  createKanisaAIContext,
  decideKanisaAIRoute,
  resolveKanisaAIExperience,
  routeKanisaAIRequest,
  type KanisaAIIntent,
  type KanisaAIHandlerType,
} from "@/lib/ai";
import { getWorkspaceIdForRole, useWorkspaceContext, type WorkspaceId } from "@/components/workspace";
import { getWorkspaceNavigationItems } from "@/components/workspace/registry";
import { looksLikeBibleReference, normalizeBibleLookup } from "@/lib/bible-reference-parser";
import { cn } from "@/lib/utils";
import type { CommandCenterResult, RecentCommand } from "./command-types";
import { CommandInput } from "./CommandInput";
import { CommandResults } from "./CommandResults";
import { RecentCommands } from "./RecentCommands";
import { SuggestedCommands } from "./SuggestedCommands";
import { WorkspaceSuggestions } from "./WorkspaceSuggestions";

const HISTORY_KEY = "kanisa-command-center-history:v1";
const HISTORY_LIMIT = 20;

type StaticCommand = {
  id: string;
  title: string;
  subtitle: string;
  routeByWorkspace: Partial<Record<WorkspaceId, string>>;
  workspaces: WorkspaceId[];
  intent: KanisaAIIntent;
  handler?: KanisaAIHandlerType;
  keywords: string[];
  workspaceSuggestion?: boolean;
};

const staticCommands: StaticCommand[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    subtitle: "Open your workspace dashboard.",
    intent: "SHOW_DASHBOARD",
    workspaces: ["member", "pastoral", "church_admin", "finance", "super_admin"],
    routeByWorkspace: { member: "/portal", pastoral: "/pastoral", church_admin: "/church-admin", finance: "/finance", super_admin: "/super-admin" },
    keywords: ["home", "dashboard", "workspace", "nyumbani", "dashibodi"],
    workspaceSuggestion: true,
  },
  {
    id: "kanisa-ai",
    title: "Kanisa AI",
    subtitle: "Open the assistant home for your workspace.",
    intent: "UNKNOWN",
    workspaces: ["member", "pastoral", "church_admin", "finance", "super_admin"],
    routeByWorkspace: {
      member: "/portal/kanisa-ai",
      pastoral: "/pastoral/kanisa-ai",
      church_admin: "/church-admin/kanisa-ai",
      finance: "/finance/kanisa-ai",
      super_admin: "/super-admin/kanisa-ai",
    },
    keywords: ["kanisa ai", "assistants", "ai home", "assistant home", "msaidizi"],
    workspaceSuggestion: true,
  },
  {
    id: "daily-readings",
    title: "Today's Readings",
    subtitle: "Open today's liturgical readings.",
    intent: "OPEN_DAILY_READINGS",
    workspaces: ["member", "pastoral", "church_admin", "finance"],
    routeByWorkspace: { member: "/portal/daily-readings", pastoral: "/pastoral/daily-readings", church_admin: "/church-admin/daily-readings", finance: "/finance/daily-readings" },
    keywords: ["today gospel", "todays gospel", "today's gospel", "readings", "liturgy", "masomo ya leo", "masomo ya dominika", "injili ya leo"],
    workspaceSuggestion: true,
  },
  {
    id: "bible",
    title: "Bible",
    subtitle: "Open Scripture reader.",
    intent: "OPEN_BIBLE",
    workspaces: ["member", "pastoral", "church_admin", "finance"],
    routeByWorkspace: { member: "/portal/bible", pastoral: "/pastoral/bible", church_admin: "/church-admin/bible", finance: "/finance/bible" },
    keywords: ["bible", "scripture", "biblia", "john", "mathayo"],
    workspaceSuggestion: true,
  },
  {
    id: "calendar",
    title: "Parish Calendar",
    subtitle: "Open the workspace parish calendar.",
    intent: "OPEN_CALENDAR",
    workspaces: ["member", "pastoral", "church_admin", "finance"],
    routeByWorkspace: { member: "/portal/calendar", pastoral: "/pastoral/calendar", church_admin: "/church-admin/calendar", finance: "/finance/calendar" },
    keywords: ["calendar", "schedule", "ratiba", "kalenda", "kalenda ya parokia", "matukio ya parokia"],
    workspaceSuggestion: true,
  },
  {
    id: "events",
    title: "Events",
    subtitle: "Open events.",
    intent: "OPEN_EVENTS",
    workspaces: ["member", "pastoral", "church_admin"],
    routeByWorkspace: { member: "/portal/events", pastoral: "/pastoral/events", church_admin: "/church-admin/events" },
    keywords: ["events", "event", "upcoming", "matukio", "tukio", "yanayokuja"],
  },
  {
    id: "announcements",
    title: "Announcements",
    subtitle: "Open parish announcements.",
    intent: "UNKNOWN",
    workspaces: ["member", "pastoral", "church_admin"],
    routeByWorkspace: { member: "/portal/announcements", pastoral: "/pastoral/announcements", church_admin: "/church-admin/announcements" },
    keywords: ["announcements", "news", "matangazo"],
    workspaceSuggestion: true,
  },
  {
    id: "prayer-requests",
    title: "Prayer Requests",
    subtitle: "Open prayer requests.",
    intent: "OPEN_PRAYER_REQUESTS",
    workspaces: ["member", "pastoral", "church_admin"],
    routeByWorkspace: { member: "/portal/prayer-requests", pastoral: "/pastoral/prayer-requests", church_admin: "/church-admin/prayer-requests" },
    keywords: ["prayer", "prayer requests", "maombi", "sala", "maombi ya sala"],
    workspaceSuggestion: true,
  },
  {
    id: "mass-intentions",
    title: "Mass Intentions",
    subtitle: "Open Mass intentions.",
    intent: "OPEN_MASS_INTENTIONS",
    workspaces: ["member", "pastoral", "church_admin"],
    routeByWorkspace: { member: "/portal/mass-intentions", pastoral: "/pastoral/mass-intentions", church_admin: "/church-admin/mass-intentions" },
    keywords: ["mass intentions", "nia za misa", "misa"],
    workspaceSuggestion: true,
  },
  {
    id: "giving",
    title: "My Giving",
    subtitle: "Open giving or contribution history.",
    intent: "OPEN_CONTRIBUTIONS",
    workspaces: ["member"],
    routeByWorkspace: { member: "/portal/give" },
    keywords: ["giving", "my giving", "sadaka", "contribution history", "michango yangu", "michango"],
    workspaceSuggestion: true,
  },
  {
    id: "profile",
    title: "Profile",
    subtitle: "Open your member profile and account details.",
    intent: "SHOW_DASHBOARD",
    workspaces: ["member"],
    routeByWorkspace: { member: "/portal" },
    keywords: ["profile", "account", "account settings", "wasifu", "akaunti", "mipangilio ya akaunti"],
    workspaceSuggestion: true,
  },
  {
    id: "communities",
    title: "Communities",
    subtitle: "Open communities and channels.",
    intent: "UNKNOWN",
    workspaces: ["member", "church_admin"],
    routeByWorkspace: { member: "/portal/channels", church_admin: "/church-admin/communities" },
    keywords: ["communities", "community", "groups", "channels", "jumuiya"],
    workspaceSuggestion: true,
  },
  {
    id: "ministries",
    title: "Ministries",
    subtitle: "Open ministries and service opportunities.",
    intent: "UNKNOWN",
    workspaces: ["member", "church_admin"],
    routeByWorkspace: { member: "/portal/ministries", church_admin: "/church-admin/ministries" },
    keywords: ["ministries", "ministry", "service", "service opportunities", "huduma", "vikundi", "fursa za huduma"],
    workspaceSuggestion: true,
  },
  {
    id: "saints",
    title: "Saints",
    subtitle: "Open Catholic Library saints.",
    intent: "OPEN_SAINT",
    workspaces: ["member", "pastoral", "church_admin", "finance"],
    routeByWorkspace: { member: "/portal/library", pastoral: "/pastoral/saints", church_admin: "/church-admin/saints", finance: "/finance/saints" },
    keywords: ["saints", "saint", "catholic library", "library", "watakatifu", "mtakatifu"],
    workspaceSuggestion: true,
  },
  {
    id: "members",
    title: "Search Members",
    subtitle: "Open member management or platform activity.",
    intent: "UNKNOWN",
    workspaces: ["church_admin", "super_admin"],
    routeByWorkspace: { church_admin: "/church-admin/members", super_admin: "/super-admin/activity" },
    keywords: ["members", "search members", "member management", "users", "activity", "waumini", "washirika"],
    workspaceSuggestion: true,
  },
  {
    id: "invitations",
    title: "Invitations",
    subtitle: "Open role invitations.",
    intent: "UNKNOWN",
    workspaces: ["church_admin"],
    routeByWorkspace: { church_admin: "/church-admin/roles" },
    keywords: ["invitations", "invites", "roles", "mialiko", "mialiko inayosubiri", "majukumu"],
    workspaceSuggestion: true,
  },
  {
    id: "settings",
    title: "Settings",
    subtitle: "Open workspace settings.",
    intent: "UNKNOWN",
    workspaces: ["member", "church_admin", "finance", "super_admin"],
    routeByWorkspace: { member: "/portal", church_admin: "/church-admin/settings", finance: "/finance/settings", super_admin: "/super-admin/settings" },
    keywords: ["settings", "configuration", "account settings", "mipangilio", "mipangilio ya akaunti"],
  },
  {
    id: "collections",
    title: "Collections",
    subtitle: "Open finance collections.",
    intent: "OPEN_CONTRIBUTIONS",
    workspaces: ["finance"],
    routeByWorkspace: { finance: "/finance/contributions" },
    keywords: ["collections", "contributions", "finance", "receipts", "makusanyo", "michango", "risiti"],
    workspaceSuggestion: true,
  },
  {
    id: "pledges",
    title: "Pledges",
    subtitle: "Open pledges.",
    intent: "OPEN_CONTRIBUTIONS",
    workspaces: ["member", "finance"],
    routeByWorkspace: { member: "/portal/pledges", finance: "/finance/pledges" },
    keywords: ["pledges", "pledge", "ahadi"],
    workspaceSuggestion: true,
  },
  {
    id: "reports",
    title: "Reports",
    subtitle: "Open workspace reports.",
    intent: "UNKNOWN",
    workspaces: ["church_admin"],
    routeByWorkspace: { church_admin: "/church-admin/reports" },
    keywords: ["reports", "analytics", "ripoti", "takwimu"],
    workspaceSuggestion: true,
  },
  {
    id: "finance-reports",
    title: "Finance Reports",
    subtitle: "Open finance reports.",
    intent: "OPEN_CONTRIBUTIONS",
    workspaces: ["finance"],
    routeByWorkspace: { finance: "/finance/reports" },
    keywords: ["finance reports", "reports", "exports", "ripoti za fedha"],
    workspaceSuggestion: true,
  },
  {
    id: "finance-intelligence",
    title: "Finance Intelligence",
    subtitle: "Open contribution analytics and giving intelligence.",
    intent: "OPEN_CONTRIBUTIONS",
    workspaces: ["church_admin", "finance"],
    routeByWorkspace: {
      church_admin: "/church-admin/finance-intelligence",
      finance: "/finance/finance-intelligence",
      super_admin: "/super-admin/kanisa-ai",
    },
    keywords: ["finance intelligence", "ai analytics", "analytics assistant", "giving trends", "church health", "mwenendo wa michango", "afya ya maudhui"],
    workspaceSuggestion: true,
  },
  {
    id: "todays-ministry",
    title: "Today's Ministry",
    subtitle: "Open pastoral dashboard.",
    intent: "SHOW_DASHBOARD",
    workspaces: ["pastoral"],
    routeByWorkspace: { pastoral: "/pastoral" },
    keywords: ["today ministry", "todays ministry", "pastoral dashboard"],
    workspaceSuggestion: true,
  },
];

const workspaceSuggestedInputs: Record<WorkspaceId, string[]> = {
  member: ["Kanisa AI", "Today's Readings", "Bible", "My Giving", "Pledges", "Profile", "Parish Calendar", "Announcements", "Communities", "Ministries"],
  pastoral: ["Kanisa AI", "Today's Ministry", "Prayer Requests", "Mass Intentions", "Announcements", "Today's Gospel"],
  church_admin: ["Kanisa AI", "Members", "Finance Intelligence", "Invitations", "Reports", "Announcements"],
  finance: ["Kanisa AI", "Finance Intelligence", "Collections", "Pledges", "Finance Reports", "Receipts"],
  super_admin: ["Kanisa AI", "Dashboard", "Churches", "Activity", "Settings"],
};

function readHistory(): RecentCommand[] {
  try {
    return JSON.parse(window.localStorage.getItem(HISTORY_KEY) || "[]") as RecentCommand[];
  } catch {
    return [];
  }
}

function writeHistory(commands: RecentCommand[]) {
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(commands.slice(0, HISTORY_LIMIT)));
}

function matchesCommand(command: CommandCenterResult, query: string) {
  if (!query) return true;
  const haystack = [command.title, command.subtitle, command.intent, ...command.keywords].join(" ").toLowerCase();
  return haystack.includes(query);
}

function uniqueResults(results: CommandCenterResult[]) {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = `${result.route ?? result.id}:${result.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isCalendarQuestion(query: string) {
  const text = query.toLowerCase();
  return text.includes("what happens") || text.includes("what is on") || text.includes("what's on") || text.includes("masses tomorrow") || text.includes("meetings this week") || text.includes("schedule today");
}

export function KanisaCommandCenter() {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<RecentCommand[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { churchId, isLoading, isSuperAdmin, user, userRole } = useAuth();
  const workspaceContext = useWorkspaceContext();
  const workspace = workspaceContext?.workspace.id ?? getWorkspaceIdForRole(userRole, isSuperAdmin);
  const language = i18n.language === "sw" ? "sw" : "en";

  useEffect(() => {
    if (typeof window !== "undefined") setHistory(readHistory());
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const aiContext = useMemo(
    () =>
      createKanisaAIContext({
        workspace,
        role: userRole,
        isSuperAdmin,
        church: { id: churchId },
        tenant: { id: churchId },
        route: location.pathname,
        page: "kanisa-command-center",
        language,
        queryClient,
      }),
    [churchId, isSuperAdmin, language, location.pathname, queryClient, userRole, workspace],
  );
  const experience = useMemo(() => resolveKanisaAIExperience(aiContext), [aiContext]);

  const workspaceCommands = useMemo<CommandCenterResult[]>(() => {
    const registryCommands = getWorkspaceNavigationItems(workspace).map((item) => ({
      id: item.id,
      title: t(item.labelKey ?? `navigation.items.${item.id}`, item.label),
      subtitle: `${t("command_center.groups.workspace")} > ${t(item.labelKey ?? `navigation.items.${item.id}`, item.label)}`,
      group: t("command_center.groups.workspace"),
      route: item.to,
      intent: "UNKNOWN" as KanisaAIIntent,
      requiresAI: false,
      handler: "navigate" as KanisaAIHandlerType,
      keywords: [item.id, item.label, item.category, item.to, t(item.labelKey ?? `navigation.items.${item.id}`, item.label), ...(item.keywords ?? [])],
    }));

    const legacyCommands = staticCommands
      .filter((command) => command.workspaces.includes(workspace))
      .map((command) => ({
        id: command.id,
        title: t(`navigation.items.${command.id}`, command.title),
        subtitle: t(`command_center.commands.${command.id}.subtitle`, command.subtitle),
        group: command.workspaceSuggestion ? t("command_center.groups.workspace") : t("command_center.groups.pages"),
        route: command.routeByWorkspace[workspace],
        intent: command.intent,
        requiresAI: false,
        handler: command.handler ?? "navigate",
        keywords: command.keywords,
      }));

    return uniqueResults([...registryCommands, ...legacyCommands]);
  }, [t, workspace]);

  const results = useMemo(() => {
    const normalized = normalizeBibleLookup(query);
    const request = { input: query, context: aiContext };
    const decision = decideKanisaAIRoute(request);
    const routedResult: CommandCenterResult[] =
      decision.action && decision.allowed
        ? [
            {
              id: `intent:${decision.intent}`,
              title: decision.action.title,
              subtitle: decision.requiresAI
                ? t("command_center.ai_required_description")
                : decision.targetRoute
                  ? t("command_center.navigate_to", { route: decision.targetRoute })
                  : t("command_center.routed_request"),
              group: t("command_center.groups.best_match"),
              route: decision.targetRoute,
              intent: decision.intent,
              requiresAI: decision.requiresAI,
              handler: decision.handler,
              keywords: [decision.intent, decision.action.title],
            },
          ]
        : [];

    const scriptureResult: CommandCenterResult[] =
      normalized && looksLikeBibleReference(query)
        ? [
            {
              id: "scripture-reference",
              title: normalized,
              subtitle: t("command_center.open_scripture_reference"),
              group: t("command_center.groups.scripture"),
              route: workspaceCommands.find((command) => command.id === "bible")?.route,
              intent: "SEARCH_SCRIPTURE",
              requiresAI: false,
              handler: "navigate",
              keywords: ["scripture", "bible", query],
            },
          ]
        : [];

    const pageResults = workspaceCommands
      .filter((command) => matchesCommand(command, normalized))
      .map((command) => ({ ...command, group: command.group === t("command_center.groups.workspace") ? t("command_center.groups.workspace") : t("command_center.groups.pages") }));

    const calendarSummaryResult: CommandCenterResult[] =
      isCalendarQuestion(query)
        ? [
            {
              id: "calendar-summary",
              title: t("command_center.calendar_summary"),
              subtitle: t("command_center.calendar_summary_description"),
              group: t("command_center.groups.best_match"),
              intent: "OPEN_CALENDAR",
              requiresAI: false,
              handler: "query-cache",
              keywords: ["calendar", "parish calendar", "schedule", "today", "tomorrow", "week"],
            },
          ]
        : [];

    return uniqueResults([...calendarSummaryResult, ...routedResult, ...scriptureResult, ...pageResults]).slice(0, 12);
  }, [aiContext, query, t, workspaceCommands]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  const recentCommands = useMemo(() => {
    const allowedIds = new Set(workspaceCommands.map((command) => command.id));
    const allowedIntents = new Set(experience.allowedActionIntents);
    return history
      .filter((command) => allowedIds.has(command.id) || (command.id.startsWith("intent:") && allowedIntents.has(command.intent)))
      .sort((left, right) => right.lastUsedAt - left.lastUsedAt);
  }, [experience.allowedActionIntents, history, workspaceCommands]);

  const mostUsedCommands = useMemo(() => {
    return [...recentCommands].sort((left, right) => right.uses - left.uses).slice(0, 5);
  }, [recentCommands]);

  const saveRecent = (result: CommandCenterResult) => {
    const next = [
      {
        id: result.id,
        title: result.title,
        route: result.route,
        intent: result.intent,
        uses: (history.find((item) => item.id === result.id)?.uses ?? 0) + 1,
        lastUsedAt: Date.now(),
      },
      ...history.filter((item) => item.id !== result.id),
    ].slice(0, HISTORY_LIMIT);
    setHistory(next);
    writeHistory(next);
  };

  const executeResult = (result: CommandCenterResult) => {
    saveRecent(result);
    if (result.requiresAI) {
      const response = routeKanisaAIRequest({ input: query || result.title, context: aiContext });
      setNotice(response.type === "permission_denied" ? response.message : t("command_center.ai_required_description"));
      return;
    }

    if (result.handler === "query-cache") {
      const response = routeKanisaAIRequest({ input: query || result.title, context: aiContext });
      setNotice(response.type === "summary" ? response.summary : t("command_center.no_calendar_summary"));
      return;
    }

    if (result.route) {
      navigate(result.route);
      setOpen(false);
      setQuery("");
      setNotice(null);
    }
  };

  const selectRecent = (command: RecentCommand) => {
    const match = workspaceCommands.find((item) => item.id === command.id);
    if (match) {
      executeResult(match);
      return;
    }
    setQuery(command.title);
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const selected = results[activeIndex];
      if (selected) executeResult(selected);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };

  if (isLoading || !user) return null;

  const workspaceShortcuts = workspaceCommands.filter((command) => command.group === t("command_center.groups.workspace"));

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="fixed right-4 top-16 z-50 hidden gap-2 rounded-full border-border bg-card/95 shadow-lg backdrop-blur md:flex"
        onClick={() => setOpen(true)}
        aria-label={t("command_center.open")}
      >
        <Command className="h-4 w-4" />
        <span>{t("command_center.command")}</span>
        <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Ctrl K</kbd>
      </Button>

      <Button
        type="button"
        size="icon"
        className="fixed bottom-5 right-5 z-50 h-12 w-12 rounded-full shadow-xl md:hidden"
        onClick={() => setOpen(true)}
        aria-label={t("command_center.open")}
      >
        <Sparkles className="h-5 w-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="top-[8vh] max-h-[84vh] max-w-3xl translate-y-0 overflow-hidden p-0 sm:rounded-xl"
          aria-describedby="kanisa-command-center-description"
        >
          <DialogTitle className="sr-only">{t("command_center.title")}</DialogTitle>
          <div className="border-b border-border p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Bot className="h-4 w-4 text-primary" />
                  {t("command_center.title")}
                </p>
                <p id="kanisa-command-center-description" className="text-xs text-muted-foreground">
                  {t("command_center.description")}
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label={t("command_center.close")}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CommandInput ref={inputRef} value={query} onChange={setQuery} onKeyDown={onInputKeyDown} placeholder={t("command_center.placeholder")} ariaLabel={t("command_center.aria")} />
            {notice ? (
              <div className="mt-3 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">
                {notice}
              </div>
            ) : null}
          </div>

          <div className={cn("max-h-[60vh] space-y-5 overflow-y-auto p-4", query.trim() ? "pb-5" : "pb-6")}>
            {query.trim() ? (
              <CommandResults results={results} activeIndex={activeIndex} onExecute={executeResult} onActiveChange={setActiveIndex} />
            ) : (
              <>
                <WorkspaceSuggestions commands={workspaceShortcuts} onSelect={executeResult} />
                <SuggestedCommands
                  suggestions={experience.suggestedPrompts.length ? experience.suggestedPrompts : workspaceSuggestedInputs[workspace].map((item) => t(`command_center.suggestions.${item}`, item))}
                  onSelect={setQuery}
                />
                <RecentCommands commands={recentCommands} title={t("command_center.recent")} onSelect={selectRecent} />
                <RecentCommands commands={mostUsedCommands} title={t("command_center.most_used")} onSelect={selectRecent} />
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
