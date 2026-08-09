import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { Eye, EyeOff, Lock, Unlock, Globe, Building2, Loader2, RotateCcw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Feature = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  globally_enabled: boolean;
  globally_locked: boolean;
  is_mandatory: boolean;
};

type ChurchFeature = {
  id: string;
  church_id: string;
  feature_id: string;
  enabled: boolean;
  locked?: boolean | null;
};

type LocalGlobal = { enabled: boolean; locked: boolean };
type LocalChurch = { enabled: boolean; locked: boolean };

async function setAuthoritativeLivestreamFeature(
  churchId: string,
  enabled: boolean,
  locked: boolean,
) {
  const { error } = await supabase.rpc("set_super_admin_church_feature", {
    _church_id: churchId,
    _feature_key: "livestream",
    _enabled: enabled,
    _locked: locked,
  });
  if (error) throw error;
}

const DEFAULT_FEATURES = [
  { key: "members", name: "Members", description: "Member directory and member administration." },
  { key: "contributions", name: "Contributions", description: "Contribution records, receipts, and giving administration." },
  { key: "give", name: "Giving", description: "Member giving and payment entry points." },
  { key: "pledges", name: "Pledges", description: "Pledge creation, tracking, and fulfilment." },
  { key: "communities", name: "Communities", description: "Small Christian communities and groups." },
  { key: "ministries", name: "Ministries", description: "Ministry teams, requests, and leadership." },
  { key: "families", name: "Families", description: "Family grouping and household records." },
  { key: "events", name: "Events & Calendar", description: "Parish events, calendar, and Mass schedule surfaces." },
  { key: "event_requests", name: "Event Requests", description: "Member event request submission and review." },
  { key: "announcements", name: "Announcements", description: "Parish announcement publishing and viewing." },
  { key: "sermons", name: "Sermons", description: "Sermon and homily content." },
  { key: "bible_verses", name: "Bible", description: "Bible reading and scripture surfaces." },
  { key: "bible_audio", name: "Bible Audio", description: "AI-assisted Bible chapter narration, cache, and member playback controls.", globallyEnabled: false },
  { key: "operations", name: "Operations", description: "Parish operations health, queue telemetry, worker signals, and production events." },
  { key: "audio_processing", name: "Audio Processing", description: "Audio upload, processing jobs, review workflow, and audio publishing operations." },
  { key: "prayer_requests", name: "Prayer Requests", description: "Prayer request submission, review, and tracking." },
  { key: "mass_intentions", name: "Mass Intentions", description: "Mass intention requests and scheduling." },
  { key: "sacraments", name: "Sacraments", description: "Sacramental records and pastoral sacrament workflows." },
  { key: "community_help", name: "Community Help", description: "Assistance requests and community support." },
  { key: "reports", name: "Reports", description: "Operational and financial reports." },
  { key: "channels", name: "Channels", description: "Community and parish communication channels." },
  { key: "notifications", name: "Notifications", description: "Notification inbox and messaging surfaces." },
  { key: "roles", name: "Invitations & Roles", description: "Role assignment and parish invitations." },
  { key: "finance_intelligence", name: "Finance Intelligence", description: "Finance intelligence, trends, and insights." },
  { key: "kanisa_ai", name: "Kanisa AI", description: "Kanisa AI command center and assistant surfaces." },
  { key: "catholic_content", name: "Catholic Content", description: "Saints, daily readings, liturgical calendar, and prayer library." },
];

