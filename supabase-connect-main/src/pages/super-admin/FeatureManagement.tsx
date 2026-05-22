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
import { Lock, Unlock, Globe, Building2, Loader2, RotateCcw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Feature = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  globally_enabled: boolean;
  globally_locked: boolean;
};

type ChurchFeature = {
  id: string;
  church_id: string;
  feature_id: string;
  enabled: boolean;
};

type LocalGlobal = { enabled: boolean; locked: boolean };
type LocalChurch = { enabled: boolean };

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
      const { data } = await supabase.from("platform_features").select("*").order("name");
      return (data ?? []) as Feature[];
    },
  });

  const { data: churches = [] } = useQuery({
    queryKey: ["sa-churches-list"],
    queryFn: async () => {
      const { data } = await supabase.from("churches").select("id, name, code").order("name");
      return data ?? [];
    },
  });

  const { data: churchFeatures = [], isLoading: churchFeaturesLoading } = useQuery({
    queryKey: ["sa-church-features", selectedChurchId],
    queryFn: async () => {
      if (!selectedChurchId) return [];
      const { data } = await supabase
        .from("church_features")
        .select("*")
        .eq("church_id", selectedChurchId);
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
        draft[f.id] = { enabled: cf ? cf.enabled : f.globally_enabled };
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

  // ---- Church mutations ----
  const churchApply = useMutation({
    mutationFn: async () => {
      if (!selectedChurchId) throw new Error("No church selected");
      for (const f of features) {
        const d = churchDraft[f.id];
        if (!d) continue;
        const existing = churchFeatures.find((c) => c.feature_id === f.id);
        if (existing) {
          if (existing.enabled !== d.enabled) {
            const { error } = await supabase
              .from("church_features")
              .update({ enabled: d.enabled, updated_at: new Date().toISOString() } as any)
              .eq("id", existing.id);
            if (error) throw error;
          }
        } else {
          const { error } = await supabase.from("church_features").insert({
            church_id: selectedChurchId,
            feature_id: f.id,
            enabled: d.enabled,
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
      for (const cf of churchFeatures) {
        await supabase.from("church_features").delete().eq("id", cf.id);
      }
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
          if (gd.locked) continue; // skip locked features
          const desired = sourceSettings[f.id]?.enabled ?? gd.enabled;
          // Upsert for this church
          const { error } = await supabase.from("church_features").upsert(
            { church_id: church.id, feature_id: f.id, enabled: desired, updated_at: new Date().toISOString() } as any,
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
    setGlobalDraft((prev) => ({ ...prev, [featureId]: { ...prev[featureId], [field]: value } }));
    setGlobalDirty(true);
  }, []);

  const updateChurch = useCallback((featureId: string, value: boolean) => {
    setChurchDraft((prev) => ({ ...prev, [featureId]: { enabled: value } }));
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
    if (gd.locked) return { enabled: gd.enabled, locked: true };
    if (!gd.enabled) return { enabled: false, locked: true };
    const cd = churchDraft[f.id];
    return { enabled: cd ? cd.enabled : gd.enabled, locked: false };
  };

  return (
    <TooltipProvider>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold font-serif">Feature Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Control features globally or per church. Changes only apply when you click Apply.
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
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border">
                        <TableHead>Feature</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-center">Enabled</TableHead>
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
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={s.locked}
                                onCheckedChange={(v) => updateGlobal(f.id, "locked", v)}
                              />
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  s.locked
                                    ? "bg-destructive/20 text-destructive border-destructive/30"
                                    : s.enabled
                                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                    : "bg-muted text-muted-foreground"
                                }
                              >
                                {s.locked && <Lock className="h-3 w-3 mr-1" />}
                                {s.locked ? "Locked" : s.enabled ? "Active" : "Disabled"}
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
                          <TableHead className="text-center">Enabled</TableHead>
                          <TableHead>Effective Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((f) => {
                          const ce = getChurchEffective(f);
                          return (
                            <TableRow key={f.id} className="border-border">
                              <TableCell className="font-medium">{f.name}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">{f.description}</TableCell>
                              <TableCell className="text-center">
                                {ce.locked ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="inline-flex items-center gap-1.5 text-muted-foreground">
                                        <Lock className="h-4 w-4" />
                                        <span className="text-xs">Locked by platform</span>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      This feature is controlled globally and cannot be overridden.
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <Switch
                                    checked={ce.enabled}
                                    onCheckedChange={(v) => updateChurch(f.id, v)}
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
                                  {ce.locked && <Lock className="h-3 w-3 mr-1" />}
                                  {ce.locked
                                    ? ce.enabled
                                      ? "Global On"
                                      : "Global Off"
                                    : ce.enabled
                                    ? "Active"
                                    : "Disabled"}
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
