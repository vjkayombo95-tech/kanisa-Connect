import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Church, Loader2, LogIn, ShieldAlert, UserPlus } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchPublicRegistrationChurch, isPublicRegistrationEnabled } from "@/lib/public-registration";

export default function JoinChurchPage() {
  const { churchCode = "" } = useParams<{ churchCode: string }>();
  const { user } = useAuth();

  const churchQuery = useQuery({
    queryKey: ["public-join-church", churchCode],
    queryFn: async () => {
      if (!churchCode.trim()) return null;
      return fetchPublicRegistrationChurch({ churchCode, churchId: null });
    },
    enabled: Boolean(churchCode),
  });

  if (churchQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background px-4">
        <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/90 px-5 py-4 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Preparing church onboarding...</span>
          </div>
        </div>
      </div>
    );
  }

  const church = churchQuery.data;
  const registrationEnabled = isPublicRegistrationEnabled(church?.metadata);

  if (!church) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--destructive)/0.08),_transparent_28%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted)/0.25))] px-4 py-10">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl items-center justify-center">
          <Card className="w-full max-w-lg border-destructive/20 bg-card/95 shadow-xl">
            <CardContent className="space-y-5 p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <ShieldAlert className="h-7 w-7" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-serif font-bold">Church Link Not Found</h1>
                <p className="text-sm text-muted-foreground">
                  This church onboarding link is invalid or no longer active.
                </p>
              </div>
              <Button asChild>
                <Link to="/">Return Home</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!registrationEnabled) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.14),_transparent_28%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted)/0.2))] px-4 py-10">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl items-center justify-center">
          <Card className="w-full max-w-xl border-border/60 bg-card/95 shadow-xl">
            <CardContent className="space-y-5 p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Church className="h-7 w-7" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-serif font-bold">{church.name}</h1>
                <p className="text-sm text-muted-foreground">
                  Public self-registration is currently hidden for this church. Please contact the church office for access.
                </p>
              </div>
              <Button asChild variant="outline">
                <Link to="/login">Sign In</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.14),_transparent_28%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted)/0.2))] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <Card className="w-full max-w-4xl overflow-hidden border-border/60 bg-card/95 shadow-2xl">
          <div className="grid lg:grid-cols-[1.05fr_1.2fr]">
            <div className="border-b border-border/60 bg-muted/30 p-8 lg:border-b-0 lg:border-r">
              <div className="space-y-6">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
                  <Church className="h-7 w-7" />
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium uppercase tracking-[0.24em] text-primary/80">Church Onboarding</p>
                  <h1 className="text-3xl font-bold font-serif leading-tight">
                    Join {church.name}
                  </h1>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Use this link to become a registered member of this church. Sign in if you already have an account, or create a new one and continue with your member profile.
                  </p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-background/80 p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Church Code</p>
                  <p className="mt-2 text-lg font-semibold">{church.code}</p>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Your church will already be prefilled when you continue to registration.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8">
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-serif font-bold">
                    {user ? "Continue your registration" : "Choose how to continue"}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {user
                      ? "You're already signed in. Continue to the member registration form for this church."
                      : "You can either sign in with an existing account or create a new account and complete your member registration."}
                  </p>
                </div>

                <div className="grid gap-4">
                  {user ? (
                    <Button asChild size="lg" className="justify-between">
                      <Link to={`/register/${church.code}`}>
                        Continue to member registration
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <>
                      <Button asChild size="lg" className="justify-between">
                        <Link to={`/register/${church.code}`}>
                          Create account and register
                          <UserPlus className="h-4 w-4" />
                        </Link>
                      </Button>

                      <Button asChild size="lg" variant="outline" className="justify-between">
                        <Link to={`/login?redirect=${encodeURIComponent(`/register/${church.code}`)}`}>
                          Sign in to continue
                          <LogIn className="h-4 w-4" />
                        </Link>
                      </Button>
                    </>
                  )}
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/20 p-5">
                  <p className="text-sm font-medium">What happens next?</p>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <p>1. Open the registration form with this church already selected.</p>
                    <p>2. Fill in your member details, Jumuiya, ministries, and photo.</p>
                    <p>3. Start using the member portal once your registration is complete.</p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  Looking for another church? <Link to="/" className="font-medium text-primary hover:underline">Return home</Link>
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
