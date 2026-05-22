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

type InviteState = "loading" | "valid" | "invalid" | "expired" | "accepted" | "revoked" | "already_accepted";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AcceptInvitePage() {
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
      setChurchName((data as any).churches?.name || "Church");
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
  }, [token]);

  // Accept invitation as logged-in user
  const handleAccept = async () => {
    if (!user || !token) return;
    setAccepting(true);

    try {
      const { data, error } = await supabase.rpc("accept_invitation", { _token: token });

      if (error) throw error;

      const result = data as any;
      if (!result?.success) {
        toast({ title: "Could not accept", description: result?.error || "Unknown error", variant: "destructive" });
        setAccepting(false);
        return;
      }

      toast({ title: "Welcome!", description: `You've joined ${result.church_name} as ${result.role.replace("_", " ")}` });
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
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAccepting(false);
    }
  };

  // Sign up new user then accept
  const handleSignupAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim();

    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address", variant: "destructive" });
      return;
    }
    if (!fullName || !password) return;
    setSigningUp(true);

    try {
      console.log("EMAIL:", normalizedEmail);
      console.log("PASSWORD:", password);

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
          title: "Check your email",
          description: "Please confirm your email, then revisit this invitation link to join.",
        });
        setSigningUp(false);
        return;
      }

      // Auto-accept since we have a session
      const { data, error } = await supabase.rpc("accept_invitation", { _token: token });
      if (error) throw error;

      const result = data as any;
      if (result?.success) {
        toast({ title: "Welcome!", description: `You've joined ${result.church_name}` });
        setState("accepted");
        setTimeout(() => {
          const adminRoles = ["church_admin", "pastor", "secretary", "treasurer"];
          navigate(adminRoles.includes(result.role) ? "/church-admin" : "/portal");
        }, 1500);
      } else {
        toast({ title: "Account created", description: "Please log in and revisit this link to accept." });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
        toast({ title: "Welcome!", description: `You've joined ${result.church_name}` });
        setState("accepted");
        setTimeout(() => {
          const adminRoles = ["church_admin", "pastor", "secretary", "treasurer"];
          navigate(adminRoles.includes(result.role) ? "/church-admin" : "/portal");
        }, 1500);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
                <h2 className="text-xl font-bold font-serif mb-2">Invalid Invitation</h2>
                <p className="text-muted-foreground text-sm">This invitation link is not valid. Please contact your church administrator.</p>
                <Button className="mt-6" asChild><Link to="/login">Go to Login</Link></Button>
              </div>
            )}

            {/* EXPIRED */}
            {state === "expired" && (
              <div className="text-center py-6">
                <XCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-xl font-bold font-serif mb-2">Invitation Expired</h2>
                <p className="text-muted-foreground text-sm">This invitation has expired. Please ask your church administrator to send a new one.</p>
                <Button className="mt-6" asChild><Link to="/login">Go to Login</Link></Button>
              </div>
            )}

            {/* REVOKED */}
            {state === "revoked" && (
              <div className="text-center py-6">
                <XCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-xl font-bold font-serif mb-2">Invitation Revoked</h2>
                <p className="text-muted-foreground text-sm">This invitation has been revoked by the church administrator.</p>
                <Button className="mt-6" asChild><Link to="/login">Go to Login</Link></Button>
              </div>
            )}

            {/* ALREADY ACCEPTED */}
            {state === "already_accepted" && (
              <div className="text-center py-6">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-primary" />
                <h2 className="text-xl font-bold font-serif mb-2">Already Accepted</h2>
                <p className="text-muted-foreground text-sm">This invitation has already been accepted.</p>
                <Button className="mt-6" asChild><Link to="/login">Go to Dashboard</Link></Button>
              </div>
            )}

            {/* ACCEPTED (just now) */}
            {state === "accepted" && (
              <div className="text-center py-6">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-primary" />
                <h2 className="text-xl font-bold font-serif mb-2">Welcome!</h2>
                <p className="text-muted-foreground text-sm">You've joined {churchName}. Redirecting to your dashboard...</p>
                <Loader2 className="h-5 w-5 animate-spin mx-auto mt-4 text-primary" />
              </div>
            )}

            {/* VALID - show accept options */}
            {state === "valid" && invitation && (
              <>
                <div className="text-center">
                  <h2 className="text-xl font-bold font-serif mb-2">You're Invited!</h2>
                  <p className="text-muted-foreground text-sm">
                    You've been invited to join <span className="text-foreground font-medium">{churchName}</span>
                  </p>
                </div>

                <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Church</span>
                    <span className="font-medium">{churchName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Role</span>
                    <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
                      {invitation.role.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Email</span>
                    <span>{invitation.email}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Expires</span>
                    <span>{new Date(invitation.expires_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Already logged in */}
                {user ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground text-center">
                      Signed in as <span className="text-foreground">{user.email}</span>
                    </p>
                    <Button className="w-full" onClick={handleAccept} disabled={accepting}>
                      {accepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Accept Invitation
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Login option */}
                    {!showSignup && (
                      <>
                        {showLogin ? (
                          <form onSubmit={handleLoginAndAccept} className="space-y-3">
                            <p className="text-sm text-muted-foreground">Sign in to accept this invitation:</p>
                            <div className="space-y-2">
                              <Label>Email</Label>
                              <Input type="email" value={email} disabled className="bg-muted/50" />
                            </div>
                            <div className="space-y-2">
                              <Label>Password</Label>
                              <Input
                                type="password"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                placeholder="Your password"
                                required
                              />
                            </div>
                            <Button className="w-full" type="submit" disabled={loggingIn}>
                              {loggingIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Sign In & Accept
                            </Button>
                            <button
                              type="button"
                              onClick={() => { setShowLogin(false); setShowSignup(true); }}
                              className="text-sm text-primary hover:underline w-full text-center"
                            >
                              Don't have an account? Sign up
                            </button>
                          </form>
                        ) : (
                          <>
                            <Button className="w-full" onClick={() => setShowLogin(true)}>
                              <Mail className="mr-2 h-4 w-4" /> Sign In to Accept
                            </Button>
                            <button
                              type="button"
                              onClick={() => setShowSignup(true)}
                              className="text-sm text-primary hover:underline w-full text-center"
                            >
                              New here? Create an account
                            </button>
                          </>
                        )}
                      </>
                    )}

                    {/* Signup option */}
                    {showSignup && (
                      <form onSubmit={handleSignupAndAccept} className="space-y-3">
                        <p className="text-sm text-muted-foreground">Create your account to join:</p>
                        <div className="space-y-2">
                          <Label>Full Name</Label>
                          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" required />
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input type="email" value={email} disabled className="bg-muted/50" />
                        </div>
                        <div className="space-y-2">
                          <Label>Password</Label>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="Choose a password"
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
                          Create Account & Accept
                        </Button>
                        <button
                          type="button"
                          onClick={() => { setShowSignup(false); setShowLogin(true); }}
                          className="text-sm text-primary hover:underline w-full text-center"
                        >
                          Already have an account? Sign in
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
