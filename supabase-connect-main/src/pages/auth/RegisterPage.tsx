import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Camera, CheckCircle2, Church, Loader2, ShieldAlert, UserPlus, X } from "lucide-react";

import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import {
  fetchPublicJoinChurch,
  fetchPublicRegistrationChurch,
  fetchPublicRegistrationCommunities,
  fetchPublicRegistrationMinistries,
  isPublicRegistrationEnabled,
  removeRegistrationPhoto,
  uploadRegistrationPhoto,
  validateRegistrationPhoto,
  type PublicChurch,
} from "@/lib/public-registration";
import { clearOfflineDraft, readOfflineDraft, writeOfflineDraft } from "@/lib/offline-drafts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { assertPhoneIsAvailable, normalizeTanzanianPhone } from "@/lib/phone-auth";
import { logSupabaseError } from "@/lib/error-logger";
import { useTranslation } from "react-i18next";

type ChurchRow = PublicChurch;
type CommunityRow = Pick<Tables<"communities">, "id" | "name">;
type MinistryRow = Pick<Tables<"ministries">, "id" | "name">;
const SIGNUP_RATE_LIMIT_FALLBACK_SECONDS = 60;
const PENDING_REGISTRATION_REDIRECT_PREFIX = "pending-registration-redirect:";
const PENDING_REGISTRATION_AUTOCOMPLETE_PREFIX = "pending-registration-autocomplete:";

function getSignupCooldownKey(email: string) {
  return `public-register-signup-cooldown:${email.trim().toLowerCase()}`;
}

function readSignupCooldown(email: string) {
  if (typeof window === "undefined") return null;
  const key = getSignupCooldownKey(email);
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;

  const until = Number(raw);
  if (!Number.isFinite(until) || until <= Date.now()) {
    window.localStorage.removeItem(key);
    return null;
  }

  return until;
}

function storeSignupCooldown(email: string, until: number | null) {
  if (typeof window === "undefined") return;
  const key = getSignupCooldownKey(email);

  if (!until || until <= Date.now()) {
    window.localStorage.removeItem(key);
    return;
  }

  window.localStorage.setItem(key, String(until));
}

function getPendingRegistrationRedirectKey(email: string) {
  return `${PENDING_REGISTRATION_REDIRECT_PREFIX}${email.trim().toLowerCase()}`;
}

function storePendingRegistrationRedirect(email: string, redirectPath: string | null) {
  if (typeof window === "undefined") return;
  const key = getPendingRegistrationRedirectKey(email);

  if (!redirectPath) {
    window.localStorage.removeItem(key);
    return;
  }

  window.localStorage.setItem(key, redirectPath);
}

function getPendingRegistrationAutocompleteKey(email: string) {
  return `${PENDING_REGISTRATION_AUTOCOMPLETE_PREFIX}${email.trim().toLowerCase()}`;
}

function readPendingRegistrationAutocomplete(email: string) {
  if (typeof window === "undefined") return null;
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;
  return window.localStorage.getItem(getPendingRegistrationAutocompleteKey(normalizedEmail));
}

function storePendingRegistrationAutocomplete(email: string, redirectPath: string | null) {
  if (typeof window === "undefined") return;
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return;

  const key = getPendingRegistrationAutocompleteKey(normalizedEmail);
  if (!redirectPath) {
    window.localStorage.removeItem(key);
    return;
  }

  window.localStorage.setItem(key, redirectPath);
}

function parseSignupRateLimit(errorMessage: string) {
  const lowerMessage = errorMessage.toLowerCase();
  const cooldownMatch = errorMessage.match(/after\s+(\d+)\s+second/i);
  const parsedSeconds = cooldownMatch ? Number(cooldownMatch[1]) : 0;
  const isRateLimited =
    lowerMessage.includes("security purposes") ||
    lowerMessage.includes("too many requests") ||
    lowerMessage.includes("rate limit") ||
    lowerMessage.includes("email rate limit exceeded");

  if (!isRateLimited) {
    return { isRateLimited: false, cooldownSeconds: 0 };
  }

  return {
    isRateLimited: true,
    cooldownSeconds: parsedSeconds > 0 ? parsedSeconds : SIGNUP_RATE_LIMIT_FALLBACK_SECONDS,
  };
}

