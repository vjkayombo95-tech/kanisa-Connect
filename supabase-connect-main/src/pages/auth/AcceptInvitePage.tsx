import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Church, Loader2, CheckCircle, XCircle, Mail, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { translateRoleLabel } from "@/lib/localization";
import { useTranslation } from "react-i18next";

type InviteState = "loading" | "valid" | "invalid" | "expired" | "accepted" | "revoked" | "already_accepted";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AuthTranslator = (key: string, options?: Record<string, unknown>) => string;

function formatInviteAuthError(t: AuthTranslator) {
  return t("auth.invite.toasts.accept_failed.description");
}

export default function AcceptInvitePage() {
  const { i18n, t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [state, setState] = useState<InviteState>("loading");
  const [invitation, setInvitation] = useState<any>(null);
  const [churchName, setChurchName] = useState("");
  const [accepting, setAccepting] = useState(false);

  // Signup form for new users
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [signingUp, setSigningUp] = useState(false);
  const [showSignup, setShowSignup] = useState(false);

  // Load invitation details
  useEffect(() => {
    if (!token) { setState("invalid"); return; }

    const loadInvitation = async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("*, churches(name)")
        .eq("token", token)
        .maybeSingle();

      if (error || !data) {
        setState("invalid");
        return;
      }

      setInvitation(data);
      setChurchName((data as any).churches?.name || t("auth.invite.default_church"));
      setEmail(data.email);

      if (data.status === "accepted") {
        setState("already_accepted");
      } else if (data.status === "revoked") {
        setState("revoked");
      } else if (new Date(data.expires_at) < new Date()) {
        setState("expired");
      } else {
        setState("valid");
      }
    };

    loadInvitation();
  }, [t, token]);

  // Accept invitation as logged-in user
  const handleAccept = async () => {
    if (!user || !token) return;
    setAccepting(true);

    try {
      const { data, error } = await supabase.rpc("accept_invitation", { _token: token });

      if (error) throw error;

      const result = data as any;
      if (!result?.success) {
        toast({ title: t("auth.invite.toasts.accept_failed.title"), description: formatInviteAuthError(t), variant: "destructive" });
        setAccepting(false);
        return;
      }

      toast({ title: t("auth.invite.toasts.welcome.title"), description: t("auth.invite.toasts.welcome.with_role", { church: result.church_name, role: translateRoleLabel(t, result.role) }) });
      setState("accepted");

      // Redirect based on role
      setTimeout(() => {
        const adminRoles = ["church_admin", "pastor", "secretary", "treasurer"];
        if (adminRoles.includes(result.role)) {
          navigate("/church-admin");
        } else {
          navigate("/portal");
        }
      }, 1500);
    } catch {
      toast({ title: t("auth.common.error"), description: formatInviteAuthError(t), variant: "destructive" });
    } finally {
      setAccepting(false);
    }
  };

  // Sign up new user then accept
  const handleSignupAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim();

    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      toast({ title: t("auth.invite.toasts.invalid_email.title"), description: t("auth.invite.toasts.invalid_email.description"), variant: "destructive" });
      return;
    }
    if (!fullName || !password) return;
    setSigningUp(true);

    try {
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/invite/${token}`,
        },
      });

      if (signupError) throw signupError;

      // If email confirmation is required
      if (!signupData.session) {
        toast({
          title: t("auth.invite.toasts.check_email.title"),
          description: t("auth.invite.toasts.check_email.description"),
        });
        setSigningUp(false);
        return;
      }

      // Auto-accept since we have a session
      const { data, error } = await supabase.rpc("accept_invitation", { _token: token });
      if (error) throw error;

      const result = data as any;
      if (result?.success) {
        toast({ title: t("auth.invite.toasts.welcome.title"), description: t("auth.invite.toasts.welcome.basic", { church: result.church_name }) });
        setState("accepted");
        setTimeout(() => {
          const adminRoles = ["church_admin", "pastor", "secretary", "treasurer"];
          navigate(adminRoles.includes(result.role) ? "/church-admin" : "/portal");
        }, 1500);
      } else {
        toast({ title: t("auth.invite.toasts.account_created.title"), description: t("auth.invite.toasts.account_created.description") });
      }
    } catch {
      toast({ title: t("auth.common.error"), description: formatInviteAuthError(t), variant: "destructive" });
    } finally {
      setSigningUp(false);
    }
  };

  // Sign in existing user then accept
  const [loginPassword, setLoginPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const handleLoginAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPassword) return;
    setLoggingIn(true);

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: loginPassword,
      });
      if (loginError) throw loginError;

      // Now accept
      const { data, error } = await supabase.rpc("accept_invitation", { _token: token });
      if (error) throw error;

      const result = data as any;
      if (result?.success) {
        toast({ title: t("auth.invite.toasts.welcome.title"), description: t("auth.invite.toasts.welcome.basic", { church: result.church_name }) });
        setState("accepted");
        setTimeout(() => {
          const adminRoles = ["church_admin", "pastor", "secretary", "treasurer"];
          navigate(adminRoles.includes(result.role) ? "/church-admin" : "/portal");
        }, 1500);
      }
    } catch {
      toast({ title: t("auth.common.error"), description: formatInviteAuthError(t), variant: "destructive" });
    } finally {
      setLoggingIn(false);
    }
  };

  if (state === "loading" || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
        </div>

        <Card className="glass-card gold-glow">
          <CardContent className="p-6 space-y-5">
            {/* INVALID */}
            {state === "invalid" && (
              <div className="text-center py-6">
                <XCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
                <h2 className="text-xl font-bold font-serif mb-2">{t("auth.invite.invalid_title")}</h2>
                <p className="text-muted-foreground text-sm">{t("auth.invite.invalid_description")}</p>
                <Button className="mt-6" asChild><Link to="/login">{t("auth.invite.go_to_login")}</Link></Button>
              </div>
            )}

            {/* EXPIRED */}
            {state === "expired" && (
              <div className="text-center py-6">
                <XCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-xl font-bold font-serif mb-2">{t("auth.invite.expired_title")}</h2>
                <p className="text-muted-foreground text-sm">{t("auth.invite.expired_description")}</p>
                <Button className="mt-6" asChild><Link to="/login">{t("auth.invite.go_to_login")}</Link></Button>
              </div>
            )}

            {/* REVOKED */}
            {state === "revoked" && (
              <div className="text-center py-6">
                <XCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-xl font-bold font-serif mb-2">{t("auth.invite.revoked_title")}</h2>
                <p className="text-muted-foreground text-sm">{t("auth.invite.revoked_description")}</p>
                <Button className="mt-6" asChild><Link to="/login">{t("auth.invite.go_to_login")}</Link></Button>
              </div>
            )}

            {/* ALREADY ACCEPTED */}
            {state === "already_accepted" && (
              <div className="text-center py-6">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-primary" />
                <h2 className="text-xl font-bold font-serif mb-2">{t("auth.invite.already_accepted_title")}</h2>
                <p className="text-muted-foreground text-sm">{t("auth.invite.already_accepted_description")}</p>
                <Button className="mt-6" asChild><Link to="/login">{t("auth.invite.go_to_dashboard")}</Link></Button>
              </div>
            )}

            {/* ACCEPTED (just now) */}
            {state === "accepted" && (
              <div className="text-center py-6">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-primary" />
                <h2 className="text-xl font-bold font-serif mb-2">{t("auth.invite.accepted_title")}</h2>
                <p className="text-muted-foreground text-sm">{t("auth.invite.accepted_description", { church: churchName })}</p>
                <Loader2 className="h-5 w-5 animate-spin mx-auto mt-4 text-primary" />
              </div>
            )}

            {/* VALID - show accept options */}
            {state === "valid" && invitation && (
              <>
                <div className="text-center">
                  <h2 className="text-xl font-bold font-serif mb-2">{t("auth.invite.invited_title")}</h2>
                  <p className="text-muted-foreground text-sm">
                    {t("auth.invite.invited_description")} <span className="text-foreground font-medium">{churchName}</span>
                  </p>
                </div>

                <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("auth.invite.fields.church")}</span>
                    <span className="font-medium">{churchName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("auth.invite.fields.role")}</span>
                    <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
                      {translateRoleLabel(t, invitation.role)}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("auth.fields.email")}</span>
                    <span>{invitation.email}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("auth.invite.fields.expires")}</span>
                    <span>{new Date(invitation.expires_at).toLocaleDateString(i18n.language === "sw" ? "sw-TZ" : "en-TZ")}</span>
                  </div>
                </div>

                {/* Already logged in */}
                {user ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground text-center">
                      {t("auth.invite.signed_in_as")} <span className="text-foreground">{user.email}</span>
                    </p>
                    <Button className="w-full" onClick={handleAccept} disabled={accepting}>
                      {accepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t("auth.invite.accept_button")}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Login option */}
                    {!showSignup && (
                      <>
                        {showLogin ? (
                          <form onSubmit={handleLoginAndAccept} className="space-y-3">
                            <p className="text-sm text-muted-foreground">{t("auth.invite.sign_in_prompt")}</p>
                            <div className="space-y-2">
                              <Label>{t("auth.fields.email")}</Label>
                              <Input type="email" value={email} disabled className="bg-muted/50" />
                            </div>
                            <div className="space-y-2">
                              <Label>{t("auth.fields.password")}</Label>
                              <Input
                                type="password"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                placeholder={t("auth.placeholders.password")}
                                required
                              />
                            </div>
                            <Button className="w-full" type="submit" disabled={loggingIn}>
                              {loggingIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              {t("auth.invite.sign_in_accept")}
                            </Button>
                            <button
                              type="button"
                              onClick={() => { setShowLogin(false); setShowSignup(true); }}
                              className="text-sm text-primary hover:underline w-full text-center"
                            >
                              {t("auth.invite.no_account_signup")}
                            </button>
                          </form>
                        ) : (
                          <>
                            <Button className="w-full" onClick={() => setShowLogin(true)}>
                              <Mail className="mr-2 h-4 w-4" /> {t("auth.invite.sign_in_to_accept")}
                            </Button>
                            <button
                              type="button"
                              onClick={() => setShowSignup(true)}
                              className="text-sm text-primary hover:underline w-full text-center"
                            >
                              {t("auth.invite.create_account_prompt")}
                            </button>
                          </>
                        )}
                      </>
                    )}

                    {/* Signup option */}
                    {showSignup && (
                      <form onSubmit={handleSignupAndAccept} className="space-y-3">
                        <p className="text-sm text-muted-foreground">{t("auth.invite.create_account_to_join")}</p>
                        <div className="space-y-2">
                          <Label>{t("auth.fields.full_name")}</Label>
                          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("auth.placeholders.full_name")} required />
                        </div>
                        <div className="space-y-2">
                          <Label>{t("auth.fields.email")}</Label>
                          <Input type="email" value={email} disabled className="bg-muted/50" />
                        </div>
                        <div className="space-y-2">
                          <Label>{t("auth.fields.password")}</Label>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder={t("auth.placeholders.choose_password")}
                              required
                              minLength={6}
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        <Button className="w-full" type="submit" disabled={signingUp}>
                          {signingUp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {t("auth.invite.create_account_accept")}
                        </Button>
                        <button
                          type="button"
                          onClick={() => { setShowSignup(false); setShowLogin(true); }}
                          className="text-sm text-primary hover:underline w-full text-center"
                        >
                          {t("auth.invite.already_have_account_signin")}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
