import { useEffect, useMemo, useState } from "react";
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
import {
  assertPhoneIsAvailable,
  looksLikeEmail,
  normalizeTanzanianPhone,
  resolveMemberEmailForPhoneLogin,
} from "@/lib/phone-auth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PENDING_REGISTRATION_REDIRECT_PREFIX = "pending-registration-redirect:";

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
  const [searchParams] = useSearchParams();
  const [identity, setIdentity] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState("");
  const [isAwaitingRedirect, setIsAwaitingRedirect] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, profile, isSuperAdmin, churchId, userRole, isLoading: isAuthLoading } = useAuth();
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
      toast({ title: "Missing fields", description: "Please enter your email or phone number and password.", variant: "destructive" });
      return;
    }
    if (isSignUp && !fullName) {
      toast({ title: "Missing name", description: "Please enter your full name.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const isEmail = looksLikeEmail(rawIdentity);

      if (isSignUp) {
        if (!isEmail) {
          throw new Error("Please enter a valid email address to create a password account. Phone-only signup will be available when SMS OTP is enabled.");
        }

        const normalizedEmail = rawIdentity.toLowerCase();
        const normalizedPhone = normalizeTanzanianPhone(signupPhone);
        if (!normalizedPhone.valid) {
          throw new Error(normalizedPhone.error);
        }

        await assertPhoneIsAvailable(normalizedPhone.e164);

        const { error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${redirectTarget}`,
            data: { full_name: fullName, phone: normalizedPhone.e164, phone_verified: false },
          },
        });
        if (error) throw error;
        toast({ title: "Check your email", description: "We sent you a confirmation link." });
      } else {
        let authEmail = "";
        if (isEmail) {
          authEmail = rawIdentity.toLowerCase();
        } else {
          const normalizedPhone = normalizeTanzanianPhone(rawIdentity);
          if (!normalizedPhone.valid) {
            throw new Error(normalizedPhone.error);
          }
          const resolved = await resolveMemberEmailForPhoneLogin(normalizedPhone.e164);
          authEmail = resolved.email;
        }

        if (!EMAIL_REGEX.test(authEmail)) {
          throw new Error("This account is not linked to a valid email login. Please contact your church office.");
        }

        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password });
        if (error) throw error;
        setIsAwaitingRedirect(true);
      }
    } catch (err: any) {
      const message = String(err?.message || "");
      const normalizedMessage = message.toLowerCase();

      toast({
        title: "Authentication error",
        description: normalizedMessage.includes("email not confirmed")
          ? "Your account exists, but your email is not confirmed yet. Check your inbox and then sign in again."
          : normalizedMessage.includes("invalid login credentials")
            ? "The email/phone number or password is incorrect."
            : message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${redirectTarget}` },
    });
    if (error) {
      toast({ title: "Google login failed", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 mb-6">
            <div className="h-11 w-11 rounded-xl gradient-gold flex items-center justify-center">
              <Church className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold font-serif">Kanisa Connect</span>
          </Link>
          <h1 className="text-xl font-bold font-serif mt-4">{isSignUp ? "Create your account" : "Welcome back"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isSignUp ? "Sign up to get started with Kanisa Connect" : "Sign in to continue to your dashboard"}
          </p>
        </div>

        <Card className="glass-card gold-glow">
          <CardContent className="p-6 space-y-5">
            <Button variant="outline" className="w-full" onClick={handleGoogleLogin}>
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Continue with Google
            </Button>

            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">or</span>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              {isSignUp && (
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    placeholder="Your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>{isSignUp ? "Email" : "Email or Phone Number"}</Label>
                <div className="relative">
                  {isSignUp ? (
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  )}
                  <Input
                    type={isSignUp ? "email" : "text"}
                    placeholder={isSignUp ? "you@example.com" : "Email or Phone Number"}
                    className="pl-9"
                    value={identity}
                    onChange={(e) => setIdentity(e.target.value)}
                    autoComplete={isSignUp ? "email" : "username"}
                  />
                </div>
              </div>
              {isSignUp && (
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="tel"
                      placeholder="07XXXXXXXX"
                      className="pl-9"
                      value={signupPhone}
                      onChange={(e) => setSignupPhone(e.target.value)}
                      autoComplete="tel"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Supports 07XXXXXXXX, +2557XXXXXXXX, or 2557XXXXXXXX.</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Password</Label>
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
                {isSignUp ? "Create Account" : "Sign In"}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <button onClick={() => setIsSignUp(!isSignUp)} className="text-primary hover:underline font-medium">
                {isSignUp ? "Sign in" : "Sign up"}
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
