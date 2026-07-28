import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleHelp, LockKeyhole, RotateCcw, Save, ShieldCheck, ShieldX, Loader2 } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PermissionControl } from "@/components/permissions/PermissionControl";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  applyRecommendedPermissions,
  CHURCH_PERMISSION_ACTIONS,
  indexPermissionConstraints,
  PERMISSION_CLASSIFICATIONS,
  resolvePermissionConstraint,
  type PermissionConstraint,
  type PermissionDraft,
} from "@/lib/permission-constraints";

type ChurchRole = string;
type Action = (typeof CHURCH_PERMISSION_ACTIONS)[number];
type MatrixRow = {
  feature_id: string;
  feature_key: string;
  feature_name: string;
  description: string | null;
  category: string;
  globally_enabled: boolean;
  globally_locked: boolean;
  subscription_available: boolean;
  member_available: boolean;
  staff_available: boolean;
  church_enabled: boolean;
  role: ChurchRole;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
  can_publish: boolean;
  can_manage: boolean;
};

const actions = CHURCH_PERMISSION_ACTIONS;
const roleLabel = (role: string) => role.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function recommended(role: ChurchRole, feature: MatrixRow, action: Action) {
  if (role === "church_admin") return true;
  if (action === "view") return role === "member" ? feature.member_available : feature.staff_available;
  const createEdit: Record<string, string[]> = {
    church_admin: [],
    pastor: ["prayer_requests", "mass_intentions", "sacraments", "events", "announcements", "community_help"],
    secretary: ["members", "families", "communities", "ministries", "events", "event_requests", "announcements", "mass_intentions", "notifications", "channels"],
    treasurer: ["contributions", "pledges", "reports", "finance_intelligence"],
    member: ["prayer_requests", "mass_intentions", "event_requests", "community_help", "give", "pledges"],
  };
  if (action === "create") return (createEdit[role] ?? []).includes(feature.feature_key);
  if (action === "edit") return role !== "member" && (createEdit[role] ?? []).includes(feature.feature_key);
  if (action === "approve") return role === "pastor" && ["prayer_requests", "mass_intentions", "sacraments", "community_help"].includes(feature.feature_key);
  if (action === "publish") return ["pastor", "secretary"].includes(role) && ["announcements", "events", "sermons"].includes(feature.feature_key);
  return false;
}

