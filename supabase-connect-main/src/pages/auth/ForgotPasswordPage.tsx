import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Church, Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { PASSWORD_RECOVERY_PENDING_KEY, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
        title: "Enter your email",
        description: "Password reset links can only be sent to a valid email address.",
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
      toast({ title: "Unable to send reset link", description: error.message, variant: "destructive" });
      return;
    }

    setEmailSent(true);
    toast({ title: "Check your email", description: "A password reset link has been sent if an account exists for that email." });
  };

  const handleUpdatePassword = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!password) {
      toast({ title: "Enter a new password", description: "Your new password cannot be empty.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", description: "Enter the same new password in both fields.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setIsLoading(false);
      toast({ title: "Unable to update password", description: error.message, variant: "destructive" });
      return;
    }

    await supabase.auth.signOut();
    window.sessionStorage.removeItem(PASSWORD_RECOVERY_PENDING_KEY);
    toast({ title: "Password updated", description: "Sign in with your new password." });
    navigate("/login", { replace: true });
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
          <h1 className="text-xl font-bold font-serif mt-4">
            {isRecoveryMode ? "Choose a new password" : "Forgot your password?"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isRecoveryMode
              ? "Create a new password for your account"
              : "Enter your email and we will send a reset link"}
          </p>
        </div>

        <Card className="glass-card gold-glow">
          <CardContent className="p-6 space-y-5">
            {isRecoveryMode ? (
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
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
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
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
                  Update Password
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRequestReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="you@example.com"
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
                    Check your inbox for the password reset link. It may take a minute to arrive.
                  </p>
                )}
                <Button className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Reset Link
                </Button>
              </form>
            )}

            <p className="text-center text-sm text-muted-foreground">
              Remember your password?{" "}
              <Link to="/login" className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