type AuthTranslator = (key: string, options?: Record<string, unknown>) => string;

function formatRegistrationError(error: unknown, t: AuthTranslator) {
  const rawMessage = error instanceof Error ? error.message : String(error ?? "");
  const lowerMessage = rawMessage.toLowerCase();
  const { isRateLimited, cooldownSeconds } = parseSignupRateLimit(rawMessage);

  if (lowerMessage.includes("offline")) {
    return t("auth.register.errors.offline");
  }

  if (lowerMessage.includes("already registered") || lowerMessage.includes("already exists")) {
    return t("auth.register.errors.already_registered");
  }

  if (lowerMessage.includes("already linked") || lowerMessage.includes("another church")) {
    return t("auth.register.errors.already_linked");
  }

  if (lowerMessage.includes("invalid login credentials")) {
    return t("auth.register.errors.invalid_login_credentials");
  }

  if (lowerMessage.includes("email not confirmed")) {
    return t("auth.register.errors.email_not_confirmed");
  }

  if (isRateLimited && cooldownSeconds > 0) {
    return t("auth.register.errors.rate_limited", { seconds: cooldownSeconds });
  }

  if (lowerMessage.includes("phone")) {
    return t("auth.register.errors.phone");
  }

  if (lowerMessage.includes("invalid church") || lowerMessage.includes("church not found")) {
    return t("auth.register.errors.invalid_church");
  }

  if (lowerMessage.includes("public registration")) {
    return t("auth.register.errors.public_registration_disabled");
  }

  return t("auth.register.errors.fallback", {
    defaultValue: "Registration could not be completed. Please try again or contact your church administrator.",
  });
}

