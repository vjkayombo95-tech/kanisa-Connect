import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight, HelpCircle, LogOut, Menu, Settings, UserCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AppLink } from "@/components/AppLink";
import { ChurchAdminNotificationBell, ChurchAdminSidebarBadge } from "@/components/church-admin/ChurchAdminNotifications";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DashboardExperience, type DashboardConfig, type DashboardWidget } from "@/components/portal/dashboard";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import type { ChurchPermissionAction } from "@/hooks/use-church-permission";
import { supabase } from "@/integrations/supabase/client";
import { createPersonalAssistantModel } from "@/lib/assistant";
import { EMPTY_CHURCH_ADMIN_PENDING_COUNTS, getChurchAdminSidebarBadge, useChurchAdminPendingCounts } from "@/lib/church-admin-notifications";
import { isMemberPreviewActive, stopMemberPreview, subscribeMemberPreview } from "@/lib/member-preview";
import { isStaging } from "@/lib/environment";
import { cn } from "@/lib/utils";
import { getWorkspaceRoutePermission } from "@/lib/workspace-route-permissions";
import { filterVisibleNavigationGroups } from "./navigation-merge";
import type { NavigationGroupId } from "./navigation-groups";

export type WorkspaceId = "member" | "pastoral" | "church_admin" | "finance" | "super_admin";

export type WorkspaceIcon = (props: { className?: string }) => ReactNode;

export type WorkspaceNavigationItem = {
  id: string;
  label: string;
  labelKey?: string;
  to: string;
  icon?: WorkspaceIcon;
  keywords?: string[];
  permission?: string;
  featureFlag?: string;
  requireFeatureEnabled?: boolean;
};

export type WorkspaceNavigationGroup = {
  id: NavigationGroupId;
  label?: string;
  labelKey?: string;
  items: WorkspaceNavigationItem[];
};

export type WorkspaceTheme = {
  shellClassName?: string;
  sidebarClassName?: string;
  topBarClassName?: string;
  dashboardClassName?: string;
};

export type WorkspaceConfig<TContext = unknown> = {
  id: WorkspaceId;
  title: string;
  titleKey?: string;
  description?: string;
  descriptionKey?: string;
  icon?: WorkspaceIcon;
  theme?: WorkspaceTheme;
  navigation: WorkspaceNavigationGroup[];
  dashboard: DashboardConfig<TContext>;
  quickActions?: WorkspaceNavigationItem[];
  roles: string[];
};

export type WorkspaceContextValue<TContext = unknown> = {
  workspace: WorkspaceConfig<TContext>;
  role: string | null;
  navigation: WorkspaceNavigationGroup[];
  dashboard: DashboardConfig<TContext>;
  quickActions: WorkspaceNavigationItem[];
  theme: WorkspaceTheme | undefined;
  dashboardContext: TContext;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function readContextString(context: unknown, paths: string[]) {
  for (const path of paths) {
    const value = path.split(".").reduce<unknown>((current, key) => {
      if (!current || typeof current !== "object") return undefined;
      return (current as Record<string, unknown>)[key];
    }, context);

    if (typeof value === "string" && value.trim()) return value;
  }

  return null;
}

export function useWorkspaceContext<TContext = unknown>() {
  return useContext(WorkspaceContext) as WorkspaceContextValue<TContext> | null;
}

type WorkspaceProviderProps<TContext = unknown> = {
  workspace: WorkspaceConfig<TContext>;
  role?: string | null;
  context: TContext;
  children: ReactNode;
};

export function WorkspaceProvider<TContext = unknown>({
  workspace,
  role = null,
  context,
  children,
}: WorkspaceProviderProps<TContext>) {
  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspace: workspace as WorkspaceConfig,
      role,
      navigation: workspace.navigation,
      dashboard: workspace.dashboard as DashboardConfig,
      quickActions: workspace.quickActions ?? [],
      theme: workspace.theme,
      dashboardContext: context,
    }),
    [context, role, workspace],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

type WorkspaceNavigationProps = {
  groups: WorkspaceNavigationGroup[];
  mode?: "desktop" | "mobile";
};

function isWorkspaceRouteActive(pathname: string, target: string) {
  if (target === pathname) return true;
  if (target === "/") return pathname === "/";
  if (target.split("/").filter(Boolean).length <= 1) return false;

  return pathname.startsWith(`${target.replace(/\/$/, "")}/`);
}

