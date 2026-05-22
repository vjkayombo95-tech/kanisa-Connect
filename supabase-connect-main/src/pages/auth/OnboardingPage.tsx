import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, BadgeCheck, Check, CheckCircle2, Church, ImageIcon, LayoutDashboard, Loader2, Mail, MapPin, Menu, Palette, Phone, ShieldCheck, Sparkles, Upload, UserRound, Users, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const steps = [
  { id: 1, title: "Church Information", description: "Core church details and workspace identity.", icon: Church },
  { id: 2, title: "Branding", description: "Upload premium visuals for your workspace.", icon: Palette },
  { id: 3, title: "Leadership Roles", description: "Add your leadership team for a polished setup.", icon: Users },
  { id: 4, title: "Review & Create", description: "Confirm everything before launching the workspace.", icon: ShieldCheck },
] as const;
type StepId = (typeof steps)[number]["id"];

function InputWithIcon({ label, icon: Icon, className, ...props }: React.ComponentProps<typeof Input> & { label: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      <div className="group relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
        <Input {...props} className={cn("h-12 rounded-xl border-border/70 bg-background/60 pl-10 shadow-sm transition-all duration-200 hover:border-primary/40 hover:bg-background/80 focus-visible:border-primary/60 focus-visible:ring-primary/30", props.className)} />
      </div>
    </div>
  );
}

function UploadField({ label, preview, description, onClick, onClear }: { label: string; preview: string | null; description: string; onClick: () => void; onClear: () => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {preview ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card/70">
          <img src={preview} alt={`${label} preview`} className={cn("w-full", label === "Logo" ? "h-40 object-contain bg-gradient-to-br from-secondary/40 to-background p-4" : "h-40 object-cover")} />
          <button type="button" onClick={onClear} className="absolute right-3 top-3 rounded-full border border-border/70 bg-background/80 p-2 text-muted-foreground transition-all hover:border-destructive/40 hover:text-destructive" aria-label={`Remove ${label}`}>
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      ) : (
        <button type="button" onClick={onClick} className="group flex h-40 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-gradient-to-br from-secondary/30 via-background to-secondary/20 px-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-[0_18px_40px_-30px_rgba(212,175,55,0.55)]">
          <div className="mb-3 rounded-2xl border border-primary/20 bg-primary/10 p-3 text-primary transition-transform duration-200 group-hover:scale-105">{label === "Logo" ? <ImageIcon className="h-5 w-5" /> : <Upload className="h-5 w-5" />}</div>
          <p className="text-sm font-medium">{`Upload ${label.toLowerCase()}`}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </button>
      )}
    </div>
  );
}

