import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearSensitiveOfflineData, readOfflineCache, withOfflineCache } from "@/lib/offline-cache";
import { captureException, logSupabaseError } from "@/lib/error-logger";

type AppRole = "super_admin" | "church_admin" | "pastor" | "secretary" | "treasurer" | "member";

type CurrentUserContext = {
  profile: any | null;
  role: AppRole | null;
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
  isLoading: boolean;
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
  isLoading: true,
  signOut: async () => {},
  refreshUserData: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [churchId, setChurchId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const shouldAutoNavigate = () => {
    const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
    return pathname === "/" || pathname === "/login" || pathname === "/onboarding";
  };

  const redirectTo = (path: string) => {
    if (typeof window === "undefined") return;
    if (window.location.pathname === path) return;
    window.location.replace(path);
  };

  const resetUserData = () => {
    clearSensitiveOfflineData();
    setSession(null);
    setUser(null);
    setProfile(null);
    setIsSuperAdmin(false);
    setChurchId(null);
    setUserRole(null);
    setIsLoading(false);
  };

  const isInvalidRefreshTokenError = (error: unknown) => {
    const message = String((error as { message?: string } | null)?.message || "").toLowerCase();
    return message.includes("invalid refresh token") || message.includes("refresh token not found");
  };

  const returnToLoginAfterExpiredSession = () => {
    if (typeof window === "undefined" || window.location.pathname === "/login") return;
    const redirect = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    window.location.replace(`/login?reason=session_expired&redirect=${redirect}`);
  };

  const loadUserData = async (currentUser: User | null) => {
    if (!currentUser) {
      resetUserData();
      return;
    }

    try {
      const authCacheKey = `offline-cache:auth-context:${currentUser.id}`;
      const cachedContext = readOfflineCache<{
        profile: any | null;
        isSuperAdmin: boolean;
        churchId: string | null;
        userRole: AppRole | null;
      } | null>(authCacheKey, null);

      if (cachedContext) {
        setProfile(cachedContext.profile);
        setIsSuperAdmin(cachedContext.isSuperAdmin);
        setChurchId(cachedContext.churchId);
        setUserRole(cachedContext.userRole);
      }

      const contextData = await withOfflineCache<CurrentUserContext | null>(
        `offline-cache:current-user-context:${currentUser.id}`,
        async () => {
          const { data, error: contextError } = await supabase.rpc("get_current_user_context" as never);

          if (contextError) throw contextError;
          return data as unknown as CurrentUserContext;
        },
        cachedContext
          ? {
              profile: cachedContext.profile,
              role: cachedContext.userRole,
              church_id: cachedContext.churchId,
              church: null,
              member: null,
              is_super_admin: cachedContext.isSuperAdmin,
              permissions: {
                is_super_admin: cachedContext.isSuperAdmin,
                can_view_church_workspace: !!cachedContext.churchId,
                can_manage_church_workspace: cachedContext.userRole
                  ? ["super_admin", "church_admin", "pastor", "secretary", "treasurer"].includes(cachedContext.userRole)
                  : false,
              },
            }
          : null,
      );

      if (!contextData) {
        throw new Error("Unable to load user context.");
      }

      const profileData = contextData.profile;
      const isUserSuperAdmin = !!contextData.is_super_admin || profileData?.role === "super_admin";
      const resolvedChurchId = contextData.church_id ?? null;
      const resolvedRole = (isUserSuperAdmin ? "super_admin" : contextData.role) as AppRole | null;

      setProfile(profileData);
      setIsSuperAdmin(isUserSuperAdmin);
      setChurchId(resolvedChurchId);
      setUserRole(resolvedRole);

      window.localStorage.setItem(authCacheKey, JSON.stringify({
        profile: profileData,
        isSuperAdmin: isUserSuperAdmin,
        churchId: resolvedChurchId,
        userRole: resolvedRole,
      }));

      if (shouldAutoNavigate()) {
        if (isUserSuperAdmin) {
          redirectTo("/super-admin");
        } else if (resolvedRole === "church_admin") {
          redirectTo("/church-admin");
        } else if (resolvedChurchId) {
          redirectTo("/portal");
        }
      }
    } catch (err) {
      captureException(err, {
        page: "Authentication",
        component: "AuthProvider",
        function: "loadUserData",
        user_id: currentUser.id,
      });
      setProfile(null);
      setIsSuperAdmin(false);
      setChurchId(null);
      setUserRole(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        setIsLoading(true);
      }

      setTimeout(() => loadUserData(newSession?.user ?? null), 0);
    });

    supabase.auth.getSession().then(async ({ data: { session: existingSession }, error }) => {
      if (error) {
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
      loadUserData(existingSession?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    resetUserData();
  };

  const refreshUserData = async () => {
    if (user) {
      setIsLoading(true);
      await loadUserData(user);
    }
  };

  return (
    <AuthContext.Provider
      value={{ session, user, profile, isSuperAdmin, churchId, userRole, isLoading, signOut, refreshUserData }}
    >
      {children}
    </AuthContext.Provider>
  );
}
