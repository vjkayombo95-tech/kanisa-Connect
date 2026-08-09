import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { THEME_PRESETS, checkContrastOnDark, useChurchTheme } from "@/contexts/ChurchThemeContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Palette, Church, Loader2, Image, Check, RotateCcw, Eye, CreditCard, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBillingAccess } from "@/hooks/use-billing-access";
import OptimizedImageUpload from "@/components/church-admin/OptimizedImageUpload";
import type { UploadResult } from "@/lib/file-upload";
import {
  birthdayBibleVerseOptions,
  fetchChurchMessageTemplate,
  getDefaultTemplate,
  renderChurchMessageTemplate,
  saveChurchMessageTemplate,
  weddingAnniversaryBibleVerseOptions,
  type ChurchMessageTemplate,
  type ChurchMessageTemplateType,
} from "@/lib/church-message-templates";

const templateTypeOptions: Array<{ value: ChurchMessageTemplateType; label: string }> = [
  { value: "birthday_wish", label: "Birthday wishes" },
  { value: "wedding_anniversary", label: "Wedding anniversary wishes" },
  { value: "service_recognition", label: "Service / volunteer recognition" },
  { value: "contribution_appreciation", label: "Contribution appreciation" },
];

export default function SettingsPage() {
  const { churchId } = useAuth();
  const { themeColor: activeThemeColor } = useChurchTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const billing = useBillingAccess();
  const [churchName, setChurchName] = useState("");
  const [churchCode, setChurchCode] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [themeColor, setThemeColor] = useState("#d4a017");
  const [customHex, setCustomHex] = useState("");
  const [customError, setCustomError] = useState("");
  const [previewColor, setPreviewColor] = useState<string | null>(null);
  const [templateType, setTemplateType] = useState<ChurchMessageTemplateType>("birthday_wish");
  const [messageTemplate, setMessageTemplate] = useState<ChurchMessageTemplate>(() => getDefaultTemplate("birthday_wish", null));

  const { data: church } = useQuery({
    queryKey: ["church-settings", churchId],
    queryFn: async () => {
      if (!churchId) return null;
      const { data } = await supabase.from("churches").select("*").eq("id", churchId).single();
      return data;
    },
    enabled: !!churchId,
  });
  const { data: memberCount = 0 } = useQuery({
    queryKey: ["settings-billing-member-count", churchId],
    queryFn: async () => {
      if (!churchId) return 0;
      const { count, error } = await supabase
        .from("members")
        .select("id", { count: "exact", head: true })
        .eq("church_id", churchId);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!churchId,
  });
  const { data: savedTemplate, isLoading: templateLoading } = useQuery({
    queryKey: ["church-message-template", churchId, templateType],
    queryFn: () => fetchChurchMessageTemplate(churchId, templateType),
    enabled: !!churchId,
  });

  useEffect(() => {
    if (church) {
      setChurchName(church.name || "");
      setChurchCode(church.code || "");
      setEmail(church.email || "");
      setPhone(church.phone || "");
      setAddress(church.address || "");
      setThemeColor(church.theme_color || "#d4a017");
    }
  }, [church]);

  useEffect(() => {
    setMessageTemplate(savedTemplate ?? getDefaultTemplate(templateType, churchId ?? null));
  }, [churchId, savedTemplate, templateType]);

  const saveGeneral = useMutation({
    mutationFn: async () => {
      if (!churchId) throw new Error("No church");
      const { error } = await supabase.from("churches").update({
        name: churchName, email, phone: phone || null, address: address || null,
      }).eq("id", churchId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["church-settings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-church"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-church"] });
      toast({ title: "Settings saved" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const saveTheme = useMutation({
    mutationFn: async () => {
      if (!churchId) throw new Error("No church");
      const { error } = await supabase.from("churches").update({ theme_color: themeColor }).eq("id", churchId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["church-settings"] });
      queryClient.invalidateQueries({ queryKey: ["church-theme"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-church"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-church"] });
      setPreviewColor(null);
      toast({ title: "Theme applied", description: "All users in your church will see this theme." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const saveMessageTemplate = useMutation({
    mutationFn: async () => {
      await saveChurchMessageTemplate({ ...messageTemplate, church_id: churchId ?? null, template_type: templateType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["church-message-template", churchId, templateType] });
      toast({ title: "Message template saved" });
    },
    onError: (err: any) => toast({ title: "Unable to save template", description: err.message, variant: "destructive" }),
  });

  const handlePresetSelect = (hex: string) => {
    setThemeColor(hex);
    setPreviewColor(hex);
    setCustomHex("");
    setCustomError("");
  };

  const handleCustomHexChange = (value: string) => {
    setCustomHex(value);
    setCustomError("");
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
      const contrast = checkContrastOnDark(value);
      if (!contrast.passes) {
        setCustomError(`Poor contrast (${contrast.ratio.toFixed(1)}:1). Choose a brighter color for readability.`);
        return;
      }
      setThemeColor(value);
      setPreviewColor(value);
    }
  };

  const resetToDefault = () => {
    setThemeColor("#d4a017");
    setPreviewColor("#d4a017");
    setCustomHex("");
    setCustomError("");
  };

  const resetMessageTemplate = () => {
    setMessageTemplate(getDefaultTemplate(templateType, churchId ?? null));
  };

  const handleLogoUploaded = async (result: UploadResult) => {
    if (!churchId) return;
    const { error } = await supabase
      .from("churches")
      .update({ logo_url: result.publicUrl })
      .eq("id", churchId);
    if (error) {
      toast({ title: "Logo upload saved to storage but not church profile", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["church-settings"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-church"] });
    queryClient.invalidateQueries({ queryKey: ["sidebar-church"] });
    toast({ title: "Logo uploaded successfully" });
  };

  const handleBannerUploaded = async (result: UploadResult) => {
    if (!churchId) return;
    const { error } = await supabase
      .from("churches")
      .update({ banner_url: result.publicUrl })
      .eq("id", churchId);
    if (error) {
      toast({ title: "Banner upload saved to storage but not church profile", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["church-settings"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-church"] });
    queryClient.invalidateQueries({ queryKey: ["sidebar-church"] });
    toast({ title: "Banner uploaded successfully" });
  };

  const removeImage = async (type: "logo" | "banner") => {
    if (!churchId) return;
    const updateField = type === "logo" ? { logo_url: null } : { banner_url: null };
    const { error } = await supabase.from("churches").update(updateField).eq("id", churchId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    queryClient.invalidateQueries({ queryKey: ["church-settings"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-church"] });
    queryClient.invalidateQueries({ queryKey: ["sidebar-church"] });
    toast({ title: `${type === "logo" ? "Logo" : "Banner"} removed` });
  };

  const isChanged = themeColor !== activeThemeColor;
  const selectedPreset = THEME_PRESETS.find(p => p.hex.toLowerCase() === themeColor.toLowerCase());
  const bibleVerseOptions =
    templateType === "wedding_anniversary" ? weddingAnniversaryBibleVerseOptions : birthdayBibleVerseOptions;
  const renderedTemplatePreview = renderChurchMessageTemplate(messageTemplate, {
    church_name: churchName || church?.name,
    member_name: "Tino Chrisostom",
    spouse_name: "mwenza wako",
    date: new Date().toLocaleDateString("en-TZ"),
    community_name: "Mt. Rita",
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-serif">Church Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure your church profile, branding, and appearance</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="bg-secondary">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="theme">
            <Palette className="mr-1.5 h-3.5 w-3.5" /> Theme Center
          </TabsTrigger>
          <TabsTrigger value="billing">
            <CreditCard className="mr-1.5 h-3.5 w-3.5" /> Billing / Plan
          </TabsTrigger>
          <TabsTrigger value="messages">
            <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Messages
          </TabsTrigger>
        </TabsList>

        {/* === General Tab === */}
        <TabsContent value="general" className="mt-4 space-y-4">
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-base font-sans flex items-center gap-2"><Church className="h-4 w-4 text-primary" /> Church Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Church Name</Label><Input value={churchName} onChange={(e) => setChurchName(e.target.value)} /></div>
                <div className="space-y-2"><Label>Church Code</Label><Input disabled value={churchCode} className="bg-muted/50" /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
                <div className="space-y-2 md:col-span-2"><Label>Address</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
              </div>
              <Button onClick={() => saveGeneral.mutate()} disabled={saveGeneral.isPending}>
                {saveGeneral.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="mt-4 space-y-4">
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-base font-sans flex items-center gap-2"><Image className="h-4 w-4 text-primary" /> Church Logo</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Upload your church logo. Images are auto-optimized for web.</p>
              {churchId && (
                <OptimizedImageUpload
                  profile="logo"
                  churchId={churchId}
                  currentUrl={church?.logo_url}
                  onUploadComplete={handleLogoUploaded}
                  onRemove={() => removeImage("logo")}
                />
              )}
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-base font-sans flex items-center gap-2"><Image className="h-4 w-4 text-primary" /> Church Banner</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Upload a banner image. Large images are automatically resized and compressed.</p>
              {churchId && (
                <OptimizedImageUpload
                  profile="banner"
                  churchId={churchId}
                  currentUrl={church?.banner_url}
                  onUploadComplete={handleBannerUploaded}
                  onRemove={() => removeImage("banner")}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="mt-4 space-y-4">
          <Card className="glass-card border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-sans">
                <CreditCard className="h-4 w-4 text-primary" /> Current Billing Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-2xl font-bold font-serif">
                  {billing.isLoading ? "Loading..." : `${billing.currentPlanDefinition.name} Plan`}
                </p>
                {!billing.isLoading && (
                  <Badge variant="outline" className="capitalize text-primary border-primary/30">
                    {billing.currentStatus}
                  </Badge>
                )}
              </div>
              {billing.isTrial && billing.subscription.expires_at && (
                <p className="text-sm text-muted-foreground">
                  Trial expires on {new Date(billing.subscription.expires_at).toLocaleDateString()} ({billing.trialDaysRemaining} day(s) remaining).
                </p>
              )}
              <div className="rounded-xl border border-border bg-secondary/25 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Member usage</span>
                  <span className="font-medium">
                    {billing.memberLimit === null ? `${memberCount} / Unlimited` : `${memberCount} / ${billing.memberLimit}`}
                  </span>
                </div>
                {billing.memberLimit !== null && (
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min((memberCount / billing.memberLimit) * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>
              <Button asChild>
                <Link to="/church-admin/settings/billing">Open Billing & Plan Management</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="mt-4 space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base font-sans flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" /> Personal Message Templates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Template type</Label>
                  <select
                    value={templateType}
                    onChange={(event) => setTemplateType(event.target.value as ChurchMessageTemplateType)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {templateTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Default Bible verse</Label>
                  <select
                    value={messageTemplate.default_bible_verse ?? ""}
                    onChange={(event) =>
                      setMessageTemplate((current) => ({ ...current, default_bible_verse: event.target.value || null }))
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">No verse</option>
                    {bibleVerseOptions.map((option) => (
                      <option key={option.reference} value={option.reference}>{option.reference}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={messageTemplate.title}
                  onChange={(event) => setMessageTemplate((current) => ({ ...current, title: event.target.value }))}
                  disabled={templateLoading}
                />
              </div>

              <div className="space-y-2">
                <Label>Template body</Label>
                <Textarea
                  rows={10}
                  value={messageTemplate.body}
                  onChange={(event) => setMessageTemplate((current) => ({ ...current, body: event.target.value }))}
                  disabled={templateLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Placeholders: {"{church_name}"}, {"{member_name}"}, {"{first_name}"}, {"{date}"}, {"{bible_verse}"}, {"{community_name}"}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-secondary/25 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</p>
                <p className="whitespace-pre-wrap text-sm leading-6">{renderedTemplatePreview}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => saveMessageTemplate.mutate()} disabled={saveMessageTemplate.isPending || templateLoading}>
                  {saveMessageTemplate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Template
                </Button>
                <Button variant="outline" onClick={resetMessageTemplate}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Reset to Default
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === Theme Center Tab === */}
        <TabsContent value="theme" className="mt-4 space-y-4">
          {/* Current theme indicator */}
          <Card className="glass-card border-primary/30">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full border-2 border-border shrink-0" style={{ backgroundColor: activeThemeColor }} />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  Current Theme: {THEME_PRESETS.find(p => p.hex.toLowerCase() === activeThemeColor.toLowerCase())?.name || "Custom"}
                </p>
                <p className="text-xs text-muted-foreground">Applied church-wide to all dashboards and portals</p>
              </div>
              {isChanged && (
                <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                  <Eye className="mr-1 h-3 w-3" /> Previewing
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Preset themes */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base font-sans flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" /> Theme Presets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Choose a curated theme for your church. All users will see this branding.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {THEME_PRESETS.map((preset) => {
                  const isSelected = themeColor.toLowerCase() === preset.hex.toLowerCase();
                  const isActive = activeThemeColor.toLowerCase() === preset.hex.toLowerCase();
                  return (
                    <button
                      key={preset.hex}
                      onClick={() => handlePresetSelect(preset.hex)}
                      className={`relative flex flex-col items-center gap-2.5 p-4 rounded-xl border transition-all ${
                        isSelected
                          ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                          : "border-border hover:border-primary/40 hover:bg-secondary/50"
                      }`}
                    >
                      {isActive && (
                        <div className="absolute top-2 right-2">
                          <Check className="h-3.5 w-3.5 text-primary" />
                        </div>
                      )}
                      <div className="h-12 w-12 rounded-full border-2 border-border shadow-lg" style={{ backgroundColor: preset.hex }} />
                      <span className="text-xs font-medium text-muted-foreground">{preset.name}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Custom hex */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base font-sans">Custom Color (Advanced)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">Enter a hex color code. Must have sufficient contrast on dark backgrounds.</p>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Input
                    placeholder="#1e90ff"
                    value={customHex}
                    onChange={(e) => handleCustomHexChange(e.target.value)}
                    className="w-40 pl-10"
                    maxLength={7}
                  />
                  <div
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded border border-border"
                    style={{ backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(customHex) ? customHex : "transparent" }}
                  />
                </div>
                {customHex && /^#[0-9A-Fa-f]{6}$/.test(customHex) && !customError && (
                  <Badge className="bg-green-500/10 text-green-400 border-green-500/30">
                    <Check className="mr-1 h-3 w-3" /> Good contrast
                  </Badge>
                )}
              </div>
              {customError && (
                <p className="text-xs text-destructive mt-2">{customError}</p>
              )}
            </CardContent>
          </Card>

          {/* Live preview */}
          {previewColor && isChanged && (
            <Card className="glass-card border-dashed">
              <CardHeader>
                <CardTitle className="text-base font-sans flex items-center gap-2">
                  <Eye className="h-4 w-4" /> Live Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm" style={{ backgroundColor: previewColor, color: "#0d0f14" }}>
                    Primary Button
                  </Button>
                  <Badge style={{ backgroundColor: previewColor + "20", color: previewColor, borderColor: previewColor + "40" }} className="border">
                    Badge
                  </Badge>
                  <div className="h-2 w-24 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full w-3/4 rounded-full" style={{ backgroundColor: previewColor }} />
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: previewColor }} />
                    <span className="text-xs" style={{ color: previewColor }}>Active item</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button onClick={() => saveTheme.mutate()} disabled={saveTheme.isPending || !isChanged}>
              {saveTheme.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Check className="mr-2 h-4 w-4" /> Apply Theme
            </Button>
            <Button variant="outline" onClick={resetToDefault} disabled={themeColor === "#d4a017"}>
              <RotateCcw className="mr-2 h-4 w-4" /> Reset to Default
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
