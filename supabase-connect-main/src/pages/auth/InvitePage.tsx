import { useMemo } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Church, CheckCircle2, Loader2, LogIn, UserPlus, XCircle } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { acceptInviteForUser, getInviteChurch, type InviteRecord } from "@/lib/invite-flow";
import { supabase } from "@/integrations/supabase/client";

function isInviteValid(invite: InviteRecord | null | undefined) {
  if (!invite) return false;

  const status = invite.status ?? "pending";
  if (status === "expired") return false;

  if (invite.expires_at) {
    const expired = new Date(invite.expires_at) < new Date();
    if (expired) return false;
  }

  return true;
}

export default function InvitePage() {
  const { token = "" } = useParams<{ token: string }>();
  const { user, isLoading: authLoading, refreshUserData } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectPath = useMemo(() => `${location.pathname}${location.search}`, [location.pathname, location.search]);

  const inviteQuery = useQuery({
    queryKey: ["invite-token", token],
    queryFn: async () => {
      console.log("TOKEN:", token);

      if (!token) {
        console.log("PRIMARY INVITE:", null);
        console.log("FALLBACK INVITE:", null);
        return null;
      }

      const { data, error } = await supabase
        .from("invites" as never)
        .select("*")
        .eq("token", token)
        .maybeSingle();

      console.log("PRIMARY INVITE:", data);

      if (data) {
        return {
          ...(data as Omit<InviteRecord, "sourceTable">),
          sourceTable: "invites",
        } as InviteRecord;
      }

      if (error) {
        console.log("PRIMARY INVITE ERROR:", error);
      }

      const { data: fallbackData, error: fallbackError } = await supabase
        .from("invitations" as never)
        .select("*")
        .eq("token", token)
        .maybeSingle();

      console.log("FALLBACK INVITE:", fallbackData);

      if (fallbackData) {
        return {
          ...(fallbackData as Omit<InviteRecord, "sourceTable">),
          sourceTable: "invitations",
        } as InviteRecord;
      }

      if (fallbackError) {
        console.log("FALLBACK INVITE ERROR:", fallbackError);
      }

      return null;
    },
    enabled: Boolean(token),
  });

  const churchQuery = useQuery({
    queryKey: ["invite-church", inviteQuery.data?.church_id],
    queryFn: () => getInviteChurch(inviteQuery.data!.church_id),
    enabled: Boolean(inviteQuery.data?.church_id),
  });

  const acceptInviteMutation = useMutation({
    mutationFn: async () => {
      if (!inviteQuery.data) {
        throw new Error("Invite not found.");
      }

      if (!isInviteValid(inviteQuery.data)) {
        throw new Error("Invalid or expired invite.");
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      const currentUser = authData.user;
      if (!currentUser) throw new Error("You must be logged in to accept this invite.");

      if (!currentUser.email || currentUser.email.toLowerCase() !== inviteQuery.data.email.toLowerCase()) {
        throw new Error(`Please sign in as ${inviteQuery.data.email} to accept this invite.`);
      }

      await acceptInviteForUser(inviteQuery.data, currentUser.id);
      await refreshUserData();
    },
    onSuccess: async () => {
      toast({ title: "Invite accepted", description: "Your account is now linked to the church." });
      navigate("/portal", { replace: true });
    },
    onError: (error: Error) => {
      toast({ title: "Unable to accept invite", description: error.message, variant: "destructive" });
    },
  });

  const isInitialLoading = authLoading || inviteQuery.isLoading || churchQuery.isLoading;
  const invite = inviteQuery.data;
  const church = churchQuery.data;
  const status = invite?.status ?? "pending";
  const hasExpired = invite?.expires_at ? new Date(invite.expires_at) < new Date() : false;
  const inviteInvalid = !token || !isInviteValid(invite);
  const inviteAlreadyUsed = status === "accepted";
  const inviteRevoked = status === "revoked";
  const inviteExpired = status === "expired" || hasExpired;

  console.log("TOKEN:", token);
  console.log("FULL INVITE OBJECT:", invite);
  console.log("STATUS:", invite?.status);
  console.log("EXPIRES_AT:", invite?.expires_at);
  console.log("EMAIL:", invite?.email);
  console.log("IS NULL:", !invite);
  console.log("STATUS CHECK:", status === "pending");
  console.log("HAS EXPIRED:", hasExpired);

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-background px-4">
        <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/80 px-5 py-4 shadow-sm backdrop-blur">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Checking your invite...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.14),_transparent_32%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted)/0.35))] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <Card className="w-full max-w-xl border-border/60 bg-card/95 shadow-2xl backdrop-blur">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
              <Church className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-3xl font-serif">Church Invitation</CardTitle>
              <CardDescription>
                Join your church workspace on Kanisa Connect with a secure invite link.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {inviteInvalid && (
              <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Invalid or expired invite</AlertTitle>
                <AlertDescription>
                  {inviteAlreadyUsed && "This invite has already been used."}
                  {inviteRevoked && "This invite has been revoked by the church administrator."}
                  {inviteExpired && !inviteAlreadyUsed && "This invite has expired. Please ask for a new one."}
                  {!inviteAlreadyUsed && !inviteRevoked && !inviteExpired && "We couldn't validate this invite token."}
                </AlertDescription>
              </Alert>
            )}

            {!inviteInvalid && invite && (
              <>
                <div className="rounded-2xl border border-border/60 bg-muted/30 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Invited email</p>
                      <p className="text-base font-medium text-foreground">{invite.email}</p>
                    </div>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                      Pending
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-muted-foreground">Church</p>
                      <p className="font-medium text-foreground">{church?.name || "Church invitation"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Expires</p>
                      <p className="font-medium text-foreground">
                        {new Date(invite.expires_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {!user ? (
                  <div className="space-y-4 text-center">
                    <div className="space-y-1">
                      <h2 className="text-2xl font-semibold">You have been invited</h2>
                      <p className="text-sm text-muted-foreground">
                        Sign in or create your account, and we’ll bring you right back to this invite.
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button asChild size="lg" className="w-full">
                        <Link to={`/login?redirect=${encodeURIComponent(redirectPath)}&email=${encodeURIComponent(invite.email)}`}>
                          <LogIn className="mr-2 h-4 w-4" />
                          Login
                        </Link>
                      </Button>
                      <Button asChild size="lg" variant="outline" className="w-full">
                        <Link to={`/login?mode=signup&redirect=${encodeURIComponent(redirectPath)}&email=${encodeURIComponent(invite.email)}`}>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Sign Up
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Alert className="border-border/60 bg-background">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <AlertTitle>Signed in</AlertTitle>
                      <AlertDescription>
                        You are signed in as <span className="font-medium text-foreground">{user.email}</span>.
                      </AlertDescription>
                    </Alert>

                    {user.email?.toLowerCase() !== invite.email.toLowerCase() && (
                      <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
                        <XCircle className="h-4 w-4" />
                        <AlertTitle>Email mismatch</AlertTitle>
                        <AlertDescription>
                          This invite is for <span className="font-medium">{invite.email}</span>. Sign in with that email to continue.
                        </AlertDescription>
                      </Alert>
                    )}

                    <Button
                      size="lg"
                      className="w-full"
                      onClick={() => acceptInviteMutation.mutate()}
                      disabled={acceptInviteMutation.isPending || user.email?.toLowerCase() !== invite.email.toLowerCase()}
                    >
                      {acceptInviteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Accept Invite
                    </Button>
                  </div>
                )}
              </>
            )}

            <div className="text-center text-sm text-muted-foreground">
              Need help? Contact your church administrator for a fresh invite.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
