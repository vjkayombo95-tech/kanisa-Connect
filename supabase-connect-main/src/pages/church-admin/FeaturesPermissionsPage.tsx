import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw, Save, ShieldCheck } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ChurchRole = "church_admin" | "pastor" | "secretary" | "treasurer" | "member";
type Action = "view" | "create" | "edit" | "delete" | "approve" | "publish" | "manage";
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

const roles: ChurchRole[] = ["church_admin", "pastor", "secretary", "treasurer", "member"];
const actions: Action[] = ["view", "create", "edit", "delete", "approve", "publish", "manage"];
const roleLabels: Record<ChurchRole, string> = {
  church_admin: "Church Admin", pastor: "Pastor", secretary: "Secretary", treasurer: "Treasurer", member: "Member",
};

function recommended(role: ChurchRole, feature: MatrixRow, action: Action) {
  if (role === "church_admin") return true;
  if (action === "view") return role === "member" ? feature.member_available : feature.staff_available;
  const createEdit: Record<ChurchRole, string[]> = {
    church_admin: [],
    pastor: ["prayer_requests", "mass_intentions", "sacraments", "events", "announcements", "community_help"],
    secretary: ["members", "families", "communities", "ministries", "events", "event_requests", "announcements", "mass_intentions", "notifications", "channels"],
    treasurer: ["contributions", "pledges", "reports", "finance_intelligence"],
    member: ["prayer_requests", "mass_intentions", "event_requests", "community_help", "give", "pledges"],
  };
  if (action === "create") return createEdit[role].includes(feature.feature_key);
  if (action === "edit") return role !== "member" && createEdit[role].includes(feature.feature_key);
  if (action === "approve") return role === "pastor" && ["prayer_requests", "mass_intentions", "sacraments", "community_help"].includes(feature.feature_key);
  if (action === "publish") return ["pastor", "secretary"].includes(role) && ["announcements", "events", "sermons"].includes(feature.feature_key);
  return false;
}

export default function FeaturesPermissionsPage() {
  const { churchId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<ChurchRole>("church_admin");
  const [draft, setDraft] = useState<Record<string, Record<Action, boolean>>>({});
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
  const featureRows = useMemo(() => rows.filter((row) => row.role === "church_admin"), [rows]);
  const roleRows = useMemo(() => rows.filter((row) => row.role === selectedRole && row.church_enabled), [rows, selectedRole]);

  useEffect(() => {
    setDraft(Object.fromEntries(roleRows.map((row) => [row.feature_key, Object.fromEntries(actions.map((action) => [action, row[`can_${action}`]]))])) as Record<string, Record<Action, boolean>>);
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
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary" /> Role Permissions</CardTitle><CardDescription>Only enabled features are shown. Member access remains constrained to the member's own private records by record-level policies.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="max-w-xs"><Label>Church role</Label><Select value={selectedRole} onValueChange={(value) => { if (!dirty || window.confirm("Discard unsaved permission changes?")) setSelectedRole(value as ChurchRole); }}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent>{roles.map((role) => <SelectItem key={role} value={role}>{roleLabels[role]}</SelectItem>)}</SelectContent></Select></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b"><th className="p-2 text-left">Feature</th>{actions.map((action) => <th key={action} className="p-2 text-center capitalize">{action}</th>)}</tr></thead><tbody>{roleRows.map((row) => <tr key={row.feature_key} className="border-b"><td className="p-2 font-medium">{row.feature_name}</td>{actions.map((action) => { const protectedPath = selectedRole === "church_admin" && row.feature_key === "feature_permissions_admin" && ["view", "manage"].includes(action); return <td key={action} className="p-2 text-center"><Checkbox checked={draft[row.feature_key]?.[action] ?? false} disabled={protectedPath} aria-label={`${roleLabels[selectedRole]} may ${action} ${row.feature_name}`} onCheckedChange={(checked) => { setDraft((current) => ({ ...current, [row.feature_key]: { ...current[row.feature_key], [action]: checked === true } })); setDirty(true); }} /></td>; })}</tr>)}</tbody></table></div><div className="flex flex-wrap gap-2"><Button onClick={() => savePermissions.mutate()} disabled={!dirty || savePermissions.isPending}>{savePermissions.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save Changes</Button><Button variant="outline" onClick={() => { if (!window.confirm(`Reset ${roleLabels[selectedRole]} to recommended defaults?`)) return; setDraft(Object.fromEntries(roleRows.map((row) => [row.feature_key, Object.fromEntries(actions.map((action) => [action, recommended(selectedRole, row, action)]))])) as Record<string, Record<Action, boolean>>); setDirty(true); }}><RotateCcw className="mr-2 h-4 w-4" />Reset to Recommended Defaults</Button>{dirty && <span className="self-center text-sm text-amber-600">You have unsaved changes.</span>}</div></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
