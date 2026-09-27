import { useMemo } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Church, CheckCircle2, Loader2, LogIn, UserPlus, XCircle } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getInviteChurch, type InviteRecord } from "@/lib/invite-flow";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

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

type InviteTranslator = (key: string, options?: Record<string, unknown>) => string;

function formatInviteAcceptError(t: InviteTranslator, error: Error) {
  const message = error.message.toLowerCase();

  if (message.includes("not found")) return t("auth.invite.errors.not_found");
  if (message.includes("invalid") || message.includes("expired")) return t("auth.invite.errors.invalid_or_expired");
  if (message.includes("logged in")) return t("auth.invite.errors.login_required");
  if (message.includes("please sign in as")) {
    const email = error.message.match(/Please sign in as (.+) to accept this invite\./)?.[1] ?? "";
    return t("auth.invite.errors.email_mismatch", { email });
  }
  if (message.includes("could not accept")) return t("auth.invite.errors.accept_failed");

  return t("auth.invite.toasts.accept_failed.description");
}

export default function InvitePage() {
  const { i18n, t } = useTranslation();
  const { token = "" } = useParams<{ token: string }>();
  const { user, isLoading: authLoading, refreshUserData } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectPath = useMemo(() => `${location.pathname}${location.search}`, [location.pathname, location.search]);

  const inviteQuery = useQuery({
    queryKey: ["invite-token", token],
    queryFn: async () => {
      if (!token) {
        return null;
      }

      const { data, error } = await supabase
        .from("invites" as never)
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (data) {
        return {
          ...(data as Omit<InviteRecord, "sourceTable">),
          sourceTable: "invites",
        } as InviteRecord;
      }

      if (error) {
        if (import.meta.env.DEV) {
          console.warn("Primary invite lookup failed", { message: error.message });
        }
      }

      const { data: fallbackRows, error: fallbackError } = await supabase
        .rpc("get_public_invitation", { _token: token });
      const fallbackData = fallbackRows?.[0] ?? null;

      if (fallbackData) {
        return {
          ...(fallbackData as Omit<InviteRecord, "sourceTable">),
          sourceTable: "invitations",
        } as InviteRecord;
      }

      if (fallbackError) {
        if (import.meta.env.DEV) {
          console.warn("Fallback invite lookup failed", { message: fallbackError.message });
        }
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

      const { data, error } = await supabase.rpc("accept_invitation", { _token: inviteQuery.data.token });
      if (error) throw error;

      const result = data as { success?: boolean; error?: string } | null;
      if (!result?.success) {
        throw new Error(result?.error || "Could not accept this invitation.");
      }

      await refreshUserData();
    },
    onSuccess: async () => {
      toast({ title: t("auth.invite.toasts.accepted.title"), description: t("auth.invite.toasts.accepted.description") });
      navigate("/portal", { replace: true });
    },
    onError: (error: Error) => {
      toast({ title: t("auth.invite.toasts.accept_failed.title"), description: formatInviteAcceptError(t, error), variant: "destructive" });
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

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-background px-4">
        <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/80 px-5 py-4 shadow-sm backdrop-blur">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">{t("auth.invite.loading")}</span>
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
            <div className="flex justify-center">
              <LanguageSwitcher />
            </div>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
              <Church className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-3xl font-serif">{t("auth.invite.page_title")}</CardTitle>
              <CardDescription>
                {t("auth.invite.page_description")}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {inviteInvalid && (
              <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
                <XCircle className="h-4 w-4" />
                <AlertTitle>{t("auth.invite.invalid_or_expired_title")}</AlertTitle>
                <AlertDescription>
                  {inviteAlreadyUsed && t("auth.invite.already_accepted_description")}
                  {inviteRevoked && t("auth.invite.revoked_description")}
                  {inviteExpired && !inviteAlreadyUsed && t("auth.invite.expired_description")}
                  {!inviteAlreadyUsed && !inviteRevoked && !inviteExpired && t("auth.invite.invalid_description")}
                </AlertDescription>
              </Alert>
            )}

            {!inviteInvalid && invite && (
              <>
                <div className="rounded-2xl border border-border/60 bg-muted/30 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">{t("auth.invite.fields.invited_email")}</p>
                      <p className="text-base font-medium text-foreground">{invite.email}</p>
                    </div>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                      {t("auth.invite.status.pending")}
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-muted-foreground">{t("auth.invite.fields.church")}</p>
                      <p className="font-medium text-foreground">{church?.name || t("auth.invite.default_church")}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t("auth.invite.fields.expires")}</p>
                      <p className="font-medium text-foreground">
                        {new Date(invite.expires_at).toLocaleString(i18n.language === "sw" ? "sw-TZ" : "en-TZ")}
                      </p>
                    </div>
                  </div>
                </div>

                {!user ? (
                  <div className="space-y-4 text-center">
                    <div className="space-y-1">
                      <h2 className="text-2xl font-semibold">{t("auth.invite.invited_heading")}</h2>
                      <p className="text-sm text-muted-foreground">
                        {t("auth.invite.redirect_description")}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button asChild size="lg" className="w-full">
                        <Link to={`/login?redirect=${encodeURIComponent(redirectPath)}&email=${encodeURIComponent(invite.email)}`}>
                          <LogIn className="mr-2 h-4 w-4" />
                          {t("auth.invite.login_button")}
                        </Link>
                      </Button>
                      <Button asChild size="lg" variant="outline" className="w-full">
                        <Link to={`/login?mode=signup&redirect=${encodeURIComponent(redirectPath)}&email=${encodeURIComponent(invite.email)}`}>
                          <UserPlus className="mr-2 h-4 w-4" />
                          {t("auth.invite.signup_button")}
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Alert className="border-border/60 bg-background">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <AlertTitle>{t("auth.invite.signed_in_title")}</AlertTitle>
                      <AlertDescription>
                        {t("auth.invite.signed_in_as")} <span className="font-medium text-foreground">{user.email}</span>.
                      </AlertDescription>
                    </Alert>

                    {user.email?.toLowerCase() !== invite.email.toLowerCase() && (
                      <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
                        <XCircle className="h-4 w-4" />
                        <AlertTitle>{t("auth.invite.email_mismatch_title")}</AlertTitle>
                        <AlertDescription>
                          {t("auth.invite.email_mismatch_description", { email: invite.email })}
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
                      {t("auth.invite.accept_button")}
                    </Button>
                  </div>
                )}
              </>
            )}

            <div className="text-center text-sm text-muted-foreground">
              {t("auth.invite.help")}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
