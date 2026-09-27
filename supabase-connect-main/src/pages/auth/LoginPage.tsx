import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Church, Eye, EyeOff, Loader2, Mail, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { useTranslation } from "react-i18next";
import {
  assertPhoneIsAvailable,
  looksLikeEmail,
  normalizeTanzanianPhone,
  resolveMemberEmailForPhoneLogin,
} from "@/lib/phone-auth";
import { assertClientRateLimit } from "@/lib/client-rate-limit";
import { logSupabaseError } from "@/lib/error-logger";
import { isTransientAuthorizationFailure } from "@/lib/authorization-bootstrap";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PENDING_REGISTRATION_REDIRECT_PREFIX = "pending-registration-redirect:";

type AuthTranslator = (key: string, options?: Record<string, unknown>) => string;

function formatLoginAuthError(message: string, options: { isSignUp: boolean; phoneLoginAttempt: boolean }, t: AuthTranslator) {
  const normalizedMessage = message.toLowerCase();

  if (options.phoneLoginAttempt) {
    return t("auth.login.toasts.authentication_error.invalid_phone");
  }

  if (options.isSignUp && normalizedMessage.includes("phone")) {
    return t("auth.login.toasts.authentication_error.invalid_signup_phone");
  }

  if (normalizedMessage.includes("email not confirmed")) {
    return t("auth.login.toasts.authentication_error.email_not_confirmed");
  }

  if (normalizedMessage.includes("invalid login credentials")) {
    return t("auth.login.toasts.authentication_error.invalid_credentials");
  }

  return t("auth.login.toasts.authentication_error.fallback");
}

function getPendingRegistrationRedirect(email: string) {
  if (typeof window === "undefined") return null;
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;
  return window.localStorage.getItem(`${PENDING_REGISTRATION_REDIRECT_PREFIX}${normalizedEmail}`);
}

function clearPendingRegistrationRedirect(email: string) {
  if (typeof window === "undefined") return;
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return;
  window.localStorage.removeItem(`${PENDING_REGISTRATION_REDIRECT_PREFIX}${normalizedEmail}`);
}

