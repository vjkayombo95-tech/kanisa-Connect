import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Church, Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { PASSWORD_RECOVERY_PENDING_KEY, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { useTranslation } from "react-i18next";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hasRecoveryParameters() {
  if (typeof window === "undefined") return false;

  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return query.has("code")
    || query.get("mode") === "reset"
    || query.get("type") === "recovery"
    || hash.get("type") === "recovery"
    || window.sessionStorage.getItem(PASSWORD_RECOVERY_PENDING_KEY) === "true";
}

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    let isActive = true;
    const recoveryRedirect = hasRecoveryParameters();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isActive && recoveryRedirect && session) {
        setIsRecoveryMode(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (isActive && event === "PASSWORD_RECOVERY" && session) {
        setIsRecoveryMode(true);
      }
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleRequestReset = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      toast({
        title: t("auth.forgot.toasts.enter_email.title"),
        description: t("auth.forgot.toasts.enter_email.description"),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/forgot-password?mode=reset`,
    });
    setIsLoading(false);

    if (error) {
      toast({ title: t("auth.forgot.toasts.send_failed.title"), description: t("auth.forgot.toasts.send_failed.description"), variant: "destructive" });
      return;
    }

    setEmailSent(true);
    toast({ title: t("auth.forgot.toasts.check_email.title"), description: t("auth.forgot.toasts.check_email.description") });
  };

  const handleUpdatePassword = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!password) {
      toast({ title: t("auth.forgot.toasts.enter_password.title"), description: t("auth.forgot.toasts.enter_password.description"), variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: t("auth.forgot.toasts.passwords_mismatch.title"), description: t("auth.forgot.toasts.passwords_mismatch.description"), variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setIsLoading(false);
      toast({ title: t("auth.forgot.toasts.update_failed.title"), description: t("auth.forgot.toasts.update_failed.description"), variant: "destructive" });
      return;
    }

    await supabase.auth.signOut();
    window.sessionStorage.removeItem(PASSWORD_RECOVERY_PENDING_KEY);
    toast({ title: t("auth.forgot.toasts.updated.title"), description: t("auth.forgot.toasts.updated.description") });
    navigate("/login", { replace: true });
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
          <h1 className="text-xl font-bold font-serif mt-4">
            {isRecoveryMode ? t("auth.forgot.recovery_title") : t("auth.forgot.request_title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isRecoveryMode
              ? t("auth.forgot.recovery_description")
              : t("auth.forgot.request_description")}
          </p>
        </div>

        <Card className="glass-card gold-glow">
          <CardContent className="p-6 space-y-5">
            {isRecoveryMode ? (
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">{t("auth.fields.new_password")}</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="new-password"
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? t("auth.actions.hide_password") : t("auth.actions.show_password")}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">{t("auth.fields.confirm_new_password")}</Label>
                  <Input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
                <Button className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("auth.forgot.update_password")}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRequestReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">{t("auth.fields.email")}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder={t("auth.placeholders.email")}
                      className="pl-9"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>
                {emailSent && (
                  <p className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                    {t("auth.forgot.email_sent_inline")}
                  </p>
                )}
                <Button className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("auth.forgot.send_reset_link")}
                </Button>
              </form>
            )}

            <p className="text-center text-sm text-muted-foreground">
              {t("auth.forgot.remember_password")}{" "}
              <Link to="/login" className="text-primary hover:underline font-medium">
                {t("auth.login.sign_in_link")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
