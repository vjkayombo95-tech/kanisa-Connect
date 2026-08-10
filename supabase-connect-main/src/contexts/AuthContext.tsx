import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearSensitiveOfflineData, readOfflineCache, writeOfflineCache } from "@/lib/offline-cache";
import {
  AUTHORIZATION_REALTIME_DEPENDENCIES,
  invalidateAuthorizationQueries,
  removeAuthorizationQueries,
  type AuthorizationRealtimeSource,
} from "@/lib/authorization-realtime";
import { captureException, logInfo, logSupabaseError, logWarning } from "@/lib/error-logger";
import { getDefaultRouteForRoles, type AppRole } from "@/lib/role-utils";
import { markStartupEvent } from "@/lib/startup-diagnostics";
import {
  createAnonymousAuthorizationState,
  createAuthorizationErrorState,
  createLoadingAuthorizationState,
  createResolvedAuthorizationState,
  isAuthorizationReady,
  type AuthorizationResolutionState,
} from "@/lib/authorization-readiness";
import {
  AuthorizationBootstrapError,
  classifyAuthorizationFailure,
  isActiveAuthorizationLoad,
  runAuthorizationOperation,
  safeAuthorizationDiagnostic,
  shouldEnableAuthorizationConsoleDiagnostics,
  shouldPreserveVerifiedAuthorization,
  type AuthorizationBootstrapStage,
} from "@/lib/authorization-bootstrap";
import { appEnvironment } from "@/lib/environment";

type CurrentUserContext = {
  profile: any | null;
  role: AppRole | null;
  roles?: AppRole[];
  church_id: string | null;
  church: any | null;
  member: any | null;
  is_super_admin: boolean;
  permissions: {
    is_super_admin: boolean;
    can_view_church_workspace: boolean;
    can_manage_church_workspace: boolean;
  };
};

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: any | null;
  isSuperAdmin: boolean;
  churchId: string | null;
  userRole: AppRole | null;
  userRoles: AppRole[];
  isLoading: boolean;
  authorizationReady: boolean;
  authorizationError: Error | null;
  authorizationResolution: AuthorizationResolutionState;
  signOut: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  isSuperAdmin: false,
  churchId: null,
  userRole: null,
  userRoles: [],
  isLoading: true,
  authorizationReady: false,
  authorizationError: null,
  authorizationResolution: createLoadingAuthorizationState(),
  signOut: async () => {},
  refreshUserData: async () => {},
});

export const useAuth = () => useContext(AuthContext);
const DEV_AUTH_TIMEOUT_MS = 6000;

type LoadUserDataOptions = {
  authoritative?: boolean;
  previousChurchId?: string | null;
  force?: boolean;
  authEvent?: string;
};

function recordAuthorizationDiagnostic(stage: AuthorizationBootstrapStage, metadata: Record<string, unknown> = {}) {
  const safeMetadata = {
    operation: "authorization_bootstrap",
    stage,
    navigatorOnline: typeof navigator !== "undefined" ? navigator.onLine : undefined,
    visibilityState: typeof document !== "undefined" ? document.visibilityState : undefined,
    ...metadata,
  };
  if (shouldEnableAuthorizationConsoleDiagnostics(appEnvironment, import.meta.env.DEV)) {
    console.info("[authorization-bootstrap]", safeMetadata);
  }
  logInfo(stage, { component: "AuthProvider", function: "authorizationBootstrap", metadata: safeMetadata });
}

function withDevTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  if (!import.meta.env.DEV) return promise;

  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} timed out after ${DEV_AUTH_TIMEOUT_MS}ms`)), DEV_AUTH_TIMEOUT_MS);
    }),
  ]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [churchId, setChurchId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [userRoles, setUserRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [authorizationError, setAuthorizationError] = useState<Error | null>(null);
  const [authorizationResolution, setAuthorizationResolution] = useState<AuthorizationResolutionState>(
    createLoadingAuthorizationState,
  );
  const loadSequenceRef = useRef(0);
  const hasVerifiedAuthorizationRef = useRef(false);
  const inFlightLoadRef = useRef<{ userId: string; promise: Promise<void> } | null>(null);
  const scheduledRefreshRef = useRef<number | null>(null);
  const authorizationScopeRef = useRef<{ userId: string | null; churchId: string | null }>({
    userId: null,
    churchId: null,
  });
  const authorizationReady = isAuthorizationReady(authorizationResolution);

  const clearAuthorizationOfflineCache = useCallback((userId: string) => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(`offline-cache:auth-context:v2:${userId}`);
    window.localStorage.removeItem(`offline-cache:current-user-context:v2:${userId}`);
  }, []);

  const failClosedAuthorization = useCallback((userId: string, currentChurchId: string | null, error?: unknown) => {
    clearAuthorizationOfflineCache(userId);
    removeAuthorizationQueries(queryClient, { userId, churchId: currentChurchId });
    setProfile(null);
    setIsSuperAdmin(false);
    setChurchId(null);
    setUserRole(null);
    setUserRoles([]);
    setAuthorizationResolution(createAuthorizationErrorState());
    setAuthorizationError(error instanceof Error ? error : new Error("Authorization data could not be loaded."));
    setIsLoading(false);
  }, [clearAuthorizationOfflineCache, queryClient]);

  const shouldAutoNavigate = useCallback(() => {
    const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
    return pathname === "/" || pathname === "/login" || pathname === "/onboarding";
  }, []);

  const redirectTo = useCallback((path: string) => {
    if (typeof window === "undefined") return;
    if (window.location.pathname === path) return;
    window.location.replace(path);
  }, []);

  const resetUserData = useCallback(() => {
    const previousScope = authorizationScopeRef.current;
    if (previousScope.userId) {
      removeAuthorizationQueries(queryClient, { userId: previousScope.userId, churchId: previousScope.churchId });
    }
    authorizationScopeRef.current = { userId: null, churchId: null };
    hasVerifiedAuthorizationRef.current = false;
    loadSequenceRef.current += 1;
    clearSensitiveOfflineData();
    setSession(null);
    setUser(null);
    setProfile(null);
    setIsSuperAdmin(false);
    setChurchId(null);
    setUserRole(null);
    setUserRoles([]);
    setAuthorizationError(null);
    setAuthorizationResolution(createAnonymousAuthorizationState());
    setIsLoading(false);
  }, [queryClient]);

  const isInvalidRefreshTokenError = useCallback((error: unknown) => {
    const message = String((error as { message?: string } | null)?.message || "").toLowerCase();
    return message.includes("invalid refresh token") || message.includes("refresh token not found");
  }, []);

  const returnToLoginAfterExpiredSession = useCallback(() => {
    if (typeof window === "undefined" || window.location.pathname === "/login") return;
    const redirect = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    window.location.replace(`/login?reason=session_expired&redirect=${redirect}`);
  }, []);

  const performUserDataLoad = useCallback(async (
    currentUser: User | null,
    options: LoadUserDataOptions = {},
  ) => {
    const loadSequence = loadSequenceRef.current + 1;
    loadSequenceRef.current = loadSequence;

    if (!currentUser) {
      markStartupEvent("auth_user_context_skipped", { reason: "no_user" });
      resetUserData();
      return;
    }

    if (!hasVerifiedAuthorizationRef.current) {
      setIsLoading(true);
      setAuthorizationError(null);
      setAuthorizationResolution(createLoadingAuthorizationState("found"));
    }

    try {
      markStartupEvent("auth_user_context_started");
      // v2 requires the multi-role context shape. Reusing a legacy scalar-only
      // cache can redirect a Church Admin + Pastor away from pastoral routes
      // before get_current_user_context() returns the authoritative roles[].
      const authCacheKey = `offline-cache:auth-context:v2:${currentUser.id}`;
      const cachedContext = readOfflineCache<{
        profile: any | null;
        isSuperAdmin: boolean;
        churchId: string | null;
        userRole: AppRole | null;
        userRoles?: AppRole[];
      } | null>(authCacheKey, null);

      if (cachedContext) {
        setProfile(cachedContext.profile);
        setIsSuperAdmin(cachedContext.isSuperAdmin);
        setChurchId(cachedContext.churchId);
        setUserRole(cachedContext.userRole);
        setUserRoles(cachedContext.userRoles ?? (cachedContext.userRole ? [cachedContext.userRole] : []));
        markStartupEvent("auth_context_cache_used", {
          role: cachedContext.userRole,
          hasChurch: Boolean(cachedContext.churchId),
        });
      }

      const contextCacheKey = `offline-cache:current-user-context:v2:${currentUser.id}`;
      const bootstrapAttemptId = crypto.randomUUID();
      const fetchContext = () => runAuthorizationOperation(async (signal) => {
        const { data, error: contextError } = await supabase
          .rpc("get_current_user_context" as never)
          .abortSignal(signal);
        if (contextError) throw contextError;
        return data as unknown as CurrentUserContext;
      }, {
        onAttempt: ({ attempt, phase, durationMs, classification, error }) => {
          const stage = phase === "started" ? "CONTEXT_RPC_STARTED"
            : phase === "succeeded" ? "CONTEXT_RPC_OK" : "CONTEXT_RPC_FAILED";
          recordAuthorizationDiagnostic(stage, {
            bootstrapAttemptId, loadSequence, retryAttempt: attempt, durationMs, classification,
            authEvent: options.authEvent, ...(error ? safeAuthorizationDiagnostic(error) : {}),
          });
        },
      });
      // Cached authorization may paint a shell, but it must never resolve a
      // routing decision. Every startup and refresh waits for the database
      // context so stale null membership cannot be mistaken for onboarding.
      const contextData = await fetchContext();

      if (!contextData) {
        throw new AuthorizationBootstrapError("Unable to load user context.", "CONTEXT_INVALID");
      }
      if (!isActiveAuthorizationLoad(loadSequence, loadSequenceRef.current)) {
        recordAuthorizationDiagnostic("AUTHORIZATION_READY", { loadSequence, staleResultIgnored: true });
        return;
      }
      writeOfflineCache(contextCacheKey, contextData);

      const profileData = contextData.profile;
      const isUserSuperAdmin = !!contextData.is_super_admin || profileData?.role === "super_admin";
      const resolvedChurchId = contextData.church_id ?? null;
      const resolvedRole = (isUserSuperAdmin ? "super_admin" : contextData.role) as AppRole | null;
      const resolvedRoles = (isUserSuperAdmin
        ? ["super_admin"]
        : (contextData.roles ?? (resolvedRole ? [resolvedRole] : []))) as AppRole[];

      setProfile(profileData);
      setIsSuperAdmin(isUserSuperAdmin);
      setChurchId(resolvedChurchId);
      setUserRole(resolvedRole);
      setUserRoles(resolvedRoles);
      authorizationScopeRef.current = { userId: currentUser.id, churchId: resolvedChurchId };
      setAuthorizationResolution(createResolvedAuthorizationState({
        profile: profileData,
        membership: contextData.member,
        roles: resolvedRoles,
        permissions: contextData.permissions,
        churchId: resolvedChurchId,
      }));
      setAuthorizationError(null);
      hasVerifiedAuthorizationRef.current = true;
      recordAuthorizationDiagnostic("AUTHORIZATION_READY", { loadSequence, staleResultIgnored: false });
      markStartupEvent("auth_user_context_completed", {
        role: resolvedRole,
        hasChurch: Boolean(resolvedChurchId),
        isSuperAdmin: isUserSuperAdmin,
      });

      writeOfflineCache(authCacheKey, {
        profile: profileData,
        isSuperAdmin: isUserSuperAdmin,
        churchId: resolvedChurchId,
        userRole: resolvedRole,
        userRoles: resolvedRoles,
      });

      if (shouldAutoNavigate()) {
        if (isUserSuperAdmin || resolvedChurchId) {
          redirectTo(getDefaultRouteForRoles(resolvedRoles, isUserSuperAdmin));
        }
      }
    } catch (err) {
      const classification = classifyAuthorizationFailure(err);
      if (!isActiveAuthorizationLoad(loadSequence, loadSequenceRef.current)) {
        recordAuthorizationDiagnostic("AUTHORIZATION_FAILED", {
          loadSequence, classification, staleResultIgnored: true, ...safeAuthorizationDiagnostic(err),
        });
        return;
      }
      captureException(err, {
        page: "Authentication",
        component: "AuthProvider",
        function: "loadUserData",
        user_id: currentUser.id,
        metadata: { operation: "get_current_user_context", loadSequence, classification },
      });
      recordAuthorizationDiagnostic("AUTHORIZATION_FAILED", {
        loadSequence, classification, staleResultIgnored: false, ...safeAuthorizationDiagnostic(err),
      });
      if (shouldPreserveVerifiedAuthorization(classification, hasVerifiedAuthorizationRef.current)) {
        setAuthorizationError(null);
        setIsLoading(false);
      } else {
        failClosedAuthorization(currentUser.id, options.previousChurchId ?? null, err);
      }
    } finally {
      if (loadSequence === loadSequenceRef.current) {
        setIsLoading(false);
        markStartupEvent("auth_loading_resolved");
      }
    }
  }, [failClosedAuthorization, redirectTo, resetUserData, shouldAutoNavigate]);

  const loadUserData = useCallback((currentUser: User | null, options: LoadUserDataOptions = {}) => {
    if (currentUser && !options.force && inFlightLoadRef.current?.userId === currentUser.id) {
      return inFlightLoadRef.current.promise;
    }
    const promise = performUserDataLoad(currentUser, options);
    if (currentUser) {
      inFlightLoadRef.current = { userId: currentUser.id, promise };
      void promise.then(() => {
        if (inFlightLoadRef.current?.promise === promise) inFlightLoadRef.current = null;
      }, () => {
        if (inFlightLoadRef.current?.promise === promise) inFlightLoadRef.current = null;
      });
    }
    return promise;
  }, [performUserDataLoad]);

  const scheduleUserDataRefresh = useCallback((currentUser: User, options: LoadUserDataOptions = {}) => {
    if (scheduledRefreshRef.current !== null) window.clearTimeout(scheduledRefreshRef.current);
    scheduledRefreshRef.current = window.setTimeout(() => {
      scheduledRefreshRef.current = null;
      void loadUserData(currentUser, options);
    }, 75);
  }, [loadUserData]);

  useEffect(() => {
    markStartupEvent("auth_initialization_started");
    recordAuthorizationDiagnostic("AUTH_SESSION_STARTED");
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === "INITIAL_SESSION") return;
      markStartupEvent("auth_state_changed", { event });
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        const previousScope = authorizationScopeRef.current;
        if (previousScope.userId && previousScope.userId !== newSession.user.id) {
          clearAuthorizationOfflineCache(previousScope.userId);
          removeAuthorizationQueries(queryClient, { userId: previousScope.userId, churchId: previousScope.churchId });
          setProfile(null);
          setIsSuperAdmin(false);
          setChurchId(null);
          setUserRole(null);
          setUserRoles([]);
        }
        if (!hasVerifiedAuthorizationRef.current || authorizationScopeRef.current.userId !== newSession.user.id) {
          setIsLoading(true);
          setAuthorizationError(null);
          setAuthorizationResolution(createLoadingAuthorizationState("found"));
        }
      }

      setTimeout(() => loadUserData(newSession?.user ?? null, { authEvent: event }), 0);
    });

    withDevTimeout(supabase.auth.getSession(), "auth.getSession").then(async ({ data: { session: existingSession }, error }) => {
      markStartupEvent("auth_get_session_completed", { hasSession: Boolean(existingSession), hasError: Boolean(error) });
      if (error) {
        recordAuthorizationDiagnostic("AUTH_SESSION_FAILED", {
          authEvent: "INITIAL_SESSION", ...safeAuthorizationDiagnostic(error),
        });
        if (isInvalidRefreshTokenError(error)) {
          logSupabaseError(error, {
            page: "Authentication",
            component: "AuthProvider",
            function: "restoreSession",
            operation: "auth.getSession",
            metadata: { reason: "invalid_refresh_token" },
          });
          await supabase.auth.signOut({ scope: "local" });
          resetUserData();
          returnToLoginAfterExpiredSession();
          return;
        }

        logSupabaseError(error, {
          page: "Authentication",
          component: "AuthProvider",
          function: "restoreSession",
          operation: "auth.getSession",
        });
        resetUserData();
        return;
      }

      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      recordAuthorizationDiagnostic("AUTH_SESSION_OK", { authEvent: "INITIAL_SESSION", hasSession: Boolean(existingSession) });
      loadUserData(existingSession?.user ?? null, { authEvent: "INITIAL_SESSION" });
    }).catch((error) => {
      recordAuthorizationDiagnostic("AUTH_SESSION_FAILED", {
        authEvent: "INITIAL_SESSION", classification: classifyAuthorizationFailure(error),
      });
      captureException(error, {
        page: "Authentication",
        component: "AuthProvider",
        function: "restoreSession",
        metadata: { reason: "auth_initialization_timeout" },
      });
      resetUserData();
      markStartupEvent("auth_get_session_failed", { error: error instanceof Error ? error.message : "unknown" });
    });

    return () => subscription.unsubscribe();
  }, [clearAuthorizationOfflineCache, isInvalidRefreshTokenError, loadUserData, queryClient, resetUserData, returnToLoginAfterExpiredSession]);

  useEffect(() => {
    if (!user) return;

    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") {
        scheduleUserDataRefresh(user, { authoritative: true, previousChurchId: churchId });
      }
    };

    const refreshOnOnline = () => scheduleUserDataRefresh(user, {
      authoritative: true, previousChurchId: churchId, authEvent: "ONLINE",
    });

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);
    window.addEventListener("online", refreshOnOnline);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
      window.removeEventListener("online", refreshOnOnline);
      if (scheduledRefreshRef.current !== null) window.clearTimeout(scheduledRefreshRef.current);
    };
  }, [churchId, scheduleUserDataRefresh, user]);

  useEffect(() => {
    if (!user) return;

    let active = true;
    const scope = { userId: user.id, churchId };
    const channels: ReturnType<typeof supabase.channel>[] = [];
    const handleChange = (allowedSources: readonly AuthorizationRealtimeSource[]) => (
      message: { payload?: { source?: unknown } },
    ) => {
      const source = message.payload?.source;
      if (!active || typeof source !== "string" || !allowedSources.includes(source as AuthorizationRealtimeSource)) return;
      const authorizationSource = source as AuthorizationRealtimeSource;
      void invalidateAuthorizationQueries(queryClient, authorizationSource, scope);
      if (AUTHORIZATION_REALTIME_DEPENDENCIES[authorizationSource].refreshUserContext) {
        scheduleUserDataRefresh(user, { authoritative: true, previousChurchId: churchId });
      }
    };

    const subscribe = (
      topic: string,
      allowedSources: readonly AuthorizationRealtimeSource[],
      refreshContextOnSubscribe = false,
    ) => {
      const channel = supabase
        .channel(topic, { config: { private: true } })
        .on("broadcast", { event: "authorization_changed" }, handleChange(allowedSources))
        .subscribe((status) => {
          if (!active) return;
          if (status === "SUBSCRIBED") {
            for (const source of allowedSources) void invalidateAuthorizationQueries(queryClient, source, scope);
            if (refreshContextOnSubscribe) {
              // Close the fetch/subscription race and replace offline startup data.
              scheduleUserDataRefresh(user, { authoritative: true, previousChurchId: churchId });
            }
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            recordAuthorizationDiagnostic("REALTIME_CHANNEL_STATUS", { channel: topic, status });
            logWarning("Authorization realtime channel degraded.", {
              component: "AuthProvider", function: "authorizationRealtime", metadata: { channel: topic, status },
            });
            scheduleUserDataRefresh(user, { authoritative: true, previousChurchId: churchId });
          }
        });
      channels.push(channel);
    };

    recordAuthorizationDiagnostic("REALTIME_AUTH_STARTED");
    void supabase.realtime.setAuth().then(() => {
      if (!active) return;
      recordAuthorizationDiagnostic("REALTIME_AUTH_OK");
      subscribe(`authorization:user:${user.id}`, ["user_roles", "members", "profiles"], true);
      if (churchId) {
        subscribe(`authorization:church:${churchId}`, [
          "church_role_permissions", "church_features", "subscriptions",
        ]);
      }
      subscribe("authorization:platform", ["platform_features"]);
    }).catch((error) => {
      if (!active) return;
      recordAuthorizationDiagnostic("REALTIME_AUTH_FAILED", {
        classification: classifyAuthorizationFailure(error), ...safeAuthorizationDiagnostic(error),
      });
      logWarning("Authorization realtime authentication degraded.", {
        component: "AuthProvider", function: "authorizationRealtime.setAuth",
        metadata: { classification: classifyAuthorizationFailure(error) },
      });
      scheduleUserDataRefresh(user, { authoritative: true, previousChurchId: churchId });
    });

    return () => {
      active = false;
      for (const channel of channels) void supabase.removeChannel(channel);
    };
  }, [churchId, queryClient, scheduleUserDataRefresh, user]);

  const signOut = async () => {
    await supabase.auth.signOut();
    resetUserData();
  };

  const refreshUserData = async () => {
    if (user) {
      setIsLoading(true);
      await loadUserData(user, { authoritative: true, previousChurchId: churchId, force: true, authEvent: "RETRY" });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        isSuperAdmin,
        churchId,
        userRole,
        userRoles,
        isLoading,
        authorizationReady,
        authorizationError,
        authorizationResolution,
        signOut,
        refreshUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
