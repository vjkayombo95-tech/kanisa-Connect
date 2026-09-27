import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, BadgeCheck, Check, CheckCircle2, Church, ImageIcon, LayoutDashboard, Loader2, Mail, MapPin, Menu, Palette, Phone, ShieldAlert, ShieldCheck, Sparkles, Upload, UserRound, Users, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const stepDefinitions = [
  { id: 1, titleKey: "auth.onboarding.steps.church.title", descriptionKey: "auth.onboarding.steps.church.description", icon: Church },
  { id: 2, titleKey: "auth.onboarding.steps.branding.title", descriptionKey: "auth.onboarding.steps.branding.description", icon: Palette },
  { id: 3, titleKey: "auth.onboarding.steps.leadership.title", descriptionKey: "auth.onboarding.steps.leadership.description", icon: Users },
  { id: 4, titleKey: "auth.onboarding.steps.review.title", descriptionKey: "auth.onboarding.steps.review.description", icon: ShieldCheck },
] as const;

type StepId = (typeof stepDefinitions)[number]["id"];

function InputWithIcon({ label, icon: Icon, className, ...props }: React.ComponentProps<typeof Input> & { label: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      <div className="group relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
        <Input {...props} className="h-12 rounded-xl border-border/70 bg-background/60 pl-10 shadow-sm transition-all duration-200 hover:border-primary/40 hover:bg-background/80 focus-visible:border-primary/60 focus-visible:ring-primary/30" />
      </div>
    </div>
  );
}

function UploadField({
  label,
  uploadLabel,
  preview,
  previewAlt,
  removeLabel,
  description,
  type,
  onClick,
  onClear,
}: {
  label: string;
  uploadLabel: string;
  preview: string | null;
  previewAlt: string;
  removeLabel: string;
  description: string;
  type: "logo" | "banner";
  onClick: () => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {preview ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card/70">
          <img src={preview} alt={previewAlt} className={cn("w-full", type === "logo" ? "h-40 object-contain bg-gradient-to-br from-secondary/40 to-background p-4" : "h-40 object-cover")} />
          <button type="button" onClick={onClear} className="absolute right-3 top-3 rounded-full border border-border/70 bg-background/80 p-2 text-muted-foreground transition-all hover:border-destructive/40 hover:text-destructive" aria-label={removeLabel}>
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      ) : (
        <button type="button" onClick={onClick} className="group flex h-40 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-gradient-to-br from-secondary/30 via-background to-secondary/20 px-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-[0_18px_40px_-30px_rgba(212,175,55,0.55)]">
          <div className="mb-3 rounded-2xl border border-primary/20 bg-primary/10 p-3 text-primary transition-transform duration-200 group-hover:scale-105">{type === "logo" ? <ImageIcon className="h-5 w-5" /> : <Upload className="h-5 w-5" />}</div>
          <p className="text-sm font-medium">{uploadLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </button>
      )}
    </div>
  );
}

