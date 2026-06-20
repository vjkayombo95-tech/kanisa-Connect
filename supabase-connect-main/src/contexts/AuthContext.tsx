import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { readOfflineCache, withOfflineCache } from "@/lib/offline-cache";
import { captureException, logSupabaseError } from "@/lib/error-logger";

type AppRole = "super_admin" | "church_admin" | "pastor" | "secretary" | "treasurer" | "member";

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

  const resolveChurchContext = async (
    currentUser: User,
    profileData: any,
    isUserSuperAdmin: boolean,
  ) => {
    let resolvedChurchId = profileData?.church_id ?? null;
    let resolvedRole: AppRole | null = isUserSuperAdmin ? "super_admin" : null;

    if (isUserSuperAdmin) {
      return { churchId: resolvedChurchId, role: resolvedRole };
    }

    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("church_id, role")
      .eq("user_id", currentUser.id)
      .limit(1)
      .maybeSingle();

    if (roleError) throw roleError;

    if (roleData?.church_id) {
      resolvedChurchId = roleData.church_id;
    }

    if (roleData?.role) {
      resolvedRole = roleData.role as AppRole;
    }

    if (!resolvedChurchId) {
      const { data: memberData, error: memberError } = await supabase
        .from("members")
        .select("church_id")
        .eq("user_id", currentUser.id)
        .not("church_id", "is", null)
        .limit(1)
        .maybeSingle();

      if (memberError) throw memberError;

      if (memberData?.church_id) {
        resolvedChurchId = memberData.church_id;
      }
    }

    if (!resolvedChurchId) {
      const { data: createdChurch, error: createdChurchError } = await supabase
        .from("churches")
        .select("id")
        .eq("created_by", currentUser.id)
        .limit(1)
        .maybeSingle();

      if (createdChurchError) throw createdChurchError;

      if (createdChurch?.id) {
        resolvedChurchId = createdChurch.id;
      }
    }

    if (!resolvedRole) {
      resolvedRole = resolvedChurchId ? "member" : null;
    }

    return { churchId: resolvedChurchId, role: resolvedRole };
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

      const { data: superAdmin, error: superAdminError } = await supabase
        .from("super_admins")
        .select("id")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (superAdminError) throw superAdminError;

      const profileData = await withOfflineCache(
        `offline-cache:profile:${currentUser.id}`,
        async () => {
          const { data, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", currentUser.id)
            .maybeSingle();

          if (profileError) throw profileError;
          return data;
        },
        cachedContext?.profile ?? null,
      );

      setProfile(profileData);

      const isUserSuperAdmin = !!superAdmin || profileData?.role === "super_admin";
      setIsSuperAdmin(isUserSuperAdmin);

      const resolvedContext = await resolveChurchContext(currentUser, profileData, isUserSuperAdmin);

      setChurchId(resolvedContext.churchId);
      setUserRole(resolvedContext.role);

      window.localStorage.setItem(authCacheKey, JSON.stringify({
        profile: profileData,
        isSuperAdmin: isUserSuperAdmin,
        churchId: resolvedContext.churchId,
        userRole: resolvedContext.role,
      }));

      if (shouldAutoNavigate()) {
        if (isUserSuperAdmin) {
          redirectTo("/super-admin");
        } else if (resolvedContext.role === "church_admin") {
          redirectTo("/church-admin");
        } else if (resolvedContext.churchId) {
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
