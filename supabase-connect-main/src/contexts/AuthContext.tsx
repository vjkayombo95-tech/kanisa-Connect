import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearSensitiveOfflineData, readOfflineCache } from "@/lib/offline-cache";
import { captureException, logSupabaseError } from "@/lib/error-logger";
import {
  AuthorizationBootstrapError,
  classifyAuthorizationFailure,
  isActiveAuthorizationLoad,
  isTransientAuthorizationFailure,
  runAuthorizationOperation,
  safeAuthorizationDiagnostic,
  type AuthorizationFailureClassification,
} from "@/lib/authorization-bootstrap";
import { getAuthorizationRealtimeStatusAction, type AuthorizationRealtimeDiagnosticLevel } from "@/lib/authorization-realtime-lifecycle";
import {
  hasUnsupportedProductionRole,
  normalizeProductionRoles,
  resolveStaffMobileWorkspace,
  type ProductionUserRole,
  type StaffMobileWorkspace,
} from "@/lib/staff-mobile-role";

type AppRole = "super_admin" | "church_admin" | "pastor" | "secretary" | "treasurer" | "member";
type ActiveWorkspaceView = "member" | "staff";

export type AvailableChurch = {
  membership_id: string;
  church_id: string;
  church_name: string | null;
  church_code: string | null;
  status: string;
  is_primary: boolean;
  joined_at: string | null;
  roles?: string[];
  baseline_member?: boolean;
};

type CurrentUserContext = {
  profile: any | null;
  role: AppRole | null;
  roles?: string[];
  church_id: string | null;
  active_church_id?: string | null;
  available_churches?: AvailableChurch[];
  church: any | null;
  member: any | null;
  is_super_admin: boolean;
  permissions: {
    is_super_admin: boolean;
    can_view_church_workspace: boolean;
    can_manage_church_workspace: boolean;
  };
};

type LoadOptions = {
  force?: boolean;
  reason?: string;
  requestedChurchId?: string | null;
};

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: any | null;
  member: any | null;
  isSuperAdmin: boolean;
  churchId: string | null;
  activeChurchId: string | null;
  availableChurches: AvailableChurch[];
  userRole: AppRole | null;
  userRoles: ProductionUserRole[];
  staffWorkspace: StaffMobileWorkspace | null;
  activeView: ActiveWorkspaceView;
  setActiveView: (view: ActiveWorkspaceView) => void;
  switchChurch: (churchId: string) => Promise<void>;
  setActiveChurch: (churchId: string) => Promise<void>;
  isLoading: boolean;
  authorizationError: Error | null;
  authorizationFailure: AuthorizationFailureClassification | null;
  authorizationReady: boolean;
  signOut: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  member: null,
  isSuperAdmin: false,
  churchId: null,
  activeChurchId: null,
  availableChurches: [],
  userRole: null,
  userRoles: [],
  staffWorkspace: null,
  activeView: "staff",
  setActiveView: () => {},
  switchChurch: async () => {},
  setActiveChurch: async () => {},
  isLoading: true,
  authorizationError: null,
  authorizationFailure: null,
  authorizationReady: false,
  signOut: async () => {},
  refreshUserData: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value: string | null | undefined) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function activeChurchStorageKey(userId: string) {
  return `active-church:${userId}`;
}

function readStoredActiveChurchId(userId: string): string | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(activeChurchStorageKey(userId));
  if (!stored) return null;
  if (isValidUuid(stored)) return stored;
  window.localStorage.removeItem(activeChurchStorageKey(userId));
  return null;
}

function writeStoredActiveChurchId(userId: string, churchId: string | null) {
  if (typeof window === "undefined") return;
  const key = activeChurchStorageKey(userId);
  if (churchId && isValidUuid(churchId)) window.localStorage.setItem(key, churchId);
  else window.localStorage.removeItem(key);
}

function workspaceViewStorageKey(userId: string, churchId: string | null) {
  return `workspace-view:${userId}:${churchId ?? "no-church"}`;
}

function readStoredWorkspaceView(userId: string, churchId: string | null): ActiveWorkspaceView | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(workspaceViewStorageKey(userId, churchId));
  return stored === "member" || stored === "staff" ? stored : null;
}