export default function OnboardingPage() {
  const { t } = useTranslation();
  const [step, setStep] = useState<StepId>(1);
  const [mobileStepsOpen, setMobileStepsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, refreshUserData } = useAuth();
  const [churchName, setChurchName] = useState("");
  const [churchEmail, setChurchEmail] = useState("");
  const [churchPhone, setChurchPhone] = useState("");
  const [churchAddress, setChurchAddress] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [pastorName, setPastorName] = useState("");
  const [treasurerName, setTreasurerName] = useState("");
  const [secretaryName, setSecretaryName] = useState("");
  const adminAccountEmail = user?.email?.trim() || t("auth.onboarding.fields.signed_in_account");

  useEffect(() => () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
  }, [logoPreview, bannerPreview]);

  const steps = stepDefinitions.map((item) => ({
    ...item,
    title: t(item.titleKey),
    description: t(item.descriptionKey),
  }));
  const currentStep = steps.find((item) => item.id === step) ?? steps[0];
  const completedSteps = steps.filter((item) => item.id < step).length;
  const progressValue = ((step - 1) / (steps.length - 1)) * 100;

  const validateCurrentStep = (targetStep = step) => {
    if (targetStep === 1 && (!churchName.trim() || !churchEmail.trim())) {
      toast({ title: t("auth.onboarding.toasts.missing_details.title"), description: t("auth.onboarding.toasts.missing_details.description"), variant: "destructive" });
      return false;
    }
    return true;
  };

  const goToStep = (nextStep: StepId) => {
    if (nextStep > step && !validateCurrentStep()) return;
    setStep(nextStep);
    setMobileStepsOpen(false);
  };
  const goNext = () => {
    if (!validateCurrentStep()) return;
    if (step < steps.length) {
      setStep((prev) => (prev + 1) as StepId);
      setMobileStepsOpen(false);
    }
  };
  const goBack = () => {
    if (step > 1) {
      setStep((prev) => (prev - 1) as StepId);
      setMobileStepsOpen(false);
    }
  };

  const handleFileSelect = (file: File, type: "logo" | "banner") => {
    if (!ALLOWED_TYPES.includes(file.type)) return toast({ title: t("auth.onboarding.toasts.invalid_file_type.title"), description: t("auth.onboarding.toasts.invalid_file_type.description"), variant: "destructive" });
    if (file.size > MAX_FILE_SIZE) return toast({ title: t("auth.onboarding.toasts.file_too_large.title"), description: t("auth.onboarding.toasts.file_too_large.description"), variant: "destructive" });
    const url = URL.createObjectURL(file);
    if (type === "logo") {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      setLogoFile(file);
      setLogoPreview(url);
      return;
    }
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    setBannerFile(file);
    setBannerPreview(url);
  };

  const clearFile = (type: "logo" | "banner") => {
    if (type === "logo") {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      setLogoFile(null);
      setLogoPreview(null);
      if (logoInputRef.current) logoInputRef.current.value = "";
      return;
    }
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    setBannerFile(null);
    setBannerPreview(null);
    if (bannerInputRef.current) bannerInputRef.current.value = "";
  };

  const uploadFile = async (file: File, churchId: string, type: "logo" | "banner"): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${churchId}/${type}.${ext}`;
    const { error } = await supabase.storage.from("church-assets").upload(path, file, { upsert: true });
    if (error) throw error;
    return supabase.storage.from("church-assets").getPublicUrl(path).data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep(1)) return;
    if (!user) return toast({ title: t("auth.onboarding.toasts.not_authenticated.title"), description: t("auth.onboarding.toasts.not_authenticated.description"), variant: "destructive" });
    setSubmissionError(null);
    setSubmissionMessage(t("auth.onboarding.status.creating"));
    setIsLoading(true);
    try {
      const { data: createdChurch, error: churchError } = await supabase.rpc("create_church_workspace", {
        _name: churchName.trim(),
        _email: churchEmail.trim() || null,
        _phone: churchPhone.trim() || null,
        _address: churchAddress.trim() || null,
        _owner_name: user.user_metadata?.full_name || user.email || "Admin",
      });
      if (churchError) throw churchError;
      const church = createdChurch as { id: string; code: string; name: string } | null;
      if (!church?.id) throw new Error("workspace_missing");

      try {
        let logoUrl: string | null = null;
        let bannerUrl: string | null = null;
        if (logoFile) logoUrl = await uploadFile(logoFile, church.id, "logo");
        if (bannerFile) bannerUrl = await uploadFile(bannerFile, church.id, "banner");
        if (logoUrl || bannerUrl) {
          const { error: brandingError } = await supabase
            .from("churches")
            .update({ ...(logoUrl && { logo_url: logoUrl }), ...(bannerUrl && { banner_url: bannerUrl }) })
            .eq("id", church.id);
          if (brandingError) throw brandingError;
        }
      } catch (brandingError) {
        console.warn("Church created, but branding upload failed:", brandingError);
        toast({ title: t("auth.onboarding.toasts.created_without_images.title"), description: t("auth.onboarding.toasts.created_without_images.description") });
      }

      setSubmissionMessage(t("auth.onboarding.status.opening_dashboard"));
      toast({ title: t("auth.onboarding.toasts.created.title"), description: t("auth.onboarding.toasts.created.description", { name: church.name, code: church.code }) });
      void refreshUserData();
      navigate("/church-admin", { replace: true });
    } catch (err: any) {
      console.error("Onboarding error:", {
        code: err?.code,
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
      });
      const missingFunction = err?.code === "PGRST202" || `${err?.message || ""}`.includes("create_church_workspace");
      const description = missingFunction
        ? t("auth.onboarding.errors.setup_missing")
        : err?.message === "workspace_missing"
          ? t("auth.onboarding.errors.workspace_missing")
          : t("auth.onboarding.errors.fallback");
      setSubmissionMessage(null);
      setSubmissionError(description);
      toast({ title: t("auth.onboarding.toasts.create_failed.title"), description, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepContent = () => {
    if (step === 1) return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <InputWithIcon label={t("auth.onboarding.fields.church_name_required")} icon={Church} placeholder={t("auth.onboarding.placeholders.church_name")} value={churchName} onChange={(e) => setChurchName(e.target.value)} />
          <InputWithIcon label={t("auth.onboarding.fields.church_email_required")} icon={Mail} type="email" placeholder={t("auth.onboarding.placeholders.church_email")} value={churchEmail} onChange={(e) => setChurchEmail(e.target.value)} />
          <InputWithIcon label={t("auth.onboarding.fields.phone")} icon={Phone} placeholder={t("auth.onboarding.placeholders.phone")} value={churchPhone} onChange={(e) => setChurchPhone(e.target.value)} />
          <InputWithIcon label={t("auth.onboarding.fields.address")} icon={MapPin} placeholder={t("auth.onboarding.placeholders.address")} value={churchAddress} onChange={(e) => setChurchAddress(e.target.value)} />
        </div>
        <Card className="rounded-2xl border-primary/15 bg-primary/5"><CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start"><div className="rounded-2xl border border-primary/20 bg-primary/10 p-3 text-primary"><Sparkles className="h-5 w-5" /></div><div className="space-y-1"><p className="text-sm font-medium">{t("auth.onboarding.intro.title")}</p><p className="text-sm text-muted-foreground">{t("auth.onboarding.intro.description")}</p></div></CardContent></Card>
        <Card className="rounded-2xl border-border/70 bg-card/70"><CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><div className="rounded-2xl border border-primary/20 bg-primary/10 p-3 text-primary"><UserRound className="h-5 w-5" /></div><div className="space-y-1"><p className="text-sm font-medium">{t("auth.onboarding.admin_account.title")}</p><p className="text-sm text-muted-foreground">{t("auth.onboarding.admin_account.description")}</p></div></div><div className="rounded-xl border border-border/70 bg-background/60 px-4 py-2 text-sm font-medium">{adminAccountEmail}</div></CardContent></Card>
      </div>
    );

    if (step === 2) return (
      <div className="space-y-6">
        <div className="grid gap-5 lg:grid-cols-2">
          <div><input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0], "logo")} /><UploadField type="logo" label={t("auth.onboarding.upload.logo.label")} uploadLabel={t("auth.onboarding.upload.logo.upload")} preview={logoPreview} previewAlt={t("auth.onboarding.upload.logo.preview_alt")} removeLabel={t("auth.onboarding.upload.logo.remove")} description={t("auth.onboarding.upload.logo.description")} onClick={() => logoInputRef.current?.click()} onClear={() => clearFile("logo")} /></div>
          <div><input ref={bannerInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0], "banner")} /><UploadField type="banner" label={t("auth.onboarding.upload.banner.label")} uploadLabel={t("auth.onboarding.upload.banner.upload")} preview={bannerPreview} previewAlt={t("auth.onboarding.upload.banner.preview_alt")} removeLabel={t("auth.onboarding.upload.banner.remove")} description={t("auth.onboarding.upload.banner.description")} onClick={() => bannerInputRef.current?.click()} onClear={() => clearFile("banner")} /></div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">{[t("auth.onboarding.branding_points.dark_theme"), t("auth.onboarding.branding_points.gold_accent"), t("auth.onboarding.branding_points.responsive")].map((item) => <Card key={item} className="rounded-2xl border-border/70 bg-card/70"><CardContent className="flex items-center gap-3 p-4"><BadgeCheck className="h-4 w-4 text-primary" /><p className="text-sm text-muted-foreground">{item}</p></CardContent></Card>)}</div>
      </div>
    );

    if (step === 3) return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <InputWithIcon label={t("auth.onboarding.fields.pastor")} icon={UserRound} placeholder={t("auth.onboarding.placeholders.pastor")} value={pastorName} onChange={(e) => setPastorName(e.target.value)} />
          <InputWithIcon label={t("auth.onboarding.fields.treasurer")} icon={UserRound} placeholder={t("auth.onboarding.placeholders.treasurer")} value={treasurerName} onChange={(e) => setTreasurerName(e.target.value)} />
          <InputWithIcon label={t("auth.onboarding.fields.secretary")} icon={UserRound} placeholder={t("auth.onboarding.placeholders.secretary")} value={secretaryName} onChange={(e) => setSecretaryName(e.target.value)} />
        </div>
        <Card className="rounded-2xl border-border/70 bg-card/70"><CardContent className="grid gap-4 p-5 md:grid-cols-3">{[
          { title: t("auth.onboarding.leadership_cards.pastoral.title"), copy: t("auth.onboarding.leadership_cards.pastoral.copy") },
          { title: t("auth.onboarding.leadership_cards.financial.title"), copy: t("auth.onboarding.leadership_cards.financial.copy") },
          { title: t("auth.onboarding.leadership_cards.operations.title"), copy: t("auth.onboarding.leadership_cards.operations.copy") },
        ].map((item) => <div key={item.title} className="space-y-2"><p className="text-sm font-medium">{item.title}</p><p className="text-sm text-muted-foreground">{item.copy}</p></div>)}</CardContent></Card>
      </div>
    );

    return (
      <div className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="rounded-3xl border-border/70 bg-card/80"><CardHeader className="pb-4"><CardTitle className="flex items-center gap-3 text-lg font-semibold"><span className="rounded-2xl border border-primary/20 bg-primary/10 p-2 text-primary"><Church className="h-4 w-4" /></span>{t("auth.onboarding.review.church_information")}</CardTitle></CardHeader><CardContent className="space-y-3">{[
            { icon: Church, label: t("auth.onboarding.review.church_name"), value: churchName },
            { icon: Mail, label: t("auth.onboarding.review.church_email"), value: churchEmail },
            { icon: UserRound, label: t("auth.onboarding.review.admin_email"), value: adminAccountEmail },
            { icon: Phone, label: t("auth.onboarding.review.phone"), value: churchPhone },
            { icon: MapPin, label: t("auth.onboarding.review.address"), value: churchAddress },
          ].map((item) => <div key={item.label} className="flex items-start gap-3"><item.icon className="mt-0.5 h-4 w-4 text-primary" /><div><p className="text-sm font-medium">{item.value || t("auth.onboarding.review.not_provided")}</p><p className="text-sm text-muted-foreground">{item.label}</p></div></div>)}</CardContent></Card>
          <Card className="rounded-3xl border-border/70 bg-card/80"><CardHeader className="pb-4"><CardTitle className="flex items-center gap-3 text-lg font-semibold"><span className="rounded-2xl border border-primary/20 bg-primary/10 p-2 text-primary"><Palette className="h-4 w-4" /></span>{t("auth.onboarding.steps.branding.title")}</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-border/70 bg-background/40 p-4"><p className="text-sm font-medium">{t("auth.onboarding.upload.logo.label")}</p><p className="mt-1 text-sm text-muted-foreground">{logoFile ? logoFile.name : t("auth.onboarding.review.no_logo")}</p></div><div className="rounded-2xl border border-border/70 bg-background/40 p-4"><p className="text-sm font-medium">{t("auth.onboarding.upload.banner.label")}</p><p className="mt-1 text-sm text-muted-foreground">{bannerFile ? bannerFile.name : t("auth.onboarding.review.no_banner")}</p></div></div>{(logoPreview || bannerPreview) && <div className="grid gap-3 sm:grid-cols-2">{logoPreview && <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/50"><img src={logoPreview} alt={t("auth.onboarding.upload.logo.preview_alt")} className="h-28 w-full object-contain p-3" /></div>}{bannerPreview && <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/50"><img src={bannerPreview} alt={t("auth.onboarding.upload.banner.preview_alt")} className="h-28 w-full object-cover" /></div>}</div>}</CardContent></Card>
          <Card className="rounded-3xl border-border/70 bg-card/80 xl:col-span-2"><CardHeader className="pb-4"><CardTitle className="flex items-center gap-3 text-lg font-semibold"><span className="rounded-2xl border border-primary/20 bg-primary/10 p-2 text-primary"><Users className="h-4 w-4" /></span>{t("auth.onboarding.steps.leadership.title")}</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-3">{[
            { title: t("auth.onboarding.fields.pastor"), value: pastorName },
            { title: t("auth.onboarding.fields.treasurer"), value: treasurerName },
            { title: t("auth.onboarding.fields.secretary"), value: secretaryName },
          ].map((item) => <div key={item.title} className="rounded-2xl border border-border/70 bg-background/40 p-4"><p className="text-sm font-medium">{item.title}</p><p className="mt-1 text-sm text-muted-foreground">{item.value || t("auth.onboarding.review.not_assigned")}</p></div>)}</CardContent></Card>
        </div>
        <Card className="rounded-3xl border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-background"><CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between"><div className="space-y-1"><p className="text-sm font-semibold text-primary">{t("auth.onboarding.summary.title")}</p><p className="text-sm text-muted-foreground">{t("auth.onboarding.summary.description")}</p></div><div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-background/70 px-4 py-2 text-sm"><CheckCircle2 className="h-4 w-4 text-primary" />{t("auth.onboarding.summary.ready")}</div></CardContent></Card>
        {submissionError ? (
          <Alert variant="destructive" className="rounded-2xl">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>{submissionError}</AlertDescription>
          </Alert>
        ) : submissionMessage ? (
          <Alert className="rounded-2xl border-primary/25 bg-primary/5 text-foreground">
            <Loader2 className={cn("h-4 w-4 text-primary", isLoading && "animate-spin")} />
            <AlertDescription>{submissionMessage}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.18),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(212,175,55,0.1),_transparent_20%)] bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 lg:grid lg:grid-cols-[300px_minmax(0,1fr)]">
        <Collapsible open={mobileStepsOpen} onOpenChange={setMobileStepsOpen} className="lg:hidden">
          <Card className="overflow-hidden rounded-3xl border-primary/20 bg-card/80 shadow-[0_24px_80px_-50px_rgba(212,175,55,0.6)] backdrop-blur"><CardContent className="p-4"><div className="flex items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.24em] text-primary/80">{t("auth.onboarding.mobile.setup_flow")}</p><p className="mt-1 text-sm font-medium">{currentStep.title}</p></div><div className="flex items-center gap-2"><LanguageSwitcher /><CollapsibleTrigger asChild><Button variant="outline" size="sm" className="rounded-full border-primary/20 bg-background/50"><Menu className="h-4 w-4" />{t("auth.onboarding.mobile.steps_button")}</Button></CollapsibleTrigger></div></div><CollapsibleContent className="pt-4"><div className="space-y-2">{steps.map((item) => { const Icon = item.icon; const isActive = item.id === step; const isComplete = item.id < step; return <button key={item.id} type="button" onClick={() => goToStep(item.id)} className={cn("flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all duration-200", isActive ? "border-primary/40 bg-primary/10 text-foreground" : "border-border/60 bg-background/40 text-muted-foreground hover:border-primary/25 hover:bg-background/60")}><span className={cn("flex h-10 w-10 items-center justify-center rounded-2xl border", isComplete ? "border-primary/30 bg-primary text-primary-foreground" : isActive ? "border-primary/25 bg-primary/15 text-primary" : "border-border/60 bg-background/70")} >{isComplete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</span><div><p className="text-sm font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{item.description}</p></div></button>; })}</div></CollapsibleContent></CardContent></Card>
        </Collapsible>
        <aside className="hidden lg:block"><div className="sticky top-6"><Card className="overflow-hidden rounded-[32px] border-primary/20 bg-card/80 shadow-[0_30px_100px_-60px_rgba(212,175,55,0.65)] backdrop-blur"><CardHeader className="space-y-4 border-b border-border/60 pb-6"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="rounded-2xl bg-primary p-3 text-primary-foreground shadow-lg shadow-primary/20"><LayoutDashboard className="h-5 w-5" /></div><div><p className="text-xs uppercase tracking-[0.24em] text-primary/80">{t("auth.onboarding.sidebar.eyebrow")}</p><CardTitle className="mt-1 text-xl font-semibold">{t("auth.onboarding.sidebar.title")}</CardTitle></div></div><LanguageSwitcher className="rounded-2xl border border-border/60 bg-background/40 p-1" /></div><CardDescription className="text-sm leading-6">{t("auth.onboarding.sidebar.description")}</CardDescription></CardHeader><CardContent className="space-y-3 p-4">{steps.map((item) => { const Icon = item.icon; const isActive = item.id === step; const isComplete = item.id < step; return <motion.button key={item.id} type="button" layout onClick={() => goToStep(item.id)} className={cn("flex w-full items-start gap-4 rounded-3xl border px-4 py-4 text-left transition-all duration-300", isActive ? "border-primary/40 bg-primary/12 shadow-[0_20px_60px_-45px_rgba(212,175,55,0.8)]" : "border-border/60 bg-background/35 hover:border-primary/25 hover:bg-background/55")}><span className={cn("mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-colors", isComplete ? "border-primary/30 bg-primary text-primary-foreground" : isActive ? "border-primary/25 bg-primary/10 text-primary" : "border-border/60 bg-background/80 text-muted-foreground")}>{isComplete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</span><div className="min-w-0"><div className="flex items-center gap-2"><p className={cn("text-sm font-medium", isActive ? "text-foreground" : "text-foreground/90")}>{item.title}</p>{isComplete && <CheckCircle2 className="h-4 w-4 text-primary" />}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p></div></motion.button>; })}<Separator className="my-4 bg-border/60" /><div className="rounded-3xl border border-primary/15 bg-primary/6 p-4"><p className="text-xs uppercase tracking-[0.22em] text-primary/80">{t("auth.onboarding.progress.label")}</p><p className="mt-2 text-sm font-medium">{t("auth.onboarding.progress.completed", { count: completedSteps })}</p><p className="mt-1 text-sm text-muted-foreground">{t("auth.onboarding.progress.description")}</p></div></CardContent></Card></div></aside>
        <main><motion.div layout className="space-y-6"><Card className="overflow-hidden rounded-[32px] border-primary/20 bg-card/80 shadow-[0_32px_110px_-70px_rgba(212,175,55,0.7)] backdrop-blur"><CardHeader className="space-y-5 border-b border-border/60 pb-6"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div className="space-y-2"><p className="text-xs uppercase tracking-[0.26em] text-primary/80">{t("auth.onboarding.progress.step_of", { step, total: steps.length })}</p><CardTitle className="text-2xl font-semibold tracking-tight sm:text-3xl">{currentStep.title}</CardTitle><CardDescription className="max-w-2xl text-sm leading-6">{currentStep.description}</CardDescription></div><div className="flex flex-wrap items-center gap-2 self-start"><div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm text-primary"><Sparkles className="h-4 w-4" />{t("auth.onboarding.badge")}</div><LanguageSwitcher className="lg:hidden rounded-2xl border border-border/60 bg-background/40 p-1" /></div></div><div className="space-y-3"><div className="flex items-center justify-between gap-3 overflow-x-auto pb-1">{steps.map((item) => <div key={item.id} className={cn("min-w-fit text-xs font-medium transition-colors sm:text-sm", item.id === step ? "text-foreground" : item.id < step ? "text-primary" : "text-muted-foreground")}>{item.title}</div>)}</div><Progress value={progressValue} className="h-2 rounded-full bg-secondary/60 [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-[#f1d27a]" /></div></CardHeader><CardContent className="p-0"><div className="p-6 sm:p-8"><AnimatePresence mode="wait" initial={false}><motion.div key={step} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.24, ease: "easeOut" }} className="min-h-[420px]">{renderStepContent()}</motion.div></AnimatePresence></div><div className="sticky bottom-0 border-t border-border/60 bg-background/80 px-6 py-4 backdrop-blur-xl sm:px-8"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">{submissionError ? t("auth.onboarding.status.creation_failed") : submissionMessage || (step === 4 ? t("auth.onboarding.status.ready_for_launch") : t("auth.onboarding.status.progress_saved"))}</p><div className="flex items-center gap-3 self-end"><Button type="button" variant="outline" onClick={goBack} disabled={step === 1 || isLoading} className="rounded-xl border-border/70 bg-background/60 hover:border-primary/30 hover:bg-background"><ArrowLeft className="h-4 w-4" />{t("auth.onboarding.actions.back")}</Button>{step === 4 ? <Button type="button" onClick={() => void handleSubmit()} disabled={isLoading} className="rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90">{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{t("auth.onboarding.actions.create")}</Button> : <Button type="button" onClick={goNext} className="rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90">{t("auth.onboarding.actions.next")}<ArrowRight className="h-4 w-4" /></Button>}</div></div></div></CardContent></Card></motion.div></main>
      </div>
    </div>
  );
}