export default function FeaturesPermissionsPage() {
  const { churchId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<ChurchRole>("church_admin");
  const [draft, setDraft] = useState<PermissionDraft>({});
  const [dirty, setDirty] = useState(false);

  const matrixQuery = useQuery({
    queryKey: ["church-feature-permission-matrix", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase.rpc("get_church_feature_permission_matrix", { _church_id: churchId });
      if (error) throw error;
      return (data ?? []) as MatrixRow[];
    },
    enabled: !!churchId,
  });
  const rows = useMemo(() => matrixQuery.data ?? [], [matrixQuery.data]);
  const roles = useMemo(() => [...new Set(rows.map((row) => row.role))].sort((a, b) => roleLabel(a).localeCompare(roleLabel(b))), [rows]);
  const featureRows = useMemo(() => rows.filter((row) => row.role === (roles.includes("church_admin") ? "church_admin" : roles[0])), [roles, rows]);
  const roleRows = useMemo(() => rows.filter((row) => (
    row.role === selectedRole
    && row.church_enabled
    && (selectedRole === "member" ? row.member_available : row.staff_available)
  )), [rows, selectedRole]);
  const constraintsQuery = useQuery({
    queryKey: ["church-permission-constraints", churchId, selectedRole],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase.rpc("get_church_permission_constraints", {
        _church_id: churchId,
        _role: selectedRole,
      });
      if (error) throw error;
      return (data ?? []) as PermissionConstraint[];
    },
    enabled: !!churchId && !!selectedRole,
  });
  const constraints = useMemo(
    () => indexPermissionConstraints(constraintsQuery.data ?? []),
    [constraintsQuery.data],
  );

  useEffect(() => {
    if (roles.length > 0 && !roles.includes(selectedRole)) setSelectedRole(roles[0]);
  }, [roles, selectedRole]);

  useEffect(() => {
    setDraft(Object.fromEntries(roleRows.map((row) => [row.feature_key, Object.fromEntries(actions.map((action) => [action, row[`can_${action}`]]))])) as PermissionDraft);
    setDirty(false);
  }, [roleRows]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const invalidatePermissions = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["church-feature-permission-matrix", churchId] }),
      queryClient.invalidateQueries({ queryKey: ["portal-church-features", churchId] }),
      queryClient.invalidateQueries({ queryKey: ["church-role-permissions", churchId] }),
      queryClient.invalidateQueries({ queryKey: ["church-permission", churchId] }),
      queryClient.invalidateQueries({ queryKey: ["church-permission-constraints", churchId] }),
    ]);
  };

  const toggleFeature = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      if (!churchId) throw new Error("No church selected");
      const { error } = await supabase.rpc("set_church_feature_enabled", { _church_id: churchId, _feature_key: key, _enabled: enabled });
      if (error) throw error;
    },
    onSuccess: async () => { await invalidatePermissions(); toast({ title: "Feature setting updated" }); },
    onError: (error: Error) => toast({ title: "Unable to update feature", description: error.message, variant: "destructive" }),
  });

  const savePermissions = useMutation({
    mutationFn: async () => {
      if (!churchId) throw new Error("No church selected");
      const payload = roleRows.map((row) => ({ feature_key: row.feature_key, ...draft[row.feature_key] }));
      const { error } = await supabase.rpc("save_church_role_permissions", { _church_id: churchId, _role: selectedRole, _permissions: payload });
      if (error) throw error;
    },
    onSuccess: async () => { setDirty(false); await invalidatePermissions(); toast({ title: "Role permissions saved" }); },
    onError: (error: Error) => toast({ title: "Unable to save permissions", description: error.message, variant: "destructive" }),
  });

  const groupedFeatures = useMemo(() => Object.entries(featureRows.reduce<Record<string, MatrixRow[]>>((groups, row) => {
    (groups[row.category] ??= []).push(row); return groups;
  }, {})), [featureRows]);

  const resetToRecommended = () => {
    if (!window.confirm(`Reset ${roleLabel(selectedRole)} to recommended defaults?`)) return;
    const result = applyRecommendedPermissions(
      draft,
      roleRows.map((row) => row.feature_key),
      constraints,
      (featureKey, action) => {
        const row = roleRows.find((candidate) => candidate.feature_key === featureKey);
        return row ? recommended(selectedRole, row, action) : false;
      },
    );
    setDraft(result.draft);
    setDirty(true);
    if (result.skipped > 0) {
      toast({
        title: "Recommended defaults applied safely",
        description: `${result.skipped} locked or system-protected permissions were skipped.`,
      });
    }
  };

  if (matrixQuery.isLoading) return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (matrixQuery.error) return <Card><CardHeader><CardTitle>Features & Permissions unavailable</CardTitle><CardDescription>{(matrixQuery.error as Error).message}</CardDescription></CardHeader></Card>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div><h1 className="text-2xl font-bold font-serif">Features & Permissions</h1><p className="mt-1 text-sm text-muted-foreground">Choose church features and control what each role can do. All checks are also enforced by the server.</p></div>
      <Tabs defaultValue="features">
        <TabsList><TabsTrigger value="features">Features</TabsTrigger><TabsTrigger value="roles">Role Permissions</TabsTrigger></TabsList>
        <TabsContent value="features" className="mt-4 space-y-6">
          {groupedFeatures.map(([category, features]) => <section key={category} className="space-y-3"><h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{category}</h2><div className="grid gap-3 md:grid-cols-2">{features.map((feature) => {
            const mandatory = feature.feature_key === "feature_permissions_admin";
            const unavailable = !mandatory && (!feature.globally_enabled || feature.globally_locked || !feature.subscription_available);
            const status = !feature.globally_enabled || feature.globally_locked ? "Disabled globally" : !feature.subscription_available ? "Unavailable under subscription" : feature.church_enabled ? "Enabled" : "Disabled by church";
            return <Card key={feature.feature_key}><CardContent className="flex items-start justify-between gap-4 p-4"><div className="space-y-1"><div className="flex flex-wrap items-center gap-2"><Label htmlFor={`feature-${feature.feature_key}`} className="font-medium">{feature.feature_name}</Label><Badge variant={feature.church_enabled && !unavailable ? "default" : "secondary"}>{mandatory ? "Mandatory" : status}</Badge></div><p className="text-sm text-muted-foreground">{feature.description}</p>{unavailable && <p className="text-xs text-amber-600">This feature cannot be enabled until the platform or subscription restriction is removed.</p>}</div><Switch id={`feature-${feature.feature_key}`} checked={feature.church_enabled && !unavailable} disabled={mandatory || unavailable || toggleFeature.isPending} onCheckedChange={(enabled) => toggleFeature.mutate({ key: feature.feature_key, enabled })} aria-label={`Enable ${feature.feature_name}`} /></CardContent></Card>;
          })}</div></section>)}
        </TabsContent>
        <TabsContent value="roles" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-primary" /> Role Permissions
              </CardTitle>
              <CardDescription>
                Only enabled features are shown. An “own records” scope is displayed only where database policies enforce ownership.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                Some permissions are locked to protect church data, financial records, tenant isolation, and platform security.
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(14rem,20rem)_1fr] lg:items-start">
                <div>
                  <Label>Church role</Label>
                  <Select
                    value={selectedRole}
                    onValueChange={(value) => {
                      if (!dirty || window.confirm("Discard unsaved permission changes?")) setSelectedRole(value);
                    }}
                  >
                    <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => <SelectItem key={role} value={role}>{roleLabel(role)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 text-sm">
                  <p className="font-medium">Permission states</p>
                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-muted-foreground" aria-label="Permission state legend">
                    <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" /> Configurable</span>
                    <span className="inline-flex items-center gap-1.5"><LockKeyhole className="h-4 w-4 text-amber-700" /> Restricted</span>
                    <span className="inline-flex items-center gap-1.5"><ShieldX className="h-4 w-4" /> System Protected</span>
                  </div>
                  <details className="rounded-md border p-3">
                    <summary className="flex cursor-pointer list-none items-center gap-2 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <CircleHelp className="h-4 w-4" /> Why are some permissions locked?
                    </summary>
                    <p className="mt-2 text-muted-foreground">
                      Restricted permissions require a Platform Administrator. System-protected permissions are unsupported or exceed the selected role’s safe authority. The database applies the same rules to direct and stale-client requests.
                    </p>
                  </details>
                </div>
              </div>

              {constraintsQuery.error && (
                <p role="alert" className="text-sm text-destructive">
                  Permission constraints could not be loaded. All cells are locked until the server rules are available.
                </p>
              )}

              <TooltipProvider delayDuration={200}>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead>
                      <tr className="border-b bg-muted/60">
                        <th className="sticky left-0 z-20 min-w-52 bg-muted p-2 text-left">Feature</th>
                        {actions.map((action) => <th key={action} className="p-2 text-center capitalize">{action}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {roleRows.map((row) => (
                        <tr key={row.feature_key} className="border-b last:border-0">
                          <th scope="row" className="sticky left-0 z-10 bg-background p-2 text-left font-medium">
                            {row.feature_name}
                          </th>
                          {actions.map((action) => {
                            const constraint = resolvePermissionConstraint(constraints, row.feature_key, action);
                            return (
                              <td key={action} className="p-2 text-center">
                                <PermissionControl
                                  checked={draft[row.feature_key]?.[action] ?? false}
                                  constraint={constraint}
                                  label={`${roleLabel(selectedRole)} may ${action} ${row.feature_name}`}
                                  onCheckedChange={(checked) => {
                                    if (constraint.classification !== PERMISSION_CLASSIFICATIONS.CONFIGURABLE) return;
                                    setDraft((current) => ({
                                      ...current,
                                      [row.feature_key]: { ...current[row.feature_key], [action]: checked },
                                    }));
                                    setDirty(true);
                                  }}
                                />
                                {constraint.record_scope === "own" && (
                                  <span className="mt-1 block text-[10px] font-medium text-muted-foreground">Own records</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TooltipProvider>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => savePermissions.mutate()} disabled={!dirty || savePermissions.isPending || constraintsQuery.isLoading || !!constraintsQuery.error}>
                  {savePermissions.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Changes
                </Button>
                <Button variant="outline" onClick={resetToRecommended} disabled={constraintsQuery.isLoading || !!constraintsQuery.error}>
                  <RotateCcw className="mr-2 h-4 w-4" />Reset to Recommended Defaults
                </Button>
                {dirty && <span className="self-center text-sm text-amber-600">You have unsaved changes.</span>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