function getNavigationStorageKey(workspaceId: string, groupId: NavigationGroupId) {
  return `kanisa.workspace.navigation.${workspaceId}.${groupId}.expanded`;
}

function useInitialGroupState(groups: WorkspaceNavigationGroup[], workspaceId: string, mode: "desktop" | "mobile") {
  return useMemo(() => {
    const state: Record<string, boolean> = {};
    groups.forEach((group, index) => {
      const stored = typeof window !== "undefined" ? window.localStorage.getItem(getNavigationStorageKey(workspaceId, group.id)) : null;
      state[group.id] = stored === null ? mode === "desktop" || index === 0 : stored === "true";
    });
    return state;
  }, [groups, mode, workspaceId]);
}

function areGroupStatesEqual(left: Record<string, boolean>, right: Record<string, boolean>) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every((key) => left[key] === right[key]);
}

type NavigationPermissionRequirement = {
  featureKey: string;
  action: ChurchPermissionAction;
};

function getNavigationPermissionRequirement(item: WorkspaceNavigationItem): NavigationPermissionRequirement | null {
  const routePermission = getWorkspaceRoutePermission(item.to);
  if (routePermission) {
    return { featureKey: routePermission.featureKey, action: routePermission.action };
  }

  if (!item.featureFlag) return null;

  return {
    featureKey: item.featureFlag,
    action: item.requireFeatureEnabled ? "manage" : "view",
  };
}

function useNavigationPermissionDecisions(items: WorkspaceNavigationItem[]) {
  const { churchId, user, userRole } = useAuth();
  const reportedDevelopmentDecisions = useRef(new Set<string>());
  const requirements = useMemo(() => {
    const unique = new Map<string, NavigationPermissionRequirement>();
    for (const item of items) {
      const requirement = getNavigationPermissionRequirement(item);
      if (requirement) unique.set(`${requirement.featureKey}:${requirement.action}`, requirement);
    }
    return [...unique.values()];
  }, [items]);
  const queries = useQueries({
    queries: requirements.map(({ featureKey, action }) => ({
      queryKey: ["church-permission", churchId, user?.id, featureKey, action],
      queryFn: async () => {
        if (!churchId || !user?.id) return false;
        const { data, error } = await supabase.rpc("has_church_feature_permission", {
          _user_id: user.id,
          _church_id: churchId,
          _feature_key: featureKey,
          _action: action,
        });
        if (error) throw error;
        return data === true;
      },
      enabled: !!churchId && !!user?.id,
      staleTime: 15 * 1000,
      refetchOnWindowFocus: true,
    })),
  });

  useEffect(() => {
    if (!import.meta.env.DEV || !churchId || !user?.id) return;

    for (const item of items) {
      const requirement = getNavigationPermissionRequirement(item);
      if (!requirement) continue;

      const queryIndex = requirements.findIndex(
        (candidate) => candidate.featureKey === requirement.featureKey && candidate.action === requirement.action,
      );
      const query = queries[queryIndex];
      if (!query || query.isPending || query.fetchStatus !== "idle" || query.data === true) continue;

      const rpcError = query.error && typeof query.error === "object"
        ? {
            name: "name" in query.error ? String(query.error.name) : undefined,
            message: "message" in query.error ? String(query.error.message) : undefined,
            code: "code" in query.error ? String(query.error.code) : undefined,
            details: "details" in query.error ? String(query.error.details) : undefined,
            hint: "hint" in query.error ? String(query.error.hint) : undefined,
          }
        : query.error ?? null;
      const diagnostic = {
        routePath: item.to,
        featureKey: requirement.featureKey,
        action: requirement.action,
        userId: user.id,
        churchId,
        currentRole: userRole,
        rpcArguments: {
          _user_id: user.id,
          _church_id: churchId,
          _feature_key: requirement.featureKey,
          _action: requirement.action,
        },
        rpcData: query.data ?? null,
        rpcError,
      };
      const signature = JSON.stringify(diagnostic);
      if (reportedDevelopmentDecisions.current.has(signature)) continue;

      reportedDevelopmentDecisions.current.add(signature);
      console.debug("[workspace-permission] hidden navigation route", diagnostic);
    }
  }, [churchId, items, queries, requirements, user?.id, userRole]);

  return useMemo(
    () => new Map(requirements.map((requirement, index) => [
      `${requirement.featureKey}:${requirement.action}`,
      queries[index]?.data === true,
    ])),
    [queries, requirements],
  );
}