export default function OnboardingPage() {
  const [step, setStep] = useState<StepId>(1);
  const [mobileStepsOpen, setMobileStepsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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

  useEffect(() => () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
  }, [logoPreview, bannerPreview]);

  const currentStep = steps.find((item) => item.id === step) ?? steps[0];
  const completedSteps = steps.filter((item) => item.id < step).length;
  const progressValue = ((step - 1) / (steps.length - 1)) * 100;

  const validateCurrentStep = (targetStep = step) => {
    if (targetStep === 1 && (!churchName.trim() || !churchEmail.trim())) {
      toast({ title: "Finish church details", description: "Church name and email are required before continuing.", variant: "destructive" });
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
    if (!ALLOWED_TYPES.includes(file.type)) return toast({ title: "Invalid file type", description: "Please use JPG, PNG, or WebP.", variant: "destructive" });
    if (file.size > MAX_FILE_SIZE) return toast({ title: "File too large", description: "Maximum file size is 2MB.", variant: "destructive" });
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
    if (!user) return toast({ title: "Not authenticated", description: "Please sign in first.", variant: "destructive" });
    setIsLoading(true);
    try {
      const { data: church, error: churchError } = await supabase.from("churches").insert({ name: churchName, email: churchEmail, phone: churchPhone || null, address: churchAddress || null, created_by: user.id }).select().single();
      if (churchError) throw churchError;
      let logoUrl: string | null = null;
      let bannerUrl: string | null = null;
      if (logoFile) logoUrl = await uploadFile(logoFile, church.id, "logo");
      if (bannerFile) bannerUrl = await uploadFile(bannerFile, church.id, "banner");
      if (logoUrl || bannerUrl) await supabase.from("churches").update({ ...(logoUrl && { logo_url: logoUrl }), ...(bannerUrl && { banner_url: bannerUrl }) }).eq("id", church.id);
      const { error: roleError } = await supabase.from("user_roles").insert({ user_id: user.id, church_id: church.id, role: "church_admin" as const });
      if (roleError) throw roleError;
      const { error: memberError } = await supabase.from("members").insert({ church_id: church.id, user_id: user.id, full_name: user.user_metadata?.full_name || user.email || "Admin", email: user.email });
      if (memberError) throw memberError;
      await supabase.from("contribution_categories").insert([
        { church_id: church.id, name: "Tithe", description: "Regular tithe" },
        { church_id: church.id, name: "Offering", description: "General offering" },
        { church_id: church.id, name: "Building Fund", description: "Church building fund", is_special: true },
        { church_id: church.id, name: "Donations", description: "General donations" },
      ]);
      const { data: freePlan } = await supabase.from("subscription_plans").select("id").eq("name", "free").maybeSingle();
      if (freePlan) await supabase.from("church_subscriptions").insert({ church_id: church.id, plan_id: freePlan.id, status: "active" as const, current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() });
      toast({ title: "Church created!", description: `${churchName} (${church.code}) is ready.` });
      await refreshUserData();
      navigate("/church-admin");
    } catch (err: any) {
      console.error("Onboarding error:", err);
      toast({ title: "Error creating church", description: err.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepContent = () => {
    if (step === 1) return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <InputWithIcon label="Church Name *" icon={Church} placeholder="e.g. St. Mary's Parish" value={churchName} onChange={(e) => setChurchName(e.target.value)} />
          <InputWithIcon label="Church Email *" icon={Mail} type="email" placeholder="info@church.org" value={churchEmail} onChange={(e) => setChurchEmail(e.target.value)} />
          <InputWithIcon label="Phone" icon={Phone} placeholder="+255..." value={churchPhone} onChange={(e) => setChurchPhone(e.target.value)} />
          <InputWithIcon label="Address" icon={MapPin} placeholder="Church address" value={churchAddress} onChange={(e) => setChurchAddress(e.target.value)} />
        </div>
        <Card className="rounded-2xl border-primary/15 bg-primary/5"><CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start"><div className="rounded-2xl border border-primary/20 bg-primary/10 p-3 text-primary"><Sparkles className="h-5 w-5" /></div><div className="space-y-1"><p className="text-sm font-medium">Set the foundation for your church workspace</p><p className="text-sm text-muted-foreground">These details power your workspace identity, communication touchpoints, and admin setup.</p></div></CardContent></Card>
      </div>
    );

    if (step === 2) return (
      <div className="space-y-6">
        <div className="grid gap-5 lg:grid-cols-2">
          <div><input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0], "logo")} /><UploadField label="Logo" preview={logoPreview} description="Square mark, 2MB max, JPG PNG or WebP." onClick={() => logoInputRef.current?.click()} onClear={() => clearFile("logo")} /></div>
          <div><input ref={bannerInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0], "banner")} /><UploadField label="Banner" preview={bannerPreview} description="Wide hero image, 2MB max, JPG PNG or WebP." onClick={() => bannerInputRef.current?.click()} onClear={() => clearFile("banner")} /></div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">{["Dark theme ready", "Gold-accent presentation", "Looks polished on desktop and mobile"].map((item) => <Card key={item} className="rounded-2xl border-border/70 bg-card/70"><CardContent className="flex items-center gap-3 p-4"><BadgeCheck className="h-4 w-4 text-primary" /><p className="text-sm text-muted-foreground">{item}</p></CardContent></Card>)}</div>
      </div>
    );

    if (step === 3) return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <InputWithIcon label="Pastor" icon={UserRound} placeholder="Lead pastor name" value={pastorName} onChange={(e) => setPastorName(e.target.value)} />
          <InputWithIcon label="Treasurer" icon={UserRound} placeholder="Treasurer name" value={treasurerName} onChange={(e) => setTreasurerName(e.target.value)} />
          <InputWithIcon label="Secretary" icon={UserRound} placeholder="Secretary name" value={secretaryName} onChange={(e) => setSecretaryName(e.target.value)} />
        </div>
        <Card className="rounded-2xl border-border/70 bg-card/70"><CardContent className="grid gap-4 p-5 md:grid-cols-3">{[{ title: "Pastoral oversight", copy: "Clarify who leads ministry direction and member care." }, { title: "Financial confidence", copy: "Make stewardship roles visible from the first login." }, { title: "Operational alignment", copy: "Keep communication and approvals clearly assigned." }].map((item) => <div key={item.title} className="space-y-2"><p className="text-sm font-medium">{item.title}</p><p className="text-sm text-muted-foreground">{item.copy}</p></div>)}</CardContent></Card>
      </div>
    );

    return (
      <div className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="rounded-3xl border-border/70 bg-card/80"><CardHeader className="pb-4"><CardTitle className="flex items-center gap-3 text-lg font-semibold"><span className="rounded-2xl border border-primary/20 bg-primary/10 p-2 text-primary"><Church className="h-4 w-4" /></span>Church Information</CardTitle></CardHeader><CardContent className="space-y-3">{[{ icon: Church, label: "Church name", value: churchName }, { icon: Mail, label: "Church email", value: churchEmail }, { icon: Phone, label: "Phone number", value: churchPhone }, { icon: MapPin, label: "Address", value: churchAddress }].map((item) => <div key={item.label} className="flex items-start gap-3"><item.icon className="mt-0.5 h-4 w-4 text-primary" /><div><p className="text-sm font-medium">{item.value || "Not provided"}</p><p className="text-sm text-muted-foreground">{item.label}</p></div></div>)}</CardContent></Card>
          <Card className="rounded-3xl border-border/70 bg-card/80"><CardHeader className="pb-4"><CardTitle className="flex items-center gap-3 text-lg font-semibold"><span className="rounded-2xl border border-primary/20 bg-primary/10 p-2 text-primary"><Palette className="h-4 w-4" /></span>Branding</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-border/70 bg-background/40 p-4"><p className="text-sm font-medium">Logo</p><p className="mt-1 text-sm text-muted-foreground">{logoFile ? logoFile.name : "No logo uploaded"}</p></div><div className="rounded-2xl border border-border/70 bg-background/40 p-4"><p className="text-sm font-medium">Banner</p><p className="mt-1 text-sm text-muted-foreground">{bannerFile ? bannerFile.name : "No banner uploaded"}</p></div></div>{(logoPreview || bannerPreview) && <div className="grid gap-3 sm:grid-cols-2">{logoPreview && <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/50"><img src={logoPreview} alt="Logo preview" className="h-28 w-full object-contain p-3" /></div>}{bannerPreview && <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/50"><img src={bannerPreview} alt="Banner preview" className="h-28 w-full object-cover" /></div>}</div>}</CardContent></Card>
          <Card className="rounded-3xl border-border/70 bg-card/80 xl:col-span-2"><CardHeader className="pb-4"><CardTitle className="flex items-center gap-3 text-lg font-semibold"><span className="rounded-2xl border border-primary/20 bg-primary/10 p-2 text-primary"><Users className="h-4 w-4" /></span>Leadership Roles</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-3">{[{ title: "Pastor", value: pastorName }, { title: "Treasurer", value: treasurerName }, { title: "Secretary", value: secretaryName }].map((item) => <div key={item.title} className="rounded-2xl border border-border/70 bg-background/40 p-4"><p className="text-sm font-medium">{item.title}</p><p className="mt-1 text-sm text-muted-foreground">{item.value || "Not assigned during onboarding"}</p></div>)}</CardContent></Card>
        </div>
        <Card className="rounded-3xl border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-background"><CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between"><div className="space-y-1"><p className="text-sm font-semibold text-primary">Workspace creation summary</p><p className="text-sm text-muted-foreground">Your church will launch with a church admin role, default contribution categories, and a free plan setup.</p></div><div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-background/70 px-4 py-2 text-sm"><CheckCircle2 className="h-4 w-4 text-primary" />Ready to create</div></CardContent></Card>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.18),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(212,175,55,0.1),_transparent_20%)] bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 lg:grid lg:grid-cols-[300px_minmax(0,1fr)]">
        <Collapsible open={mobileStepsOpen} onOpenChange={setMobileStepsOpen} className="lg:hidden">
          <Card className="overflow-hidden rounded-3xl border-primary/20 bg-card/80 shadow-[0_24px_80px_-50px_rgba(212,175,55,0.6)] backdrop-blur"><CardContent className="p-4"><div className="flex items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.24em] text-primary/80">Setup flow</p><p className="mt-1 text-sm font-medium">{currentStep.title}</p></div><CollapsibleTrigger asChild><Button variant="outline" size="sm" className="rounded-full border-primary/20 bg-background/50"><Menu className="h-4 w-4" />Steps</Button></CollapsibleTrigger></div><CollapsibleContent className="pt-4"><div className="space-y-2">{steps.map((item) => { const Icon = item.icon; const isActive = item.id === step; const isComplete = item.id < step; return <button key={item.id} type="button" onClick={() => goToStep(item.id)} className={cn("flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all duration-200", isActive ? "border-primary/40 bg-primary/10 text-foreground" : "border-border/60 bg-background/40 text-muted-foreground hover:border-primary/25 hover:bg-background/60")}><span className={cn("flex h-10 w-10 items-center justify-center rounded-2xl border", isComplete ? "border-primary/30 bg-primary text-primary-foreground" : isActive ? "border-primary/25 bg-primary/15 text-primary" : "border-border/60 bg-background/70")} >{isComplete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</span><div><p className="text-sm font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{item.description}</p></div></button>; })}</div></CollapsibleContent></CardContent></Card>
        </Collapsible>
        <aside className="hidden lg:block"><div className="sticky top-6"><Card className="overflow-hidden rounded-[32px] border-primary/20 bg-card/80 shadow-[0_30px_100px_-60px_rgba(212,175,55,0.65)] backdrop-blur"><CardHeader className="space-y-4 border-b border-border/60 pb-6"><div className="flex items-center gap-3"><div className="rounded-2xl bg-primary p-3 text-primary-foreground shadow-lg shadow-primary/20"><LayoutDashboard className="h-5 w-5" /></div><div><p className="text-xs uppercase tracking-[0.24em] text-primary/80">Kanisa Connect Setup</p><CardTitle className="mt-1 text-xl font-semibold">Launch your church workspace</CardTitle></div></div><CardDescription className="text-sm leading-6">Complete a polished setup flow with branding, leadership details, and a final launch review.</CardDescription></CardHeader><CardContent className="space-y-3 p-4">{steps.map((item) => { const Icon = item.icon; const isActive = item.id === step; const isComplete = item.id < step; return <motion.button key={item.id} type="button" layout onClick={() => goToStep(item.id)} className={cn("flex w-full items-start gap-4 rounded-3xl border px-4 py-4 text-left transition-all duration-300", isActive ? "border-primary/40 bg-primary/12 shadow-[0_20px_60px_-45px_rgba(212,175,55,0.8)]" : "border-border/60 bg-background/35 hover:border-primary/25 hover:bg-background/55")}><span className={cn("mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-colors", isComplete ? "border-primary/30 bg-primary text-primary-foreground" : isActive ? "border-primary/25 bg-primary/10 text-primary" : "border-border/60 bg-background/80 text-muted-foreground")}>{isComplete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</span><div className="min-w-0"><div className="flex items-center gap-2"><p className={cn("text-sm font-medium", isActive ? "text-foreground" : "text-foreground/90")}>{item.title}</p>{isComplete && <CheckCircle2 className="h-4 w-4 text-primary" />}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p></div></motion.button>; })}<Separator className="my-4 bg-border/60" /><div className="rounded-3xl border border-primary/15 bg-primary/6 p-4"><p className="text-xs uppercase tracking-[0.22em] text-primary/80">Progress</p><p className="mt-2 text-sm font-medium">{completedSteps} of 3 setup stages completed</p><p className="mt-1 text-sm text-muted-foreground">One final step unlocks your full admin workspace.</p></div></CardContent></Card></div></aside>
        <main><motion.div layout className="space-y-6"><Card className="overflow-hidden rounded-[32px] border-primary/20 bg-card/80 shadow-[0_32px_110px_-70px_rgba(212,175,55,0.7)] backdrop-blur"><CardHeader className="space-y-5 border-b border-border/60 pb-6"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div className="space-y-2"><p className="text-xs uppercase tracking-[0.26em] text-primary/80">{`Step ${step} of ${steps.length}`}</p><CardTitle className="text-2xl font-semibold tracking-tight sm:text-3xl">{currentStep.title}</CardTitle><CardDescription className="max-w-2xl text-sm leading-6">{currentStep.description}</CardDescription></div><div className="inline-flex items-center gap-2 self-start rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm text-primary"><Sparkles className="h-4 w-4" />Premium onboarding</div></div><div className="space-y-3"><div className="flex items-center justify-between gap-3 overflow-x-auto pb-1">{steps.map((item) => <div key={item.id} className={cn("min-w-fit text-xs font-medium transition-colors sm:text-sm", item.id === step ? "text-foreground" : item.id < step ? "text-primary" : "text-muted-foreground")}>{item.title}</div>)}</div><Progress value={progressValue} className="h-2 rounded-full bg-secondary/60 [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-[#f1d27a]" /></div></CardHeader><CardContent className="p-0"><div className="p-6 sm:p-8"><AnimatePresence mode="wait" initial={false}><motion.div key={step} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.24, ease: "easeOut" }} className="min-h-[420px]">{renderStepContent()}</motion.div></AnimatePresence></div><div className="sticky bottom-0 border-t border-border/60 bg-background/80 px-6 py-4 backdrop-blur-xl sm:px-8"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">{step === 4 ? "Everything looks ready for launch." : "Your progress is saved in this session while you finish setup."}</p><div className="flex items-center gap-3 self-end"><Button variant="outline" onClick={goBack} disabled={step === 1 || isLoading} className="rounded-xl border-border/70 bg-background/60 hover:border-primary/30 hover:bg-background"><ArrowLeft className="h-4 w-4" />Back</Button>{step === 4 ? <Button onClick={handleSubmit} disabled={isLoading} className="rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90">{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Create Church</Button> : <Button onClick={goNext} className="rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90">Next<ArrowRight className="h-4 w-4" /></Button>}</div></div></div></CardContent></Card></motion.div></main>
      </div>
    </div>
  );
}