export default function LoginPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [identity, setIdentity] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState("");
  const [isAwaitingRedirect, setIsAwaitingRedirect] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [isResendingConfirmation, setIsResendingConfirmation] = useState(false);
  const expiredSessionNoticeShown = useRef(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, profile, isSuperAdmin, churchId, userRole, isLoading: isAuthLoading, authorizationError, authorizationFailure, refreshUserData } = useAuth();
  const authorizationConnectivityIssue = Boolean(user && authorizationError && authorizationFailure && isTransientAuthorizationFailure(authorizationFailure));
  const pendingRegistrationRedirect = useMemo(
    () => getPendingRegistrationRedirect(user?.email || identity),
    [identity, user?.email],
  );
  const redirectTarget = useMemo(() => {
    const rawRedirect = searchParams.get("redirect");
    if (rawRedirect && rawRedirect.startsWith("/")) return rawRedirect;
    if (pendingRegistrationRedirect && pendingRegistrationRedirect.startsWith("/")) return pendingRegistrationRedirect;
    return "/portal";
  }, [pendingRegistrationRedirect, searchParams]);
  const initialMode = searchParams.get("mode");
  const presetEmail = searchParams.get("email");

  useEffect(() => {
    if (searchParams.get("reason") !== "session_expired" || expiredSessionNoticeShown.current) return;
    expiredSessionNoticeShown.current = true;
    toast({
      title: t("auth.login.toasts.session_expired.title"),
      description: t("auth.login.toasts.session_expired.description"),
      variant: "destructive",
    });
  }, [searchParams, t, toast]);

  useEffect(() => {
    if (initialMode === "signup") {
      setIsSignUp(true);
    }
  }, [initialMode]);

  useEffect(() => {
    if (presetEmail) {
      setIdentity(presetEmail);
    }
  }, [presetEmail]);

  useEffect(() => {
    const shouldResolveRedirect =
      isAwaitingRedirect ||
      Boolean(searchParams.get("redirect")) ||
      Boolean(pendingRegistrationRedirect);

    if (!shouldResolveRedirect || isAuthLoading || !user) {
      return;
    }

    if (isSuperAdmin || profile?.role === "super_admin") {
      setIsAwaitingRedirect(false);
      navigate("/super-admin", { replace: true });
      return;
    }

    const needsChurchOnboarding =
      profile?.onboarding_completed === false &&
      !churchId &&
      userRole !== "member" &&
      !redirectTarget.startsWith("/register") &&
      !redirectTarget.startsWith("/invite");

    if (needsChurchOnboarding) {
      setIsAwaitingRedirect(false);
      navigate("/onboarding", { replace: true });
      return;
    }

    setIsAwaitingRedirect(false);
    clearPendingRegistrationRedirect(user.email || identity);
    navigate(redirectTarget, { replace: true });
  }, [churchId, identity, isAwaitingRedirect, isAuthLoading, isSuperAdmin, navigate, pendingRegistrationRedirect, profile, redirectTarget, searchParams, user, userRole]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawIdentity = identity.trim();

    if (!rawIdentity || !password) {
      toast({ title: t("auth.login.toasts.missing_fields.title"), description: t("auth.login.toasts.missing_fields.description"), variant: "destructive" });
      return;
    }
    if (isSignUp && !fullName) {
      toast({ title: t("auth.login.toasts.missing_name.title"), description: t("auth.login.toasts.missing_name.description"), variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      assertClientRateLimit(`auth-login:${rawIdentity.toLowerCase() || "unknown"}`, 5, 10 * 60 * 1000, "login attempts");
      const isEmail = looksLikeEmail(rawIdentity);

      if (isSignUp) {
        if (!isEmail) {
          throw new Error(t("auth.login.errors.email_required_for_signup"));
        }

        const normalizedEmail = rawIdentity.toLowerCase();
        const normalizedPhone = normalizeTanzanianPhone(signupPhone);
        if (normalizedPhone.valid === false) {
          throw new Error(normalizedPhone.error);
        }

        await assertPhoneIsAvailable(normalizedPhone.e164);

        const { data: signUpData, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${redirectTarget}`,
            data: { full_name: fullName, phone: normalizedPhone.e164, phone_verified: false },
          },
        });
        if (error) {
          logSupabaseError(error, {
            page: "Login",
            component: "LoginPage",
            function: "signUp",
            operation: "auth.signUp",
            metadata: { mode: "signup", identity_type: "email" },
          });
          throw error;
        }

        if (signUpData.session) {
          toast({ title: t("auth.login.toasts.account_created.title"), description: t("auth.login.toasts.account_created.description") });
          setIsAwaitingRedirect(true);
          return;
        }

        setConfirmationEmail(normalizedEmail);
        toast({ title: t("auth.login.toasts.confirm_email.title"), description: t("auth.login.toasts.confirm_email.description", { email: normalizedEmail }) });
      } else {
        let authEmail = "";
        if (isEmail) {
          authEmail = rawIdentity.toLowerCase();
        } else {
          const normalizedPhone = normalizeTanzanianPhone(rawIdentity);
          if (normalizedPhone.valid === false) {
            throw new Error(normalizedPhone.error);
          }
          const resolved = await resolveMemberEmailForPhoneLogin(normalizedPhone.e164);
          authEmail = resolved.email;
        }

        if (!EMAIL_REGEX.test(authEmail)) {
          throw new Error(t("auth.login.errors.no_email_login"));
        }

        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password });
        if (error) {
          logSupabaseError(error, {
            page: "Login",
            component: "LoginPage",
            function: "signInWithPassword",
            operation: "auth.signInWithPassword",
            metadata: { mode: "signin", identity_type: isEmail ? "email" : "phone" },
          });
          throw error;
        }
        setIsAwaitingRedirect(true);
      }
    } catch (err: any) {
      const message = String(err?.message || "");
      const normalizedMessage = message.toLowerCase();
      const phoneLoginAttempt = !isSignUp && !looksLikeEmail(rawIdentity);

      logSupabaseError(err, {
        page: "Login",
        component: "LoginPage",
        function: "handleEmailAuth",
        operation: "authentication_attempt",
        metadata: { mode: isSignUp ? "signup" : "signin", identity_type: phoneLoginAttempt ? "phone" : "email" },
      });

      toast({
        title: t("auth.login.toasts.authentication_error.title"),
        description: formatLoginAuthError(message, { isSignUp, phoneLoginAttempt }, t),
        variant: "destructive",
      });

      if (normalizedMessage.includes("email not confirmed") && looksLikeEmail(rawIdentity)) {
        setConfirmationEmail(rawIdentity.toLowerCase());
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    const normalizedEmail = confirmationEmail.trim().toLowerCase();
    if (!normalizedEmail) return;

    setIsResendingConfirmation(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}${redirectTarget}`,
        },
      });
      if (error) {
        logSupabaseError(error, {
          page: "Login",
          component: "LoginPage",
          function: "resendConfirmation",
          operation: "auth.resend",
          metadata: { email: normalizedEmail },
        });
        throw error;
      }
      toast({ title: t("auth.login.toasts.confirmation_resent.title"), description: t("auth.login.toasts.confirmation_resent.description", { email: normalizedEmail }) });
    } catch {
      toast({
        title: t("auth.login.toasts.resend_failed.title"),
        description: t("auth.login.toasts.resend_failed.description"),
        variant: "destructive",
      });
    } finally {
      setIsResendingConfirmation(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      assertClientRateLimit("auth-login:google", 5, 10 * 60 * 1000, "login attempts");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}${redirectTarget}` },
      });
      if (error) {
        logSupabaseError(error, {
          page: "Login",
          component: "LoginPage",
          function: "googleLogin",
          operation: "auth.signInWithOAuth",
          metadata: { provider: "google" },
        });
        throw error;
      }
    } catch {
      toast({ title: t("auth.login.toasts.google_failed.title"), description: t("auth.login.toasts.google_failed.description"), variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="mb-4 flex justify-center">
            <LanguageSwitcher />
          </div>
          <Link to="/" className="inline-flex items-center gap-3 mb-6">
            <div className="h-11 w-11 rounded-xl gradient-gold flex items-center justify-center">
              <Church className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold font-serif">Kanisa Connect</span>
          </Link>
          <h1 className="text-xl font-bold font-serif mt-4">{isSignUp ? t("auth.login.create_account_title") : t("auth.login.welcome_title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isSignUp ? t("auth.login.create_account_description") : t("auth.login.welcome_description")}
          </p>
        </div>

        <Card className="glass-card gold-glow">
          <CardContent className="p-6 space-y-5">
            {authorizationConnectivityIssue && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                <p className="font-semibold">{t("shared.auth.connectivity_title")}</p>
                <p className="mt-1 text-muted-foreground">{t("shared.auth.connectivity_description")}</p>
                <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => void refreshUserData()}>{t("shared.actions.retry")}</Button>
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={handleGoogleLogin}>
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              {t("auth.login.continue_google")}
            </Button>

            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">{t("auth.login.or")}</span>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              {isSignUp && (
                <div className="space-y-2">
                  <Label>{t("auth.fields.full_name")}</Label>
                  <Input
                    placeholder={t("auth.placeholders.full_name")}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>{isSignUp ? t("auth.fields.email") : t("auth.fields.email_or_phone")}</Label>
                <div className="relative">
                  {isSignUp ? (
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  )}
                  <Input
                    type={isSignUp ? "email" : "text"}
                    placeholder={isSignUp ? t("auth.placeholders.email") : t("auth.placeholders.email_or_phone")}
                    className="pl-9"
                    value={identity}
                    onChange={(e) => setIdentity(e.target.value)}
                    autoComplete={isSignUp ? "email" : "username"}
                  />
                </div>
              </div>
              {isSignUp && (
                <div className="space-y-2">
                  <Label>{t("auth.fields.phone")}</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="tel"
                      placeholder={t("auth.placeholders.phone")}
                      className="pl-9"
                      value={signupPhone}
                      onChange={(e) => setSignupPhone(e.target.value)}
                      autoComplete="tel"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{t("auth.phone_hint")}</p>
                </div>
              )}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t("auth.fields.password")}</Label>
                  {!isSignUp && (
                    <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                      {t("auth.login.forgot_password")}
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button className="w-full" disabled={isLoading || isAwaitingRedirect}>
                {(isLoading || isAwaitingRedirect) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSignUp ? t("auth.login.create_account_button") : t("auth.login.sign_in_button")}
              </Button>
            </form>

            {confirmationEmail && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
                <p className="font-medium">{t("auth.login.confirmation_waiting_title")}</p>
                <p className="mt-1 text-muted-foreground">
                  {t("auth.login.confirmation_waiting_description", { email: confirmationEmail })}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 w-full"
                  disabled={isResendingConfirmation}
                  onClick={handleResendConfirmation}
                >
                  {isResendingConfirmation && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("auth.login.resend_confirmation")}
                </Button>
              </div>
            )}

            <p className="text-center text-sm text-muted-foreground">
              {isSignUp ? t("auth.login.already_have_account") : t("auth.login.no_account")}{" "}
              <button onClick={() => { setIsSignUp(!isSignUp); setConfirmationEmail(""); }} className="text-primary hover:underline font-medium">
                {isSignUp ? t("auth.login.sign_in_link") : t("auth.login.sign_up_link")}
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