function isNavigationItemVisible(item: WorkspaceNavigationItem, decisions: Map<string, boolean>) {
  const requirement = getNavigationPermissionRequirement(item);
  if (!requirement) return true;
  return decisions.get(`${requirement.featureKey}:${requirement.action}`) === true;
}

function useVisibleNavigationGroups(groups: WorkspaceNavigationGroup[]) {
  const items = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const decisions = useNavigationPermissionDecisions(items);

  return useMemo(
    () => filterVisibleNavigationGroups(groups, (item) => isNavigationItemVisible(item, decisions)),
    [decisions, groups],
  );
}

function useVisibleNavigationItems(items: WorkspaceNavigationItem[]) {
  const decisions = useNavigationPermissionDecisions(items);

  return useMemo(
    () => items.filter((item) => isNavigationItemVisible(item, decisions)),
    [decisions, items],
  );
}

export function WorkspaceNavigation({ groups, mode = "desktop" }: WorkspaceNavigationProps) {
  const location = useLocation();
  const { t } = useTranslation();
  const workspaceId = location.pathname.split("/").filter(Boolean)[0] || "workspace";
  const visibleGroups = useVisibleNavigationGroups(groups);
  const { data: pendingCounts = EMPTY_CHURCH_ADMIN_PENDING_COUNTS } = useChurchAdminPendingCounts();
  const initialGroupState = useInitialGroupState(visibleGroups, workspaceId, mode);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(initialGroupState);

  useEffect(() => {
    setExpandedGroups((current) => (areGroupStatesEqual(current, initialGroupState) ? current : initialGroupState));
  }, [initialGroupState]);

  const toggleGroup = useCallback((groupId: NavigationGroupId) => {
    setExpandedGroups((current) => {
      const next = { ...current, [groupId]: !current[groupId] };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(getNavigationStorageKey(workspaceId, groupId), String(next[groupId]));
      }
      return next;
    });
  }, [workspaceId]);

  const onGroupKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>, groupId: NavigationGroupId) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setExpandedGroups((current) => (current[groupId] === true ? current : { ...current, [groupId]: true }));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setExpandedGroups((current) => (current[groupId] === false ? current : { ...current, [groupId]: false }));
    }
  }, []);

  return (
    <nav className="space-y-5" aria-label={t("workspace.navigation")}>
      {visibleGroups.map((group) => (
        <div key={group.id} className="space-y-2" data-navigation-group-id={group.id}>
          {group.label ? (
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl px-3 py-1.5 text-left text-xs font-semibold uppercase text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              aria-expanded={expandedGroups[group.id]}
              aria-controls={`workspace-nav-${group.id}`}
              onClick={() => toggleGroup(group.id)}
              onKeyDown={(event) => onGroupKeyDown(event, group.id)}
            >
              <span>{t(group.labelKey ?? `navigation.groups.${group.id}`, group.label)}</span>
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform", expandedGroups[group.id] ? "rotate-0" : "-rotate-90")}
                aria-hidden="true"
              />
            </button>
          ) : null}
          <div
            id={`workspace-nav-${group.id}`}
            className={cn("space-y-1 overflow-hidden transition-all", expandedGroups[group.id] ? "max-h-[900px] opacity-100" : "max-h-0 opacity-0")}
          >
            {group.items.map((item) => {
                const active = isWorkspaceRouteActive(location.pathname, item.to);
                const Icon = item.icon;
                const badgeCount = workspaceId === "church-admin" ? getChurchAdminSidebarBadge(item.id, pendingCounts) : 0;

                return (
                  <AppLink
                    key={item.id}
                    to={item.to}
                    data-navigation-item-id={item.id}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-2xl px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/50",
                      active
                        ? "bg-primary/10 text-primary shadow-[inset_3px_0_0_hsl(var(--primary))]"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
                    <span className="min-w-0 truncate">{t(item.labelKey ?? `navigation.items.${item.id}`, item.label)}</span>
                    <ChurchAdminSidebarBadge count={badgeCount} />
                  </AppLink>
                );
              })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function MobileWorkspaceNavigation({ groups }: { groups: WorkspaceNavigationGroup[] }) {
  const { t } = useTranslation();
  const location = useLocation();
  const workspaceId = location.pathname.split("/").filter(Boolean)[0] || "workspace";
  const visibleGroups = useVisibleNavigationGroups(groups);
  const { data: pendingCounts = EMPTY_CHURCH_ADMIN_PENDING_COUNTS } = useChurchAdminPendingCounts();
  const [activeGroupId, setActiveGroupId] = useState<NavigationGroupId | null>(null);
  const activeGroup = visibleGroups.find((group) => group.id === activeGroupId);

  if (activeGroup) {
    return (
      <div className="space-y-3">
        <Button type="button" variant="ghost" className="h-9 gap-2 px-2" onClick={() => setActiveGroupId(null)}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {t("common.back")}
        </Button>
        <div>
          <p className="px-2 text-xs font-semibold uppercase text-muted-foreground">
            {activeGroup.label ? t(activeGroup.labelKey ?? `navigation.groups.${activeGroup.id}`, activeGroup.label) : t("workspace.navigation")}
          </p>
          <div className="mt-2 space-y-1">
            {activeGroup.items.map((item) => {
              const Icon = item.icon;
              const badgeCount = workspaceId === "church-admin" ? getChurchAdminSidebarBadge(item.id, pendingCounts) : 0;
              return (
                <AppLink
                  key={item.id}
                  to={item.to}
                  data-navigation-item-id={item.id}
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
                  <span className="min-w-0 flex-1 truncate">{t(item.labelKey ?? `navigation.items.${item.id}`, item.label)}</span>
                  <ChurchAdminSidebarBadge count={badgeCount} />
                </AppLink>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2" aria-label="Workspace navigation categories">
      {visibleGroups.map((group) => (
        (() => {
          const groupCount =
            workspaceId === "church-admin"
              ? group.items.reduce((sum, item) => sum + getChurchAdminSidebarBadge(item.id, pendingCounts), 0)
              : 0;

          return (
        <button
          key={group.id}
          type="button"
          data-navigation-group-id={group.id}
          className="flex w-full items-center justify-between rounded-2xl border border-border/60 bg-card/70 px-3 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          onClick={() => setActiveGroupId(group.id)}
        >
          <span>
            <span className="block text-sm font-semibold">
              {group.label ? t(group.labelKey ?? `navigation.groups.${group.id}`, group.label) : t("workspace.navigation")}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("workspace.item_count", { count: group.items.length })}
            </span>
          </span>
          <span className="flex items-center gap-2">
            <ChurchAdminSidebarBadge count={groupCount} />
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </span>
        </button>
          );
        })()
      ))}
    </div>
  );
}

function getWorkspaceProfilePath(workspaceId: WorkspaceId) {
  switch (workspaceId) {
    case "church_admin":
      return "/church-admin/settings";
    case "finance":
      return "/finance/settings";
    case "super_admin":
      return "/super-admin/settings";
    case "pastoral":
      return "/pastoral";
    case "member":
    default:
      return "/portal";
  }
}

function getWorkspaceSettingsPath(workspaceId: WorkspaceId) {
  switch (workspaceId) {
    case "church_admin":
      return "/church-admin/settings";
    case "finance":
      return "/finance/settings";
    case "super_admin":
      return "/super-admin/settings";
    case "pastoral":
      return "/pastoral";
    case "member":
    default:
      return "/portal";
  }
}

function getAccountInitials(name: string, fallback: string) {
  const source = name.trim() || fallback.trim() || "KC";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function WorkspaceAccountMenu({ workspace, mode = "header" }: { workspace: WorkspaceConfig; mode?: "header" | "mobile" }) {
  const { profile, user, userRoles, isSuperAdmin, signOut } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const displayName =
    profile?.full_name ||
    (typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "") ||
    user?.email?.split("@")[0] ||
    "Account";
  const email = profile?.email || user?.email || "";
  const initials = getAccountInitials(displayName, email);
  const workspaceLinks = [
    { id: "member", label: "Member Portal", to: "/portal", visible: true },
    { id: "church_admin", label: "Church Operations", to: "/church-admin", visible: userRoles.some((role) => role !== "member") },
    { id: "pastoral", label: "Pastoral Workspace", to: "/pastoral", visible: userRoles.includes("pastor") },
    { id: "finance", label: "Finance Workspace", to: "/finance", visible: userRoles.includes("treasurer") },
    { id: "super_admin", label: "Platform Administration", to: "/super-admin", visible: isSuperAdmin },
  ].filter((item) => item.visible && item.id !== workspace.id);

  const handleSignOut = async () => {
    stopMemberPreview();
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className={cn(mode === "mobile" && "mt-4 border-t border-border/70 pt-3")}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-testid="workspace-account-menu-trigger"
            className={cn(
              "flex items-center gap-3 rounded-2xl px-2 py-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              mode === "mobile" ? "w-full px-3 py-2" : "w-auto max-w-[18rem]",
            )}
            aria-label={t("account.open_menu")}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {initials}
            </span>
            <span className={cn("min-w-0 flex-1", mode === "header" && "hidden md:block")}>
              <span className="block truncate text-sm font-semibold text-foreground">{displayName}</span>
              {email ? <span className="block truncate text-xs text-muted-foreground">{email}</span> : null}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={mode === "mobile" ? "start" : "end"} className="w-64">
          <DropdownMenuLabel>
            <span className="block truncate">{displayName}</span>
            {email ? <span className="block truncate text-xs font-normal text-muted-foreground">{email}</span> : null}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5">
            <LanguageSwitcher className="justify-between" />
          </div>
          <DropdownMenuSeparator />
          {workspaceLinks.map((item) => (
            <DropdownMenuItem key={item.id} asChild>
              <AppLink to={item.to}>{item.label}</AppLink>
            </DropdownMenuItem>
          ))}
          {workspaceLinks.length > 0 ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem asChild>
            <AppLink to={getWorkspaceProfilePath(workspace.id)} className="gap-2">
              <UserCircle className="h-4 w-4" aria-hidden="true" />
              {t("account.profile")}
            </AppLink>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <AppLink to={getWorkspaceSettingsPath(workspace.id)} className="gap-2">
              <Settings className="h-4 w-4" aria-hidden="true" />
              {t("account.settings")}
            </AppLink>
          </DropdownMenuItem>
          <DropdownMenuItem disabled className="gap-2">
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
            {t("account.help")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem data-testid="workspace-account-sign-out" onSelect={handleSignOut} className="gap-2 text-destructive hover:text-destructive">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {t("sign_out")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function MemberPreviewBanner({ workspaceId }: { workspaceId: WorkspaceId }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [previewActive, setPreviewActive] = useState(isMemberPreviewActive);

  useEffect(() => subscribeMemberPreview(() => setPreviewActive(isMemberPreviewActive())), []);

  if (workspaceId !== "member" || !previewActive) return null;

  const exitPreview = (to = "/church-admin") => {
    stopMemberPreview();
    navigate(to, { replace: true });
  };

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-950 dark:text-amber-100 lg:px-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm font-medium">{t("preview.member_admin_banner")}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => exitPreview("/portal")}>
            {t("preview.exit")}
          </Button>
          <Button type="button" size="sm" onClick={() => exitPreview("/church-admin")}>
            {t("preview.return_admin")}
          </Button>
        </div>
      </div>
    </div>
  );
}

type WorkspaceLayoutProps = {
  workspace: WorkspaceConfig;
  children: ReactNode;
};

export function WorkspaceLayout({ workspace, children }: WorkspaceLayoutProps) {
  const Icon = workspace.icon;
  const location = useLocation();
  const { t } = useTranslation();
  const workspaceTitle = t(workspace.titleKey ?? `workspace.${workspace.id}.title`, workspace.title);
  const workspaceDescription = workspace.description ? t(workspace.descriptionKey ?? `workspace.${workspace.id}.description`, workspace.description) : null;
  const activeItem = useMemo(
    () =>
      workspace.navigation
        .flatMap((group) => group.items)
        .filter((item) => isWorkspaceRouteActive(location.pathname, item.to))
        .sort((a, b) => b.to.length - a.to.length)[0],
    [location.pathname, workspace.navigation],
  );
  const activeLabel = activeItem ? t(activeItem.labelKey ?? `navigation.items.${activeItem.id}`, activeItem.label) : workspaceTitle;

  return (
    <div className={cn("min-h-screen bg-background", workspace.theme?.shellClassName)}>
      <a
        href="#workspace-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-[calc(var(--staging-banner-height,0px)+1rem)] focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <header
        className={cn(
          "sticky top-[var(--staging-banner-height,0px)] z-40 flex h-14 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-sm lg:px-6",
          workspace.theme?.topBarClassName,
        )}
      >
        <Sheet>
          <SheetTrigger asChild>
            <Button data-testid="workspace-mobile-navigation-trigger" variant="ghost" size="icon" className="lg:hidden" aria-label="Open workspace navigation">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className={cn(
              "flex w-80 max-w-[88vw] flex-col p-4",
              isStaging && "top-[calc(2rem+env(safe-area-inset-top,0px))] h-[calc(100%_-_2rem_-_env(safe-area-inset-top,0px))]",
            )}
          >
            <SheetHeader className="mb-5 pr-8 text-left">
              <SheetTitle>{workspaceTitle}</SheetTitle>
              {workspaceDescription ? <SheetDescription>{workspaceDescription}</SheetDescription> : null}
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <MobileWorkspaceNavigation groups={workspace.navigation} />
            </div>
          </SheetContent>
        </Sheet>
        {Icon ? (
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{workspaceTitle}</p>
          {workspaceDescription ? <p className="truncate text-xs text-muted-foreground">{workspaceDescription}</p> : null}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {workspace.id === "church_admin" ? <ChurchAdminNotificationBell /> : null}
          <WorkspaceAccountMenu workspace={workspace} />
        </div>
      </header>
      <MemberPreviewBanner workspaceId={workspace.id} />

      <div className="grid min-h-[calc(100svh-3.5rem-var(--staging-banner-height,0px))] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside
          className={cn(
            "hidden border-r border-border bg-card/40 p-4 lg:flex lg:max-h-[calc(100svh-3.5rem-var(--staging-banner-height,0px))] lg:flex-col",
            workspace.theme?.sidebarClassName,
          )}
        >
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <WorkspaceNavigation groups={workspace.navigation} />
          </div>
        </aside>
        <main id="workspace-main" className={cn("min-w-0 p-4 lg:p-6", workspace.theme?.dashboardClassName)}>
          <section
            className="mb-5 rounded-xl border border-border bg-card/40 px-4 py-3 shadow-sm"
            aria-label="Workspace page header"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <nav className="text-xs font-medium text-muted-foreground" aria-label="Breadcrumb">
                  <span>{workspaceTitle}</span>
                  {activeItem ? <span aria-hidden="true"> / {activeLabel}</span> : null}
                </nav>
                <h1 className="mt-1 truncate text-xl font-semibold text-foreground">
                  {activeLabel}
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {workspaceTitle}
                </span>
                <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                  Ctrl K Search
                </span>
              </div>
            </div>
          </section>
          {children}
        </main>
      </div>
    </div>
  );
}

type WorkspaceRendererProps<TContext> = {
  workspace: WorkspaceConfig<TContext>;
  role?: string | null;
  context: TContext;
  widgets: Record<string, DashboardWidget<TContext>>;
  dashboardClassName?: string;
};

export function WorkspaceRenderer<TContext>({
  workspace,
  role = null,
  context,
  widgets,
  dashboardClassName,
}: WorkspaceRendererProps<TContext>) {
  const existingWorkspace = useWorkspaceContext<TContext>();
  const location = useLocation();
  const queryClient = useQueryClient();
  const featureAccess = useFeatureAccess();
  const visibleQuickActions = useVisibleNavigationItems(workspace.quickActions ?? []);
  const assistant = useMemo(
    () =>
      createPersonalAssistantModel({
        workspace: workspace.id,
        role,
        churchName: readContextString(context, ["churchName", "summary.churchName", "critical.churchName"]),
        displayName: readContextString(context, ["displayName"]),
        liturgicalSeason: readContextString(context, ["todayLiturgy.season"]),
        route: location.pathname,
        today: new Date(),
        dashboardContext: context,
        queryClient,
        featureFlags: {
          isFeatureEnabled: featureAccess.isFeatureEnabled,
          isFeatureVisible: featureAccess.isFeatureVisible,
        },
      }),
    [
      context,
      featureAccess.isFeatureEnabled,
      featureAccess.isFeatureVisible,
      location.pathname,
      queryClient,
      role,
      workspace.id,
    ],
  );

  const dashboard = (
    <DashboardExperience
      workspace={workspace}
      role={role}
      context={context}
      widgets={widgets}
      config={workspace.dashboard}
      assistant={assistant}
      quickActions={visibleQuickActions}
      className={cn(dashboardClassName)}
    />
  );

  if (existingWorkspace?.workspace.id === workspace.id) {
    return dashboard;
  }

  return (
    <WorkspaceProvider workspace={workspace} role={role} context={context}>
      <WorkspaceLayout workspace={workspace as WorkspaceConfig}>
        {dashboard}
      </WorkspaceLayout>
    </WorkspaceProvider>
  );
}