export default function FeatureManagement() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedChurchId, setSelectedChurchId] = useState<string>("");

  // ---- Global local state ----
  const [globalDraft, setGlobalDraft] = useState<Record<string, LocalGlobal>>({});
  const [globalDirty, setGlobalDirty] = useState(false);

  // ---- Church local state ----
  const [churchDraft, setChurchDraft] = useState<Record<string, LocalChurch>>({});
  const [churchDirty, setChurchDirty] = useState(false);

  // ---- Queries ----
  const { data: features = [], isLoading: featuresLoading } = useQuery({
    queryKey: ["sa-features"],
    queryFn: async () => {
      const { data, error } = await supabase.from("platform_features").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Feature[];
    },
  });

  const { data: churches = [] } = useQuery({
    queryKey: ["sa-churches-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("churches").select("id, name, code").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: churchFeatures = [], isLoading: churchFeaturesLoading } = useQuery({
    queryKey: ["sa-church-features", selectedChurchId],
    queryFn: async () => {
      if (!selectedChurchId) return [];
      const { data, error } = await supabase
        .from("church_features")
        .select("*")
        .eq("church_id", selectedChurchId);
      if (error) throw error;
      return (data ?? []) as ChurchFeature[];
    },
    enabled: !!selectedChurchId,
  });

  // ---- Sync global draft from DB ----
  useEffect(() => {
    if (features.length) {
      const draft: Record<string, LocalGlobal> = {};
      features.forEach((f) => {
        draft[f.id] = { enabled: f.globally_enabled, locked: f.globally_locked };
      });
      setGlobalDraft(draft);
      setGlobalDirty(false);
    }
  }, [features]);

  // ---- Sync church draft from DB ----
  useEffect(() => {
    if (features.length && selectedChurchId) {
      const draft: Record<string, LocalChurch> = {};
      features.forEach((f) => {
        const cf = churchFeatures.find((c) => c.feature_id === f.id);
        draft[f.id] = { enabled: cf?.enabled === true, locked: cf?.locked === true };
      });
      setChurchDraft(draft);
      setChurchDirty(false);
    }
  }, [features, churchFeatures, selectedChurchId]);

  // ---- Global mutations ----
  const globalApply = useMutation({
    mutationFn: async () => {
      for (const f of features) {
        const d = globalDraft[f.id];
        if (!d) continue;
        if (d.enabled !== f.globally_enabled || d.locked !== f.globally_locked) {
          const { error } = await supabase
            .from("platform_features")
            .update({ globally_enabled: d.enabled, globally_locked: d.locked } as any)
            .eq("id", f.id);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sa-features"] });
      qc.invalidateQueries({ queryKey: ["portal-platform-features"] });
      qc.invalidateQueries({ queryKey: ["portal-church-features"] });
      toast.success("Global settings applied successfully");
      setGlobalDirty(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const initializeDefaults = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("platform_features").upsert(
        DEFAULT_FEATURES.map((feature) => ({
          key: feature.key,
          name: feature.name,
          description: feature.description,
          globally_enabled: feature.globallyEnabled ?? true,
          globally_locked: false,
        })) as any,
        { onConflict: "key" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sa-features"] });
      qc.invalidateQueries({ queryKey: ["portal-platform-features"] });
      toast.success("Feature controls initialized");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ---- Church mutations ----
  const churchApply = useMutation({
    mutationFn: async () => {
      if (!selectedChurchId) throw new Error("No church selected");
      for (const f of features) {
        const d = churchDraft[f.id];
        if (!d) continue;
        const existing = churchFeatures.find((c) => c.feature_id === f.id);
        if (f.key === "livestream") {
          if (!existing || existing.enabled !== d.enabled || existing.locked !== d.locked) {
            await setAuthoritativeLivestreamFeature(selectedChurchId, d.enabled, d.locked);
          }
          continue;
        }
        if (existing) {
          if (existing.enabled !== d.enabled || existing.locked !== d.locked) {
            const { error } = await supabase
              .from("church_features")
              .update({ enabled: d.enabled, locked: d.locked, updated_at: new Date().toISOString() } as any)
              .eq("id", existing.id);
            if (error) throw error;
          }
        } else {
          const { error } = await supabase.from("church_features").insert({
            church_id: selectedChurchId,
            feature_id: f.id,
            enabled: d.enabled,
            locked: d.locked,
          } as any);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sa-church-features", selectedChurchId] });
      qc.invalidateQueries({ queryKey: ["portal-church-features", selectedChurchId] });
      qc.invalidateQueries({ queryKey: ["portal-church-features"] });
      toast.success("Church settings updated successfully");
      setChurchDirty(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetChurch = useMutation({
    mutationFn: async () => {
      if (!selectedChurchId) return;
      const livestream = features.find((feature) => feature.key === "livestream");
      if (livestream) {
        await setAuthoritativeLivestreamFeature(
          selectedChurchId,
          livestream.globally_enabled,
          livestream.globally_locked,
        );
      }
      const { error } = await supabase.from("church_features").upsert(
        features.filter((feature) => feature.key !== "livestream").map((feature) => ({
          church_id: selectedChurchId,
          feature_id: feature.id,
          enabled: feature.is_mandatory ? true : feature.globally_enabled,
          locked: feature.is_mandatory ? true : feature.globally_locked,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "church_id,feature_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sa-church-features", selectedChurchId] });
      qc.invalidateQueries({ queryKey: ["portal-church-features", selectedChurchId] });
      qc.invalidateQueries({ queryKey: ["portal-church-features"] });
      toast.success("Church reset to global defaults");
      setChurchDirty(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ---- Bulk apply to ALL churches ----
  const bulkApplyAll = useMutation({
    mutationFn: async () => {
      if (!selectedChurchId) throw new Error("No church selected as source");
      // Get current church draft as the source settings
      const sourceSettings = churchDraft;
      for (const church of churches) {
        if (church.id === selectedChurchId) continue; // skip source church
        for (const f of features) {
          const gd = globalDraft[f.id] ?? { enabled: f.globally_enabled, locked: f.globally_locked };
          if (gd.locked || !gd.enabled) continue; // global controls remain authoritative
          const desired = sourceSettings[f.id]?.enabled ?? gd.enabled;
          const locked = sourceSettings[f.id]?.locked ?? false;
          if (f.key === "livestream") {
            await setAuthoritativeLivestreamFeature(church.id, desired, locked);
            continue;
          }
          // Upsert for this church
          const { error } = await supabase.from("church_features").upsert(
            { church_id: church.id, feature_id: f.id, enabled: desired, locked, updated_at: new Date().toISOString() } as any,
            { onConflict: "church_id,feature_id" }
          );
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sa-church-features"] });
      qc.invalidateQueries({ queryKey: ["portal-church-features"] });
      toast.success(`Settings applied to all ${churches.length - 1} other churches`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateGlobal = useCallback((featureId: string, field: "enabled" | "locked", value: boolean) => {
    setGlobalDraft((prev) => {
      const current = prev[featureId] ?? { enabled: true, locked: false };
      const next = { ...current, [field]: value };
      if (field === "enabled" && !value) next.locked = false;
      return { ...prev, [featureId]: next };
    });
    setGlobalDirty(true);
  }, []);

  const updateChurch = useCallback((featureId: string, field: "enabled" | "locked", value: boolean) => {
    setChurchDraft((prev) => {
      const current = {
        enabled: prev[featureId]?.enabled ?? true,
        locked: prev[featureId]?.locked ?? false,
      };
      const next = { ...current, [field]: value };
      if (field === "enabled" && !value) next.locked = false;
      return { ...prev, [featureId]: next };
    });
    setChurchDirty(true);
  }, []);

  const filtered = features.filter(
    (f) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      (f.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const getEffectiveStatus = (f: Feature) => {
    const gd = globalDraft[f.id];
    if (!gd) return { enabled: f.globally_enabled, locked: f.globally_locked };
    return { enabled: gd.enabled, locked: gd.locked };
  };

  const getChurchEffective = (f: Feature) => {
    const gd = globalDraft[f.id] ?? { enabled: f.globally_enabled, locked: f.globally_locked };
    if (!gd.enabled) return { enabled: false, locked: true, source: "Global Hidden" };
    if (gd.locked) return { enabled: gd.enabled, locked: true, source: "Global Locked" };
    const cd = churchDraft[f.id];
    return {
      enabled: cd?.enabled === true,
      locked: cd?.locked === true,
      source: cd?.locked ? "Church Locked" : cd?.enabled === false ? "Church Hidden" : "Active",
    };
  };

  return (
    <TooltipProvider>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold font-serif">Feature Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Hide or lock features globally, then override visible and locked states per church when allowed.
            Changes only apply when you click Apply.
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search features..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary border-border/50"
          />
        </div>

        <Tabs defaultValue="global">
          <TabsList className="bg-secondary">
            <TabsTrigger value="global" className="gap-2">
              <Globe className="h-4 w-4" /> Global
            </TabsTrigger>
            <TabsTrigger value="church" className="gap-2">
              <Building2 className="h-4 w-4" /> Per Church
            </TabsTrigger>
          </TabsList>

          {/* ==================== GLOBAL TAB ==================== */}
          <TabsContent value="global" className="space-y-4 mt-4">
            <Card className="glass-card">
              <CardContent className="p-0">
                {featuresLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : features.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                    <Globe className="h-10 w-10 text-muted-foreground/60" />
                    <div>
                      <p className="font-semibold">No feature controls are registered yet.</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Initialize the default Kanisa feature catalog to begin hiding or locking modules.
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => initializeDefaults.mutate()}
                      disabled={initializeDefaults.isPending}
                      className="gap-2"
                    >
                      {initializeDefaults.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Initialize Default Features
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border">
                        <TableHead>Feature</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-center">Visible</TableHead>
                        <TableHead className="text-center">Locked</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((f) => {
                        const s = getEffectiveStatus(f);
                        return (
                          <TableRow key={f.id} className="border-border">
                            <TableCell className="font-medium">{f.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{f.description}</TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={s.enabled}
                                onCheckedChange={(v) => updateGlobal(f.id, "enabled", v)}
                                disabled={f.is_mandatory}
                                aria-label={`Set ${f.name} global visibility`}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={s.locked}
                                onCheckedChange={(v) => updateGlobal(f.id, "locked", v)}
                                disabled={f.is_mandatory || !s.enabled}
                                aria-label={`Lock ${f.name} globally`}
                              />
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  !s.enabled
                                    ? "bg-muted text-muted-foreground"
                                    : s.locked
                                    ? "bg-destructive/20 text-destructive border-destructive/30"
                                    : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                }
                              >
                                {!s.enabled ? <EyeOff className="h-3 w-3 mr-1" /> : s.locked ? <Lock className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                                {!s.enabled ? "Hidden for All" : s.locked ? "Visible + Locked" : "Visible"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                onClick={() => globalApply.mutate()}
                disabled={!globalDirty || globalApply.isPending}
                className="gap-2"
              >
                {globalApply.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Apply Global Changes
              </Button>
            </div>
          </TabsContent>

          {/* ==================== PER-CHURCH TAB ==================== */}
          <TabsContent value="church" className="space-y-4 mt-4">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={selectedChurchId} onValueChange={(v) => setSelectedChurchId(v)}>
                <SelectTrigger className="w-[300px] bg-secondary border-border/50">
                  <SelectValue placeholder="Select Church" />
                </SelectTrigger>
                <SelectContent>
                  {churches.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedChurchId && churchFeatures.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => resetChurch.mutate()}
                  disabled={resetChurch.isPending}
                  className="gap-1.5 text-muted-foreground"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset to Global
                </Button>
              )}
            </div>

            {!selectedChurchId ? (
              <Card className="glass-card">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>Select a church to manage its feature overrides.</p>
                </CardContent>
              </Card>
            ) : churchFeaturesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <Card className="glass-card">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border">
                          <TableHead>Feature</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-center">Visible</TableHead>
                          <TableHead className="text-center">Locked</TableHead>
                          <TableHead>Effective Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((f) => {
                          const ce = getChurchEffective(f);
                          const globallyControlled = ce.source === "Global Hidden" || ce.source === "Global Locked";
                          return (
                            <TableRow key={f.id} className="border-border">
                              <TableCell className="font-medium">{f.name}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">{f.description}</TableCell>
                              <TableCell className="text-center">
                                {globallyControlled ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="inline-flex items-center gap-1.5 text-muted-foreground">
                                        {ce.enabled ? <Lock className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                        <span className="text-xs">{ce.source}</span>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      This feature is controlled globally and cannot be overridden for one church.
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <Switch
                                    checked={ce.enabled}
                                    onCheckedChange={(v) => updateChurch(f.id, "enabled", v)}
                                    disabled={f.is_mandatory}
                                    aria-label={`Set ${f.name} visibility for selected church`}
                                  />
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {globallyControlled ? (
                                  <span className="text-xs text-muted-foreground">Global</span>
                                ) : (
                                  <Switch
                                    checked={ce.locked}
                                    disabled={f.is_mandatory || !ce.enabled}
                                    onCheckedChange={(v) => updateChurch(f.id, "locked", v)}
                                    aria-label={`Lock ${f.name} for selected church`}
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={
                                    ce.locked
                                      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                      : ce.enabled
                                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                      : "bg-muted text-muted-foreground"
                                  }
                                >
                                  {ce.locked ? <Lock className="h-3 w-3 mr-1" /> : ce.enabled ? <Unlock className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                                  {ce.source}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <div className="flex flex-wrap justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => bulkApplyAll.mutate()}
                    disabled={bulkApplyAll.isPending || churches.length <= 1}
                    className="gap-2"
                  >
                    {bulkApplyAll.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Apply to All Churches
                  </Button>
                  <Button
                    onClick={() => churchApply.mutate()}
                    disabled={!churchDirty || churchApply.isPending}
                    className="gap-2"
                  >
                    {churchApply.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Apply to Church
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