function writeStoredWorkspaceView(userId: string, churchId: string | null, view: ActiveWorkspaceView) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(workspaceViewStorageKey(userId, churchId), view);
}

function hasStaffWorkspace(workspace: StaffMobileWorkspace | null) {
  return workspace === "super_admin" || workspace === "admin" || workspace === "pastoral" || workspace === "finance";
}

function resolveRole(nextSuper: boolean, nextWorkspace: StaffMobileWorkspace, roles: ProductionUserRole[]): AppRole {
  if (nextSuper) return "super_admin";
  if (nextWorkspace === "admin") return roles.includes("church_admin") ? "church_admin" : "secretary";
  if (nextWorkspace === "pastoral") return "pastor";
  if (nextWorkspace === "finance") return "treasurer";
  return "member";
}

function diagnostic(stage: string, metadata: Record<string, unknown> = {}, level: AuthorizationRealtimeDiagnosticLevel = "default") {
  const safe = {
    stage,
    operation: "get_current_user_context_for_church",
    navigatorOnline: typeof navigator !== "undefined" ? navigator.onLine : undefined,
    visibilityState: typeof document !== "undefined" ? document.visibilityState : undefined,
    ...metadata,
  };
  if (import.meta.env.DEV || import.meta.env.VITE_APP_ENV === "staging") console.info("[authorization]", safe);
  else if (level === "warn" || stage.endsWith("FAILED")) console.warn("[authorization]", safe);
  else if (level === "info") console.info("[authorization]", safe);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [member, setMember] = useState<any | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [churchId, setChurchId] = useState<string | null>(null);
  const [availableChurches, setAvailableChurches] = useState<AvailableChurch[]>([]);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRoles, setUserRoles] = useState<ProductionUserRole[]>([]);
  const [staffWorkspace, setStaffWorkspace] = useState<StaffMobileWorkspace | null>(null);
  const [activeView, setActiveViewState] = useState<ActiveWorkspaceView>("staff");
  const [authorizationError, setAuthorizationError] = useState<Error | null>(null);
  const [authorizationFailure, setAuthorizationFailure] = useState<AuthorizationFailureClassification | null>(null);
  const [authorizationReady, setAuthorizationReady] = useState(false);

  const sequence = useRef(0);
  const verified = useRef(false);
  const inFlight = useRef<{ userId: string; requestedChurchId: string | null; promise: Promise<void> } | null>(null);
  const scheduled = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentUser = useRef<User | null>(null);
  const currentChurchId = useRef<string | null>(null);

  useEffect(() => {
    currentUser.current = user;
  }, [user]);

  useEffect(() => {
    currentChurchId.current = churchId;
  }, [churchId]);

  const shouldAutoNavigate = useCallback(
    () => ["/", "/login", "/onboarding"].includes(typeof window !== "undefined" ? window.location.pathname : "/"),
    [],
  );

  const redirectTo = useCallback((path: string) => {
    if (typeof window !== "undefined" && window.location.pathname !== path) window.location.replace(path);
  }, []);

  const clearAuthorization = useCallback(() => {
    setProfile(null);
    setMember(null);
    setIsSuperAdmin(false);
    setChurchId(null);
    setAvailableChurches([]);
    setUserRole(null);
    setUserRoles([]);
    setStaffWorkspace(null);
    setActiveViewState("staff");
    setAuthorizationReady(false);
    verified.current = false;
    currentChurchId.current = null;
  }, []);

  const resetUserData = useCallback(() => {
    sequence.current += 1;
    inFlight.current = null;
    if (scheduled.current) clearTimeout(scheduled.current);
    scheduled.current = null;
    clearSensitiveOfflineData();
    setSession(null);
    setUser(null);
    clearAuthorization();
    setAuthorizationError(null);
    setAuthorizationFailure(null);
    setIsLoading(false);
  }, [clearAuthorization]);

  const invalidRefresh = useCallback(
    (e: unknown) => /invalid refresh token|refresh token not found/.test(String((e as { message?: string })?.message || "").toLowerCase()),
    [],
  );

  const expiredLogin = useCallback(() => {
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      const redirect = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/login?reason=session_expired&redirect=${redirect}`);
    }
  }, []);

  const performLoad = useCallback(async (target: User | null, options: LoadOptions = {}) => {
    const loadSequence = ++sequence.current;
    const attemptId = crypto.randomUUID();

    if (!target) {
      resetUserData();
      return;
    }

    const requestedChurchId = options.requestedChurchId === undefined ? readStoredActiveChurchId(target.id) : options.requestedChurchId;

    if (!verified.current) {
      setIsLoading(true);
      setAuthorizationError(null);
      setAuthorizationFailure(null);
      setAuthorizationReady(false);
    }

    try {
      const cacheKey = `offline-cache:auth-context:${target.id}`;
      const cached = readOfflineCache<any | null>(cacheKey, null);
      const cacheMatchesRequest = !requestedChurchId || cached?.churchId === requestedChurchId || cached?.activeChurchId === requestedChurchId;

      if (cached && cacheMatchesRequest && !verified.current) {
        setProfile(cached.profile);
        setMember(cached.member ?? null);
        setIsSuperAdmin(cached.isSuperAdmin);
        setChurchId(cached.churchId);
        setAvailableChurches(cached.availableChurches ?? []);
        setUserRole(cached.userRole);
        setUserRoles(cached.userRoles ?? []);
        setStaffWorkspace(cached.staffWorkspace ?? null);
        setActiveViewState(cached.activeView === "member" ? "member" : "staff");
      }

      const authorization = await runAuthorizationOperation(
        async (signal) => {
          const { data, error } = await supabase
            .rpc("get_current_user_context_for_church" as never, { _requested_church_id: requestedChurchId } as never)
            .abortSignal(signal);
          if (error) throw error;

          const contextData = data as unknown as CurrentUserContext | null;
          if (!contextData) return { contextData: null, roles: [] as ProductionUserRole[] };

          const superAdmin = !!contextData.is_super_admin || contextData.profile?.role === "super_admin";
          const roleSource = Array.isArray(contextData.roles) ? contextData.roles : [contextData.role ?? "member"];
          const roles = superAdmin ? (["super_admin"] as ProductionUserRole[]) : normalizeProductionRoles(roleSource);

          if (hasUnsupportedProductionRole(roleSource)) {
            throw new AuthorizationBootstrapError("An assigned role is not supported by this production client.", "INVALID_CONTEXT");
          }

          return { contextData, roles };
        },
        {
          onAttempt: (e) =>
            diagnostic(
              e.phase === "started" ? "CONTEXT_RPC_STARTED" : e.phase === "succeeded" ? "CONTEXT_RPC_OK" : "CONTEXT_RPC_FAILED",
              {
                bootstrapAttemptId: attemptId,
                loadSequence,
                retryAttempt: e.attempt,
                durationMs: e.durationMs,
                classification: e.classification,
                reason: options.reason,
                requestedChurchId,
              },
            ),
        },
      );

      const contextData = authorization.contextData;
      if (!contextData) throw new AuthorizationBootstrapError("Authoritative context was empty.", "INVALID_CONTEXT");
      if (!isActiveAuthorizationLoad(loadSequence, sequence.current)) {
        diagnostic("AUTHORIZATION_READY", { loadSequence, staleResultIgnored: true });
        return;
      }

      const nextProfile = contextData.profile;
      const nextMember = contextData.member ?? null;
      const nextSuper = !!contextData.is_super_admin || nextProfile?.role === "super_admin";
      const nextChurch = contextData.active_church_id ?? contextData.church_id ?? null;
      const nextAvailableChurches = Array.isArray(contextData.available_churches) ? contextData.available_churches : [];
      const nextWorkspace = resolveStaffMobileWorkspace(authorization.roles, nextSuper);

      if (!nextWorkspace) throw new AuthorizationBootstrapError("Current-church roles could not be resolved safely.", "INVALID_CONTEXT");

      const nextRole = resolveRole(nextSuper, nextWorkspace, authorization.roles);
      const storedView = readStoredWorkspaceView(target.id, nextChurch);
      const nextActiveView = nextWorkspace === "member" ? "member" : storedView === "member" && nextMember ? "member" : "staff";

      setProfile(nextProfile);
      setMember(nextMember);
      setIsSuperAdmin(nextSuper);
      setChurchId(nextChurch);
      setAvailableChurches(nextAvailableChurches);
      setUserRole(nextRole);
      setUserRoles(authorization.roles);
      setStaffWorkspace(nextWorkspace);
      setActiveViewState(nextActiveView);
      setAuthorizationError(null);
      setAuthorizationFailure(null);
      setAuthorizationReady(true);
      verified.current = true;
      currentChurchId.current = nextChurch;
      writeStoredActiveChurchId(target.id, nextChurch);

      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          profile: nextProfile,
          member: nextMember,
          isSuperAdmin: nextSuper,
          churchId: nextChurch,
          activeChurchId: nextChurch,
          availableChurches: nextAvailableChurches,
          userRole: nextRole,
          userRoles: authorization.roles,
          staffWorkspace: nextWorkspace,
          activeView: nextActiveView,
        }),
      );

      diagnostic("AUTHORIZATION_READY", {
        loadSequence,
        staleResultIgnored: false,
        roleCount: authorization.roles.length,
        staffWorkspace: nextWorkspace,
        activeView: nextActiveView,
        activeChurchId: nextChurch,
        availableChurchCount: nextAvailableChurches.length,
      });

      if (shouldAutoNavigate()) {
        if (nextActiveView === "member" && nextChurch) redirectTo("/portal");
        else if (nextWorkspace === "super_admin") redirectTo("/super-admin");
        else if (["admin", "pastoral", "finance"].includes(nextWorkspace)) redirectTo("/church-admin");
        else if (nextChurch) redirectTo("/portal");
      }
    } catch (error) {
      const classification = classifyAuthorizationFailure(error);
      if (!isActiveAuthorizationLoad(loadSequence, sequence.current)) {
        diagnostic("AUTHORIZATION_FAILED", { loadSequence, classification, staleResultIgnored: true });
        return;
      }
      diagnostic("AUTHORIZATION_FAILED", { loadSequence, staleResultIgnored: false, ...safeAuthorizationDiagnostic(error) });
      captureException(error, {
        page: "Authentication",
        component: "AuthProvider",
        function: "loadUserData",
        user_id: target.id,
        metadata: { classification },
      });
      if (verified.current && isTransientAuthorizationFailure(classification)) {
        setAuthorizationError(null);
        setAuthorizationFailure(classification);
        setAuthorizationReady(true);
      } else {
        clearAuthorization();
        setAuthorizationError(error instanceof Error ? error : new Error("Authorization failed"));
        setAuthorizationFailure(classification);
      }
    } finally {
      if (isActiveAuthorizationLoad(loadSequence, sequence.current)) setIsLoading(false);
    }
  }, [clearAuthorization, redirectTo, resetUserData, shouldAutoNavigate]);

  const loadUserData = useCallback(
    (target: User | null, options: LoadOptions = {}) => {
      const requestedChurchId = target
        ? options.requestedChurchId === undefined
          ? readStoredActiveChurchId(target.id)
          : options.requestedChurchId
        : null;

      if (
        target &&
        !options.force &&
        inFlight.current?.userId === target.id &&
        inFlight.current.requestedChurchId === requestedChurchId
      ) {
        return inFlight.current.promise;
      }

      const promise = performLoad(target, { ...options, requestedChurchId });
      if (target) {
        inFlight.current = { userId: target.id, requestedChurchId, promise };
        void promise.finally(() => {
          if (inFlight.current?.promise === promise) inFlight.current = null;
        });
      }
      return promise;
    },
    [performLoad],
  );

  const scheduleRefresh = useCallback(
    (reason: string) => {
      const target = currentUser.current;
      if (!target) return;
      if (scheduled.current) clearTimeout(scheduled.current);
      scheduled.current = setTimeout(() => {
        scheduled.current = null;
        void loadUserData(target, { reason, requestedChurchId: currentChurchId.current ?? readStoredActiveChurchId(target.id) });
      }, 100);
    },
    [loadUserData],
  );

  useEffect(() => {
    diagnostic("AUTH_SESSION_STARTED");
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setUser(next?.user ?? null);
      if (next?.user && !verified.current) setIsLoading(true);
      setTimeout(() => void loadUserData(next?.user ?? null, { reason: event }), 0);
    });

    void supabase.auth
      .getSession()
      .then(async ({ data: { session: existing }, error }) => {
        if (error) {
          diagnostic("AUTH_SESSION_FAILED", safeAuthorizationDiagnostic(error));
          if (invalidRefresh(error)) {
            logSupabaseError(error, { page: "Authentication", component: "AuthProvider", function: "restoreSession", operation: "auth.getSession" });
            await supabase.auth.signOut({ scope: "local" });
            resetUserData();
            expiredLogin();
            return;
          }
          resetUserData();
          return;
        }
        diagnostic("AUTH_SESSION_OK", { hasSession: !!existing });
        setSession(existing);
        setUser(existing?.user ?? null);
        void loadUserData(existing?.user ?? null, { reason: "INITIAL_SESSION" });
      })
      .catch((error) => {
        diagnostic("AUTH_SESSION_FAILED", safeAuthorizationDiagnostic(error));
        resetUserData();
      });

    return () => subscription.unsubscribe();
  }, [expiredLogin, invalidRefresh, loadUserData, resetUserData]);

  useEffect(() => {
    const focus = () => {
      if (document.visibilityState === "visible") scheduleRefresh("FOCUS_VISIBILITY");
    };
    const online = () => scheduleRefresh("ONLINE");
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
      window.removeEventListener("online", online);
    };
  }, [scheduleRefresh]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    diagnostic("REALTIME_AUTH_STARTED");
    void supabase.realtime
      .setAuth()
      .then(() => {
        if (!active) return;
        diagnostic("REALTIME_AUTH_OK");
      })
      .catch((error) => {
        if (!active) return;
        diagnostic("REALTIME_AUTH_FAILED", safeAuthorizationDiagnostic(error));
        scheduleRefresh("REALTIME_AUTH_FAILED");
      });

    const channel = supabase
      .channel(`authorization:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` }, () => {
        if (active) scheduleRefresh("REALTIME_PROFILE");
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` }, () => {
        if (active) scheduleRefresh("REALTIME_ROLE");
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "members", filter: `user_id=eq.${user.id}` }, () => {
        if (active) scheduleRefresh("REALTIME_MEMBER");
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "church_memberships", filter: `user_id=eq.${user.id}` }, () => {
        if (active) scheduleRefresh("REALTIME_CHURCH_MEMBERSHIP");
      })
      .subscribe((status) => {
        const action = getAuthorizationRealtimeStatusAction(status, active);
        if (!action.shouldLog) return;
        diagnostic("REALTIME_CHANNEL_STATUS", { status }, action.level);
        if (action.refreshReason) scheduleRefresh(action.refreshReason);
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [scheduleRefresh, user]);

  const signOut = async () => {
    sequence.current += 1;
    await supabase.auth.signOut();
    resetUserData();
  };

  const refreshUserData = async () => {
    if (user) {
      setIsLoading(true);
      await loadUserData(user, { force: true, reason: "RETRY", requestedChurchId: currentChurchId.current ?? readStoredActiveChurchId(user.id) });
    }
  };

  const switchChurch = useCallback(
    async (nextChurchId: string) => {
      if (!user) return;
      if (!isValidUuid(nextChurchId)) throw new AuthorizationBootstrapError("Requested church id is invalid.", "INVALID_CONTEXT");
      setIsLoading(true);
      setAuthorizationReady(false);
      await loadUserData(user, { force: true, reason: "SWITCH_CHURCH", requestedChurchId: nextChurchId });
    },
    [loadUserData, user],
  );

  const setActiveView = useCallback(
    (view: ActiveWorkspaceView) => {
      if (!user) return;
      const canUseMemberView = !!member && !!churchId;
      const canUseStaffView = hasStaffWorkspace(staffWorkspace);
      const nextView = view === "member" && canUseMemberView ? "member" : view === "staff" && canUseStaffView ? "staff" : activeView;
      setActiveViewState(nextView);
      writeStoredWorkspaceView(user.id, churchId, nextView);
    },
    [activeView, churchId, member, staffWorkspace, user],
  );

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        member,
        isSuperAdmin,
        churchId,
        activeChurchId: churchId,
        availableChurches,
        userRole,
        userRoles,
        staffWorkspace,
        activeView,
        setActiveView,
        switchChurch,
        setActiveChurch: switchChurch,
        isLoading,
        authorizationError,
        authorizationFailure,
        authorizationReady,
        signOut,
        refreshUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