export default function RegisterPage() {
  const { t } = useTranslation();
  const { churchCode = "", slug = "" } = useParams<{ churchCode: string; slug: string }>();
  const [searchParams] = useSearchParams();
  const churchIdParam = searchParams.get("churchId")?.trim() || "";
  const churchSlugParam = searchParams.get("churchSlug")?.trim() || slug.trim();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, churchId, refreshUserData } = useAuth();
  const { isOnline } = useNetworkStatus();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [selectedCommunityId, setSelectedCommunityId] = useState("");
  const [selectedMinistryIds, setSelectedMinistryIds] = useState<string[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [signupCooldownUntil, setSignupCooldownUntil] = useState<number | null>(null);
  const [hasAttemptedAutoComplete, setHasAttemptedAutoComplete] = useState(false);
  const normalizedEnteredEmail = (user?.email || email).trim().toLowerCase();
  const hasRegistrationTarget = Boolean(churchSlugParam || churchCode || churchIdParam);
  const registrationDraftKey = hasRegistrationTarget
    ? `offline-draft:register:${churchSlugParam || churchIdParam || churchCode || "church"}`
    : null;

  useEffect(() => {
    if (!registrationDraftKey) return;

    const draft = readOfflineDraft(registrationDraftKey, {
      fullName: "",
      email: "",
      phone: "",
      gender: "" as "male" | "female" | "",
      selectedCommunityId: "",
      selectedMinistryIds: [] as string[],
    });

    setFullName(draft.fullName || "");
    setEmail(draft.email || "");
    setPhone(draft.phone || "");
    setGender(draft.gender || "");
    setSelectedCommunityId(draft.selectedCommunityId || "");
    setSelectedMinistryIds(Array.isArray(draft.selectedMinistryIds) ? draft.selectedMinistryIds : []);
  }, [registrationDraftKey]);

  useEffect(() => {
    if (!registrationDraftKey) return;
    writeOfflineDraft(registrationDraftKey, {
      fullName,
      email,
      phone,
      gender,
      selectedCommunityId,
      selectedMinistryIds,
    });
  }, [registrationDraftKey, fullName, email, phone, gender, selectedCommunityId, selectedMinistryIds]);

  useEffect(() => {
    if (user || !normalizedEnteredEmail) {
      setSignupCooldownUntil(null);
      return;
    }

    setSignupCooldownUntil(readSignupCooldown(normalizedEnteredEmail));
  }, [normalizedEnteredEmail, user]);

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  const churchQuery = useQuery({
    queryKey: ["public-register-church", churchSlugParam, churchCode, churchIdParam],
    queryFn: async () => {
      if (churchSlugParam) {
        const churchBySlug = await fetchPublicJoinChurch(churchSlugParam) as ChurchRow | null;
        if (churchBySlug) return churchBySlug;
        if (slug.trim()) {
          return await fetchPublicRegistrationChurch({
            churchCode: slug.trim(),
            churchId: null,
          }) as ChurchRow | null;
        }
        return null;
      }
      const normalizedCode = churchCode.trim();
      if (!normalizedCode && !churchIdParam) return null;
      return await fetchPublicRegistrationChurch({
        churchCode: normalizedCode || null,
        churchId: churchIdParam || null,
      }) as ChurchRow | null;
    },
    enabled: hasRegistrationTarget,
  });

  const communitiesQuery = useQuery({
    queryKey: ["public-register-communities", churchQuery.data?.id],
    queryFn: async () => {
      return await fetchPublicRegistrationCommunities(churchQuery.data!.id) as CommunityRow[];
    },
    enabled: Boolean(churchQuery.data?.id),
  });

  const ministriesQuery = useQuery({
    queryKey: ["public-register-ministries", churchQuery.data?.id],
    queryFn: async () => {
      return await fetchPublicRegistrationMinistries(churchQuery.data!.id) as MinistryRow[];
    },
    enabled: Boolean(churchQuery.data?.id),
  });

  const registrationPath = churchQuery.data?.slug
    ? `/register?churchSlug=${encodeURIComponent(churchQuery.data.slug)}`
    : churchQuery.data?.code
    ? `/register/${churchQuery.data.code}`
    : churchQuery.data?.id
      ? `/register?churchId=${churchQuery.data.id}`
      : "/register";

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateRegistrationPhoto(file);
    if (!validation.valid) {
      toast({ title: t("auth.register.toasts.invalid_photo.title"), description: t("auth.register.toasts.invalid_photo.description"), variant: "destructive" });
      return;
    }

    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const toggleMinistry = (ministryId: string, checked: boolean) => {
    setSelectedMinistryIds((current) =>
      checked ? [...new Set([...current, ministryId])] : current.filter((id) => id !== ministryId),
    );
  };

  const registerMutation = useMutation({
    mutationFn: async () => {
      if (!isOnline) {
        throw new Error("offline registration draft saved");
      }

      const church = churchQuery.data;
      if (!church) throw new Error("Invalid church code.");
      const registrationEnabled = isPublicRegistrationEnabled(church.metadata);
      if (!registrationEnabled) throw new Error("Public registration is currently unavailable for this church.");

      if (user && churchId && churchId !== church.id) {
        throw new Error("This account is already linked to another church.");
      }

      const normalizedEmail = (user?.email || email).trim().toLowerCase();
      if (!normalizedEmail) throw new Error("Email is required.");
      const normalizedPhone = normalizeTanzanianPhone(phone);
      if (normalizedPhone.valid === false) throw new Error(normalizedPhone.error);
      await assertPhoneIsAvailable(normalizedPhone.e164, church.id);

      const persistedCooldown = !user ? readSignupCooldown(normalizedEmail) : null;
      if (persistedCooldown && persistedCooldown > Date.now()) {
        const waitSeconds = Math.max(1, Math.ceil((persistedCooldown - Date.now()) / 1000));
        throw new Error(`Email signup is temporarily rate-limited. Please wait ${waitSeconds} seconds before trying again.`);
      }

      let uploadedPhotoPath: string | null = null;

      try {
        let authUserId = user?.id ?? null;

        if (!user) {
          const { data: existingSignInData, error: existingSignInError } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });

          if (existingSignInData.user) {
            authUserId = existingSignInData.user.id;
          } else {
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email: normalizedEmail,
              password,
              options: {
                emailRedirectTo: `${window.location.origin}/login?redirect=${encodeURIComponent(registrationPath)}&email=${encodeURIComponent(normalizedEmail)}`,
                data: {
                  full_name: fullName.trim(),
                  church_code: church.code,
                  phone: normalizedPhone.e164,
                  phone_verified: false,
                },
              },
            });

            if (signUpError) {
              logSupabaseError(signUpError, {
                page: "Public Registration",
                component: "RegisterPage",
                function: "signUp",
                church_id: church.id,
                operation: "auth.signUp",
                metadata: { church_code: church.code },
              });
              throw signUpError;
            }

            authUserId = signUpData.user?.id ?? null;
            if (!authUserId) {
              throw new Error(t("auth.register.errors.account_create_failed"));
            }

            if (!signUpData.session) {
              storePendingRegistrationRedirect(normalizedEmail, registrationPath);
              storePendingRegistrationAutocomplete(normalizedEmail, registrationPath);
              return {
                pendingConfirmation: true,
                email: normalizedEmail,
                redirectPath: `/login?redirect=${encodeURIComponent(registrationPath)}&email=${encodeURIComponent(normalizedEmail)}`,
              };
            }
          }

          if (
            existingSignInError &&
            !existingSignInData.user &&
            !String(existingSignInError.message || "").toLowerCase().includes("invalid login credentials")
          ) {
            console.warn("Pre-signup sign-in check returned an unexpected error:", existingSignInError.message);
          }
        }

        let photoUrl: string | null = null;
        if (photoFile) {
          const uploadResult = await uploadRegistrationPhoto(photoFile);
          uploadedPhotoPath = uploadResult.storagePath;
          photoUrl = uploadResult.photoUrl;
        }

        const registrationCall = church.slug
          ? supabase.rpc("join_church_workspace", {
              _slug: church.slug,
              _full_name: fullName.trim(),
              _email: normalizedEmail,
              _phone: normalizedPhone.e164,
              _gender: gender || null,
              _photo_url: photoUrl,
              _community_id: selectedCommunityId || null,
              _ministry_ids: selectedMinistryIds,
            })
          : supabase.rpc("complete_public_registration" as never, {
              _church_id: church.id,
              _full_name: fullName.trim(),
              _email: normalizedEmail,
              _phone: normalizedPhone.e164,
              _gender: gender || null,
              _photo_url: photoUrl,
              _community_id: selectedCommunityId || null,
              _ministry_ids: selectedMinistryIds,
            } as never);
        const { data: registrationResult, error: registrationError } = await registrationCall;

        if (registrationError) {
          logSupabaseError(registrationError, {
            page: "Public Registration",
            component: "RegisterPage",
            function: "completeRegistration",
            church_id: church.id,
            operation: "rpc",
            rpc: church.slug ? "join_church_workspace" : "complete_public_registration",
            metadata: { church_code: church.code, has_photo: !!photoUrl },
          });
          throw registrationError;
        }

        const result = registrationResult as { success?: boolean; error?: string; church_name?: string } | null;
        if (!result?.success) {
          throw new Error(result?.error || "Registration could not be completed.");
        }

        if (user) {
          const { error: updateExistingUserError } = await supabase.auth.updateUser({
            data: {
              full_name: fullName.trim(),
              church_id: church.id,
              church_code: church.code,
            },
          });

          if (updateExistingUserError) {
            console.warn("Unable to update auth metadata after registration:", updateExistingUserError.message);
          }
        } else {
          const { error: updateUserError } = await supabase.auth.updateUser({
            data: {
              church_id: church.id,
            },
          });
          if (updateUserError) {
            console.warn("Unable to update auth metadata after registration:", updateUserError.message);
          }
        }

        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.warn("Unable to refresh session after public registration:", refreshError.message);
        }

        await refreshUserData();

        return {
          pendingConfirmation: false,
          churchName: result.church_name || church.name,
          email: normalizedEmail,
          authUserId,
        };
      } catch (error) {
        await removeRegistrationPhoto(uploadedPhotoPath);
        throw error;
      }
    },
    onSuccess: (result) => {
      if (result.pendingConfirmation) {
        toast({
          title: t("auth.register.toasts.confirm_email.title"),
          description: t("auth.register.toasts.confirm_email.description"),
        });
        navigate(result.redirectPath, { replace: true });
        return;
      }

      setSignupCooldownUntil(null);
      storeSignupCooldown(result.email, null);
      storePendingRegistrationRedirect(result.email, null);
      storePendingRegistrationAutocomplete(result.email, null);
      clearOfflineDraft(registrationDraftKey);
      toast({ title: t("auth.register.toasts.welcome.title"), description: t("auth.register.toasts.welcome.description", { church: result.churchName }) });
      navigate("/portal", { replace: true });
    },
    onError: (error: Error) => {
      const lowerMessage = error.message.toLowerCase();
      const { isRateLimited, cooldownSeconds } = parseSignupRateLimit(error.message);
      const normalizedEmail = (user?.email || email).trim().toLowerCase();

      if (!user && normalizedEmail && isRateLimited && cooldownSeconds > 0) {
        const until = Date.now() + cooldownSeconds * 1000;
        setSignupCooldownUntil(until);
        storeSignupCooldown(normalizedEmail, until);
      }

      toast({ title: t("auth.register.toasts.failed.title"), description: formatRegistrationError(error, t), variant: "destructive" });
    },
  });

  const isLoadingPage = churchQuery.isLoading || communitiesQuery.isLoading || ministriesQuery.isLoading;
  const pageError = churchQuery.error || communitiesQuery.error || ministriesQuery.error;
  const registrationEnabled = isPublicRegistrationEnabled(churchQuery.data?.metadata);
  const registrationErrorMessage = registerMutation.error ? formatRegistrationError(registerMutation.error, t) : null;
  const ministrySummary = useMemo(() => {
    if (selectedMinistryIds.length === 0) return t("auth.register.ministry_summary.none");
    if (selectedMinistryIds.length === 1) return t("auth.register.ministry_summary.one");
    return t("auth.register.ministry_summary.many", { count: selectedMinistryIds.length });
  }, [selectedMinistryIds.length, t]);

  const signupCooldownSeconds = useMemo(() => {
    if (!signupCooldownUntil) return 0;
    return Math.max(0, Math.ceil((signupCooldownUntil - Date.now()) / 1000));
  }, [signupCooldownUntil]);

  useEffect(() => {
    if (!signupCooldownUntil) return;

    if (signupCooldownUntil <= Date.now()) {
      setSignupCooldownUntil(null);
      return;
    }

    const timer = window.setInterval(() => {
      if (signupCooldownUntil <= Date.now()) {
        setSignupCooldownUntil(null);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [signupCooldownUntil]);

  useEffect(() => {
    if (hasAttemptedAutoComplete || registerMutation.isPending || !user || !churchQuery.data) {
      return;
    }

    const normalizedEmail = user.email?.trim().toLowerCase() || "";
    const pendingAutoCompletePath = readPendingRegistrationAutocomplete(normalizedEmail);

    if (!pendingAutoCompletePath || pendingAutoCompletePath !== registrationPath) {
      return;
    }

    const hasRequiredFields =
      fullName.trim() &&
      phone.trim() &&
      gender;

    if (!hasRequiredFields) {
      return;
    }

    setHasAttemptedAutoComplete(true);
    registerMutation.mutate();
  }, [
    churchQuery.data,
    fullName,
    gender,
    hasAttemptedAutoComplete,
    phone,
    registerMutation,
    registrationPath,
    user,
  ]);

  if (isLoadingPage) {
    return (
      <div className="min-h-screen bg-background px-4">
        <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/90 px-5 py-4 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">{t("auth.register.loading")}</span>
          </div>
        </div>
      </div>
    );
  }

  if (pageError || (hasRegistrationTarget && !churchQuery.data)) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--destructive)/0.08),_transparent_28%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted)/0.25))] px-4 py-10">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl items-center justify-center">
          <Card className="w-full max-w-lg border-destructive/20 bg-card/95 shadow-xl">
            <CardContent className="space-y-5 p-8 text-center">
              <div className="flex justify-center">
                <LanguageSwitcher />
              </div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <ShieldAlert className="h-7 w-7" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-serif font-bold">{t("auth.register.not_found_title")}</h1>
                <p className="text-sm text-muted-foreground">
                  {t("auth.register.not_found_description")}
                </p>
                {churchIdParam ? (
                  <p className="text-xs text-muted-foreground">{t("auth.register.requested_church_id", { value: churchIdParam })}</p>
                 ) : churchSlugParam ? (
                   <p className="text-xs text-muted-foreground">{t("auth.register.requested_church_link", { value: churchSlugParam })}</p>
                 ) : churchCode ? (
                  <p className="text-xs text-muted-foreground">{t("auth.register.requested_church_code", { value: churchCode })}</p>
                ) : null}
              </div>
              <Button asChild>
                <Link to="/">{t("shared.actions.return_home")}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!hasRegistrationTarget) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.14),_transparent_28%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted)/0.2))] px-4 py-10">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl items-center justify-center">
          <Card className="w-full max-w-lg border-border/60 bg-card/95 shadow-xl">
            <CardContent className="space-y-5 p-8 text-center">
              <div className="flex justify-center">
                <LanguageSwitcher />
              </div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Church className="h-7 w-7" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-serif font-bold">{t("auth.register.link_required_title")}</h1>
                <p className="text-sm text-muted-foreground">
                  {t("auth.register.link_required_description")}
                </p>
              </div>
              <Button asChild>
                <Link to="/">{t("shared.actions.return_home")}</Link>
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
              <div className="flex justify-center">
                <LanguageSwitcher />
              </div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Church className="h-7 w-7" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-serif font-bold">{churchQuery.data.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {t("auth.register.hidden_description")}
                </p>
              </div>
              <Button asChild variant="outline">
                <Link to={churchQuery.data.slug ? `/join/${churchQuery.data.slug}` : registrationPath}>{t("auth.register.back_to_onboarding")}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const alreadyInSameChurch = !!user && churchId === churchQuery.data.id;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.14),_transparent_28%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted)/0.2))] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
        <Card className="w-full max-w-4xl overflow-hidden border-border/60 bg-card/95 shadow-2xl">
          <div className="flex justify-end px-6 pt-6">
            <LanguageSwitcher />
          </div>
          <div className="grid lg:grid-cols-[1.05fr_1.35fr]">
            <div className="border-b border-border/60 bg-muted/30 p-8 lg:border-b-0 lg:border-r">
              <div className="space-y-6">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
                  <Church className="h-7 w-7" />
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium uppercase tracking-[0.24em] text-primary/80">{t("auth.register.eyebrow")}</p>
                  <h1 className="text-3xl font-bold font-serif leading-tight">
                    {t("auth.register.join_title", { church: churchQuery.data.name })}
                  </h1>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {user
                      ? t("auth.register.join_description_signed_in")
                      : t("auth.register.join_description")}
                  </p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-background/80 p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("auth.register.church_code")}</p>
                  <p className="mt-2 text-lg font-semibold">{churchQuery.data.code}</p>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {t("auth.register.church_code_hint")}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8">
              <CardHeader className="p-0 pb-6">
                <CardTitle className="text-2xl font-serif">{t("auth.register.profile_title")}</CardTitle>
                <CardDescription>
                  {user
                    ? t("auth.register.profile_description_signed_in")
                    : t("auth.register.profile_description")}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-0">
                {registrationErrorMessage ? (
                  <Alert variant="destructive" className="mb-6">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>{t("auth.register.alert_failed_title")}</AlertTitle>
                    <AlertDescription>{registrationErrorMessage}</AlertDescription>
                  </Alert>
                ) : null}
                {alreadyInSameChurch && (
                  <Alert className="mb-6 border-primary/30 bg-primary/5">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>{t("auth.register.already_connected_title")}</AlertTitle>
                    <AlertDescription>
                      {t("auth.register.already_connected_description", { church: churchQuery.data.name })}
                    </AlertDescription>
                  </Alert>
                )}
                <form
                  className="space-y-6"
                  autoComplete="off"
                  onSubmit={(event) => {
                    event.preventDefault();
                    registerMutation.mutate();
                  }}
                >
                  <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 sm:flex-row sm:items-center">
                    <div className="relative h-24 w-24 overflow-hidden rounded-2xl border border-border/70 bg-background">
                      {photoPreview ? (
                        <img src={photoPreview} alt={t("auth.register.photo_preview_alt")} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          <Camera className="h-8 w-8" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <Label htmlFor="photo-upload">{t("auth.fields.photo")}</Label>
                      <Input
                        id="photo-upload"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="mt-2"
                        onChange={handlePhotoChange}
                      />
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t("auth.register.photo_help")}
                      </p>
                    </div>

                    {photoPreview && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (photoPreview) URL.revokeObjectURL(photoPreview);
                          setPhotoFile(null);
                          setPhotoPreview(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="full_name">{t("auth.fields.full_name_required")}</Label>
                      <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("auth.placeholders.full_name")} required />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">{t("auth.fields.email_required")}</Label>
                      <Input
                        id="email"
                        type="email"
                        value={user?.email || email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t("auth.placeholders.email")}
                        autoComplete={user ? "email" : "off"}
                        required
                        disabled={!!user}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">{t("auth.fields.phone_required")}</Label>
                      <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("auth.placeholders.phone")} required />
                      <p className="text-xs text-muted-foreground">{t("auth.phone_hint")}</p>
                    </div>

                    {!user && (
                      <div className="space-y-2">
                        <Label htmlFor="password">{t("auth.fields.password_required")}</Label>
                        <Input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={t("auth.placeholders.create_password")}
                          autoComplete="new-password"
                          minLength={6}
                          required
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>{t("auth.fields.gender_required")}</Label>
                      <Select value={gender} onValueChange={(value: "male" | "female") => setGender(value)}>
                        <SelectTrigger>
                          <SelectValue placeholder={t("auth.register.select_gender")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">{t("auth.register.gender.male")}</SelectItem>
                          <SelectItem value="female">{t("auth.register.gender.female")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label>{t("auth.fields.jumuiya")}</Label>
                      <Select value={selectedCommunityId} onValueChange={setSelectedCommunityId}>
                        <SelectTrigger>
                          <SelectValue placeholder={t("auth.register.choose_jumuiya")} />
                        </SelectTrigger>
                        <SelectContent>
                          {communitiesQuery.data?.length ? (
                            communitiesQuery.data.map((community) => (
                              <SelectItem key={community.id} value={community.id}>
                                {community.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-jumuiya" disabled>{t("auth.register.no_jumuiya")}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Label className="text-base">{t("auth.fields.ministries")}</Label>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {t("auth.register.ministries_help")}
                        </p>
                      </div>
                      <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        {ministrySummary}
                      </span>
                    </div>

                    {ministriesQuery.data?.length ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {ministriesQuery.data.map((ministry) => {
                          const checked = selectedMinistryIds.includes(ministry.id);
                          return (
                            <label
                              key={ministry.id}
                              className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-background/90 p-3 transition-colors hover:border-primary/40"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(value) => toggleMinistry(ministry.id, value === true)}
                                className="mt-0.5"
                              />
                              <div className="space-y-1">
                                <p className="text-sm font-medium leading-none">{ministry.name}</p>
                                <p className="text-xs text-muted-foreground">{t("auth.register.include_ministry")}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t("auth.register.no_ministries")}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      {user
                        ? t("auth.register.signed_in_as", { email: user.email })
                        : <><span>{t("auth.register.already_registered")} </span><Link to={`/login?redirect=${encodeURIComponent(registrationPath)}`} className="font-medium text-primary hover:underline">{t("auth.login.sign_in_link")}</Link></>}
                    </p>
                    <Button
                      type="submit"
                      size="lg"
                      disabled={
                        registerMutation.isPending ||
                        alreadyInSameChurch ||
                        signupCooldownSeconds > 0 ||
                        !fullName.trim() ||
                        !(user?.email || email).trim() ||
                        !phone.trim() ||
                        (!user && !password.trim()) ||
                        !gender
                      }
                    >
                      {registerMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                      {signupCooldownSeconds > 0
                        ? t("auth.register.wait_seconds", { seconds: signupCooldownSeconds })
                        : user
                          ? t("auth.register.complete_button")
                          : t("auth.register.submit_button")}
                    </Button>
                  </div>
                  {!user && signupCooldownSeconds > 0 ? (
                    <p className="text-sm text-amber-500">
                      {t("auth.register.cooldown_message", { seconds: signupCooldownSeconds })}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {t("auth.register.offline_draft_note")}
                  </p>
                </form>
              </CardContent>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
