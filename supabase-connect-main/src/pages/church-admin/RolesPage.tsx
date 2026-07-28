import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import {
  BarChart3,
  Check,
  Copy,
  Download,
  Eye,
  Link as LinkIcon,
  Loader2,
  Mail,
  MessageCircle,
  Printer,
  QrCode,
  RefreshCw,
  Send,
  Settings,
  Shield,
  Smartphone,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getEdgeFunctionErrorMessage } from "@/lib/edge-function-error";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

const appRoles: { label: string; value: string }[] = [
  { label: "Church Admin", value: "church_admin" },
  { label: "Pastor", value: "pastor" },
  { label: "Secretary", value: "secretary" },
  { label: "Treasurer", value: "treasurer" },
  { label: "Member", value: "member" },
];

type InvitationRow = Tables<"invitations">;
type InvitationInsert = TablesInsert<"invitations">;
type ChurchInviteConfig = {
  id: string;
  name: string;
  code: string | null;
  church_code: string | null;
  short_code: string | null;
  slug: string | null;
  logo_url: string | null;
  metadata: Record<string, unknown> | null;
};
type RoleAssignmentRow = {
  id: string;
  user_id: string;
  church_id: string;
  role: string;
  created_at: string | null;
  full_name: string | null;
};
type PermissionMatrixRow = {
  feature_key: string;
  feature_name: string;
  role: string;
  church_enabled: boolean;
  subscription_available: boolean;
  globally_enabled: boolean;
  can_view: boolean;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const roleLabel = (role: string) => role.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const inviteUrlForToken = (token: string, churchCode?: string | null) =>
  `${window.location.origin}/invite/${token}${churchCode ? `?churchCode=${encodeURIComponent(churchCode)}` : ""}`;
const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function randomInviteSlug(name: string) {
  const prefix = slugify(name).slice(0, 24) || "parish";
  const random = crypto.getRandomValues(new Uint32Array(2));
  return `${prefix}-${random[0].toString(36)}${random[1].toString(36)}`.slice(0, 52);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getMetadataBoolean(metadata: Record<string, unknown> | null | undefined, key: string, fallback: boolean) {
  const value = metadata?.[key];
  return typeof value === "boolean" ? value : fallback;
}

function getMetadataNumber(metadata: Record<string, unknown> | null | undefined, key: string, fallback: number) {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function MetricCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="glass-card">
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export default function RolesPage() {
  const { churchId, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const qrSvgRef = useRef<SVGSVGElement | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState("member");
  const [roleSearch, setRoleSearch] = useState("");
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState("Join our parish community");

  const { data: church, isLoading: churchLoading } = useQuery({
    queryKey: ["invite-hub-church", churchId],
    queryFn: async () => {
      if (!churchId) return null;
      const { data, error } = await supabase
        .from("churches")
        .select("id, name, code, church_code, short_code, slug, logo_url")
        .eq("id", churchId)
        .maybeSingle();
      if (error) throw error;
      return data ? { ...data, metadata: null } as ChurchInviteConfig : null;
    },
    enabled: Boolean(churchId),
  });

  const { data: invitations = [], isLoading: invitationsLoading } = useQuery({
    queryKey: ["church-invitations", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from("invitations")
        .select("*")
        .eq("church_id", churchId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as InvitationRow[];
    },
    enabled: Boolean(churchId),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["church-members-for-roles", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from("members")
        .select("id, full_name, user_id, created_at, status")
        .eq("church_id", churchId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(churchId),
  });

  const { data: memberRoles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["church-roles", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase.rpc("get_church_role_assignments" as never, {
        _church_id: churchId,
      } as never);
      if (error) return [];
      return (data ?? []) as RoleAssignmentRow[];
    },
    enabled: Boolean(churchId),
  });

  const { data: permissionMatrix = [] } = useQuery({
    queryKey: ["church-feature-permission-matrix", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase.rpc("get_church_feature_permission_matrix", { _church_id: churchId });
      if (error) throw error;
      return (data ?? []) as PermissionMatrixRow[];
    },
    enabled: Boolean(churchId),
  });

  const roleOptions = useMemo(() => [...new Set(permissionMatrix.map((row) => row.role))]
    .sort((left, right) => roleLabel(left).localeCompare(roleLabel(right))), [permissionMatrix]);
  const linkedMembers = members.filter((member: any) => member.user_id);
  const staffUsers = useMemo(() => linkedMembers
    .filter((member: any) => member.full_name.toLowerCase().includes(roleSearch.trim().toLowerCase()))
    .map((member: any) => {
      const assignments = memberRoles.filter((assignment) => assignment.user_id === member.user_id);
      const assigned = new Set(assignments.map((assignment) => assignment.role));
      const effectivePermissions = [...new Set(permissionMatrix
        .filter((permission) => assigned.has(permission.role) && permission.can_view
          && permission.church_enabled && permission.subscription_available && permission.globally_enabled)
        .map((permission) => permission.feature_name))].sort();
      return { ...member, assignments, assigned, effectivePermissions };
    }), [linkedMembers, memberRoles, permissionMatrix, roleSearch]);

  const publicRegistrationEnabled = getMetadataBoolean(church?.metadata, "public_registration_enabled", true);
  const approvalRequired = getMetadataBoolean(church?.metadata, "public_registration_approval_required", false);
  const allowGuestRegistration = getMetadataBoolean(church?.metadata, "allow_guest_registration", true);
  const requireEmailVerification = getMetadataBoolean(church?.metadata, "require_email_verification", true);
  const invitationExpiryDays = getMetadataNumber(church?.metadata, "invitation_expiry_days", 7);
  const maximumRegistrations = getMetadataNumber(church?.metadata, "maximum_public_registrations", 0);
  const visibleChurchCode = church?.church_code || church?.code || "";
  const visibleJoinCode = church?.short_code || "";
  const publicSlug = church?.short_code || church?.church_code || church?.slug || church?.code || "";
  const publicInviteUrl = publicSlug ? `${window.location.origin}/join/${publicSlug}` : "";

  const invitationStats = useMemo(() => {
    const now = Date.now();
    const byStatus = invitations.reduce<Record<string, number>>((acc, invitation) => {
      const expired = invitation.expires_at && new Date(invitation.expires_at).getTime() < now && invitation.status === "pending";
      const status = expired ? "expired" : invitation.status ?? "pending";
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    }, {});
    const completedRegistrations = members.filter((member: any) => member.status !== "pending").length;
    const pendingApprovals = members.filter((member: any) => member.status === "pending").length;
    const starts = members.length + invitations.length;
    const conversion = starts ? Math.round((completedRegistrations / starts) * 100) : 0;

    return {
      pending: byStatus.pending ?? 0,
      accepted: byStatus.accepted ?? 0,
      expired: byStatus.expired ?? 0,
      revoked: byStatus.revoked ?? 0,
      completedRegistrations,
      pendingApprovals,
      starts,
      conversion,
    };
  }, [invitations, members]);

  const updateChurch = useMutation({
    mutationFn: async (updates: Partial<Pick<ChurchInviteConfig, "slug" | "metadata">>) => {
      if (!churchId) throw new Error("Missing church context.");
      const { error } = await supabase.from("churches").update(updates as never).eq("id", churchId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invite-hub-church", churchId] });
      toast({ title: "Invite settings updated" });
    },
    onError: (error: Error) => toast({ title: "Unable to update invite settings", description: error.message, variant: "destructive" }),
  });

  const updateMetadata = (next: Record<string, unknown>) => {
    updateChurch.mutate({ metadata: { ...(church?.metadata ?? {}), ...next } });
  };

  const regeneratePublicLink = () => {
    if (!church) return;
    updateChurch.mutate({ slug: randomInviteSlug(church.name) });
  };

  const createInvitationRecord = async ({ email, role }: { email: string; role: string }) => {
    if (!churchId) throw new Error("Missing church context.");
    const invitationPayload: InvitationInsert = {
      church_id: churchId,
      email: normalizeEmail(email),
      role: role as InvitationInsert["role"],
      invited_by: user?.id ?? null,
      token: uuidv4(),
      status: "pending",
      expires_at: new Date(Date.now() + invitationExpiryDays * 24 * 60 * 60 * 1000).toISOString(),
    };

    const { data, error } = await supabase.from("invitations").insert(invitationPayload).select("*").single();
    if (error) throw error;
    return data as InvitationRow;
  };

  const sendInvitationEmail = async ({ email, token }: { email: string; token: string }) => {
    try {
      const { data, error } = await supabase.functions.invoke("send-invitation", {
        body: { email: normalizeEmail(email), token },
      });
      if (error) {
        return { sent: false, data: null, errorMessage: await getEdgeFunctionErrorMessage(error, "The email service rejected this request.") };
      }
      return { sent: true, data, errorMessage: null };
    } catch (error) {
      return { sent: false, data: null, errorMessage: await getEdgeFunctionErrorMessage(error, "The email service rejected this request.") };
    }
  };

  const sendInvite = useMutation({
    mutationFn: async () => {
      if (!inviteEmail.trim()) throw new Error("Email is required.");
      const invitation = await createInvitationRecord({ email: inviteEmail, role: inviteRole });
      const sendResult = await sendInvitationEmail({ email: invitation.email, token: invitation.token });
      return { invitation, sendResult };
    },
    onSuccess: ({ invitation, sendResult }) => {
      queryClient.invalidateQueries({ queryKey: ["church-invitations", churchId] });
      toast({
        title: sendResult.sent ? "Invitation sent" : "Invite saved, email not sent",
        description: sendResult.sent
          ? `Invitation sent to ${invitation.email}.`
          : `The invitation link was created. Copy it manually if email sending is unavailable.`,
        variant: sendResult.sent ? undefined : "destructive",
      });
      setInviteEmail("");
      setInvitePhone("");
      setInviteRole("member");
      setInviteDialogOpen(false);
    },
    onError: (error: Error) => toast({ title: "Unable to create invitation", description: error.message, variant: "destructive" }),
  });

  const resendInviteEmail = async (invitation: InvitationRow) => {
    setSendingEmail(invitation.id);
    try {
      const expiresAt = new Date(Date.now() + invitationExpiryDays * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from("invitations")
        .update({ status: "pending" as never, expires_at: expiresAt } as never)
        .eq("id", invitation.id);
      if (error) throw error;
      const sendResult = await sendInvitationEmail({ email: invitation.email, token: invitation.token });
      queryClient.invalidateQueries({ queryKey: ["church-invitations", churchId] });
      toast({
        title: sendResult.sent ? "Invitation resent" : "Invitation refreshed",
        description: sendResult.sent ? `Resent to ${invitation.email}.` : "The link was refreshed, but email sending is unavailable.",
      });
    } catch (error) {
      toast({ title: "Unable to resend invitation", description: (error as Error).message, variant: "destructive" });
    } finally {
      setSendingEmail(null);
    }
  };

  const revokeInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invitations").update({ status: "revoked" as never } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["church-invitations", churchId] });
      toast({ title: "Invitation revoked" });
    },
    onError: (error: Error) => toast({ title: "Unable to revoke invitation", description: error.message, variant: "destructive" }),
  });

  const assignRole = useMutation({
    mutationFn: async (assignment?: { userId: string; role: string }) => {
      const userId = assignment?.userId ?? selectedUserId;
      const role = assignment?.role ?? selectedRole;
      if (!churchId || !userId) throw new Error("Select a linked member first.");
      const { error } = await supabase.rpc("assign_church_member_role" as never, {
        _church_id: churchId,
        _user_id: userId,
        _role: role,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["church-roles", churchId] });
      toast({ title: "Role assigned" });
      setAssignDialogOpen(false);
      setSelectedUserId("");
      setSelectedRole("member");
    },
    onError: (error: Error) => toast({ title: "Unable to assign role", description: error.message, variant: "destructive" }),
  });

  const deleteRole = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("remove_church_member_role" as never, { _role_id: id } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["church-roles", churchId] });
      toast({ title: "Role removed" });
    },
    onError: (error: Error) => toast({ title: "Unable to remove role", description: error.message, variant: "destructive" }),
  });

  const copyText = async (value: string, title = "Copied") => {
    await navigator.clipboard.writeText(value);
    toast({ title });
  };

  const sharePublicInvite = async () => {
    if (!publicInviteUrl) return;
    const text = `${church?.name ?? "Our parish"}: ${welcomeMessage}. Church Code: ${visibleChurchCode || "-"}${visibleJoinCode ? `, Join Code: ${visibleJoinCode}` : ""}. Register here: ${publicInviteUrl}`;
    if (navigator.share) {
      await navigator.share({ title: church?.name ?? "Parish invite", text, url: publicInviteUrl });
      return;
    }
    await copyText(publicInviteUrl, "Invite link copied");
  };

  const shareWhatsApp = () => {
    if (!publicInviteUrl) return;
    const text = `${church?.name ?? "Our parish"} - ${welcomeMessage}. Church Code: ${visibleChurchCode || "-"}${visibleJoinCode ? `, Join Code: ${visibleJoinCode}` : ""}. ${publicInviteUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const shareEmail = () => {
    if (!publicInviteUrl) return;
    const subject = `Join ${church?.name ?? "our parish"}`;
    const body = `${welcomeMessage}\n\nChurch Code: ${visibleChurchCode || "-"}${visibleJoinCode ? `\nJoin Code: ${visibleJoinCode}` : ""}\n\nRegister here:\n${publicInviteUrl}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const downloadSvg = () => {
    const svg = qrSvgRef.current;
    if (!svg || !church) return;
    const serializedSvg = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([serializedSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${church.short_code || church.church_code || church.slug || church.code || "parish"}-invite-qr.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadPng = () => {
    const canvas = qrCanvasRef.current;
    if (!canvas || !church) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${church.short_code || church.church_code || church.slug || church.code || "parish"}-invite-qr.png`;
    link.click();
  };

  const printPoster = () => {
    const svg = qrSvgRef.current;
    if (!svg || !publicInviteUrl) return;
    const serializedSvg = new XMLSerializer().serializeToString(svg);
    const qrDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serializedSvg)}`;
    const posterWindow = window.open("", "_blank", "width=900,height=1100");
    if (!posterWindow) return;
    const safeChurchName = escapeHtml(church?.name ?? "Parish");
    const safeWelcome = escapeHtml(welcomeMessage);
    const safeLink = escapeHtml(publicInviteUrl);
    const safeChurchCode = escapeHtml(visibleChurchCode || "-");
    const safeJoinCode = escapeHtml(visibleJoinCode || "-");
    const safeLogo = church?.logo_url ? escapeHtml(church.logo_url) : "";

    posterWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${safeChurchName} Parish Invite</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Arial, sans-serif; background: #f4f5f7; color: #101827; }
            .poster { width: min(92vw, 760px); min-height: 1040px; padding: 64px 56px; background: white; text-align: center; border: 1px solid #e5e7eb; }
            .logo { width: 104px; height: 104px; object-fit: cover; border-radius: 24px; margin: 0 auto 28px; }
            .eyebrow { color: #a16207; letter-spacing: 0.22em; text-transform: uppercase; font-size: 15px; font-weight: 700; }
            h1 { margin: 16px 0 12px; font-size: 44px; line-height: 1.05; }
            h2 { margin: 18px 0 0; font-size: 30px; }
            p { font-size: 22px; line-height: 1.45; color: #4b5563; }
            .qr { margin: 46px auto 28px; width: 360px; height: 360px; padding: 24px; background: #fff; border: 10px solid #f4b321; border-radius: 28px; }
            .qr img { width: 100%; height: 100%; }
            .link { margin-top: 32px; font-size: 16px; color: #a16207; overflow-wrap: anywhere; }
            .powered { margin-top: 56px; font-size: 14px; letter-spacing: 0.18em; text-transform: uppercase; color: #6b7280; }
            @media print { body { background: white; } .poster { width: 100%; min-height: 100vh; border: 0; } }
          </style>
        </head>
        <body>
          <main class="poster">
            ${safeLogo ? `<img class="logo" src="${safeLogo}" alt="${safeChurchName} logo" />` : ""}
            <div class="eyebrow">Welcome to</div>
            <h1>${safeChurchName}</h1>
            <h2>${safeWelcome}</h2>
            <p>Church Code: <strong>${safeChurchCode}</strong><br />Join Code: <strong>${safeJoinCode}</strong></p>
            <p>Scan the QR code with your phone camera to join our parish community.</p>
            <div class="qr"><img src="${qrDataUrl}" alt="Parish registration QR code" /></div>
            <p class="link">${safeLink}</p>
            <p class="powered">Powered by Kanisa Connect</p>
          </main>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    posterWindow.document.close();
  };

  const statusClass = (status: string | null) => {
    if (status === "accepted") return "bg-primary/20 text-primary border-primary/30";
    if (status === "expired" || status === "revoked") return "bg-muted text-muted-foreground border-border";
    return "bg-accent/20 text-accent border-accent/30";
  };


  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">Parish Invite Hub</h1>
          <p className="mt-1 text-sm text-muted-foreground">Invite members, share public registration, and manage parish onboarding.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => publicInviteUrl && copyText(publicInviteUrl, "Public invite link copied")} disabled={!publicInviteUrl}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Link
          </Button>
          <Button onClick={sharePublicInvite} disabled={!publicInviteUrl}>
            <Smartphone className="mr-2 h-4 w-4" />
            Share
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Pending invites" value={invitationStats.pending} />
        <MetricCard label="Accepted invites" value={invitationStats.accepted} />
        <MetricCard label="Registrations" value={invitationStats.completedRegistrations} />
        <MetricCard label="Conversion" value={`${invitationStats.conversion}%`} />
      </div>

      <Tabs defaultValue="individual" className="space-y-5">
        <TabsList className="grid h-auto grid-cols-2 gap-1 bg-secondary p-1 md:grid-cols-6">
          <TabsTrigger value="individual">Individual</TabsTrigger>
          <TabsTrigger value="public">Public Invite</TabsTrigger>
          <TabsTrigger value="qr">QR Code</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>

        <TabsContent value="individual" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button><Mail className="mr-2 h-4 w-4" /> Invite Member</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-serif">Send Individual Invitation</DialogTitle></DialogHeader>
                <form onSubmit={(event) => { event.preventDefault(); sendInvite.mutate(); }} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email address</Label>
                    <Input id="invite-email" type="email" placeholder="member@example.com" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-phone">Phone number</Label>
                    <Input id="invite-phone" placeholder="SMS invite placeholder" value={invitePhone} onChange={(event) => setInvitePhone(event.target.value)} />
                    <p className="text-xs text-muted-foreground">Phone capture is ready for future SMS sending. Email remains the active delivery method.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {appRoles.map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={sendInvite.isPending}>
                      {sendInvite.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Send Invite
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="glass-card">
            <CardHeader><CardTitle className="text-base font-sans">Individual Invitations</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitationsLoading ? (
                    <TableRow><TableCell colSpan={5} className="py-12 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
                  ) : invitations.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="py-12 text-center text-muted-foreground">No invitations sent yet. Invite a member to begin onboarding.</TableCell></TableRow>
                  ) : invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell className="font-medium">{invitation.email}</TableCell>
                      <TableCell><Badge variant="outline">{invitation.role?.replace("_", " ")}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className={statusClass(invitation.status)}>{invitation.status}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{invitation.expires_at ? new Date(invitation.expires_at).toLocaleDateString() : "No expiry"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Button variant="ghost" size="sm" onClick={() => copyText(inviteUrlForToken(invitation.token, visibleJoinCode || visibleChurchCode), "Invite link copied")}>Link</Button>
                          {(invitation.status === "pending" || invitation.status === "expired") && (
                            <Button variant="ghost" size="icon" onClick={() => resendInviteEmail(invitation)} disabled={sendingEmail === invitation.id} aria-label={`Resend invite to ${invitation.email}`}>
                              {sendingEmail === invitation.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            </Button>
                          )}
                          {invitation.status === "pending" && (
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => revokeInvite.mutate(invitation.id)} aria-label={`Revoke invite to ${invitation.email}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="public" className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <Card className="glass-card">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base font-sans"><LinkIcon className="h-4 w-4" /> Public Parish Invite</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 p-4">
                <div>
                  <p className="font-medium">Public registration</p>
                  <p className="text-sm text-muted-foreground">Visitors can register directly into this parish from the public link.</p>
                </div>
                <Switch checked={publicRegistrationEnabled} onCheckedChange={(checked) => updateMetadata({ public_registration_enabled: checked })} aria-label="Toggle public registration" />
              </div>
              <div className="space-y-2">
                <Label>Registration URL</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input value={publicInviteUrl || "No public link available"} readOnly />
                  <Button type="button" variant="outline" onClick={() => publicInviteUrl && copyText(publicInviteUrl, "Public invite link copied")} disabled={!publicInviteUrl}>Copy</Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Welcome message</Label>
                <Textarea value={welcomeMessage} onChange={(event) => setWelcomeMessage(event.target.value)} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Button variant="outline" onClick={shareWhatsApp} disabled={!publicInviteUrl}><MessageCircle className="mr-2 h-4 w-4" /> WhatsApp</Button>
                <Button variant="outline" onClick={shareEmail} disabled={!publicInviteUrl}><Mail className="mr-2 h-4 w-4" /> Email</Button>
                <Button variant="outline" asChild disabled={!publicInviteUrl}><Link to={publicSlug ? `/join/${publicSlug}` : "#"}><Eye className="mr-2 h-4 w-4" /> Preview</Link></Button>
                <Button variant="outline" onClick={regeneratePublicLink} disabled={!church || updateChurch.isPending}><RefreshCw className="mr-2 h-4 w-4" /> Regenerate</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="space-y-3 p-5">
              <p className="text-sm font-semibold">Security status</p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Links are revocable by disabling public registration.</p>
                <p>Regeneration rotates the parish join slug and invalidates the old public URL.</p>
                <p>Registration is resolved server-side through existing public registration RPCs.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qr" className="grid gap-5 lg:grid-cols-[420px_1fr]">
          <Card className="glass-card">
            <CardContent className="flex flex-col items-center p-6 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Parish Registration</p>
              <h2 className="mt-2 font-serif text-2xl font-bold">{church?.name ?? "Your Parish"}</h2>
              <div className="mt-6 rounded-3xl bg-white p-4">
                {publicInviteUrl ? (
                  <>
                    <QRCodeSVG ref={qrSvgRef} value={publicInviteUrl} size={240} level="H" marginSize={4} title={`${church?.name ?? "Parish"} registration QR code`} />
                    <div className="hidden"><QRCodeCanvas ref={qrCanvasRef} value={publicInviteUrl} size={720} level="H" marginSize={4} /></div>
                  </>
                ) : (
                  <div className="flex h-60 w-60 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><QrCode className="h-16 w-16" /></div>
                )}
              </div>
              <p className="mt-5 break-all text-sm text-muted-foreground">{publicInviteUrl || "Create a public link first."}</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader><CardTitle className="text-base font-sans">QR Actions</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Button variant="outline" onClick={() => publicInviteUrl && copyText(publicInviteUrl, "Registration link copied")} disabled={!publicInviteUrl}><Copy className="mr-2 h-4 w-4" /> Copy Link</Button>
              <Button variant="outline" onClick={sharePublicInvite} disabled={!publicInviteUrl}><Smartphone className="mr-2 h-4 w-4" /> Native Share</Button>
              <Button variant="outline" onClick={downloadPng} disabled={!publicInviteUrl}><Download className="mr-2 h-4 w-4" /> Download PNG</Button>
              <Button variant="outline" onClick={downloadSvg} disabled={!publicInviteUrl}><Download className="mr-2 h-4 w-4" /> Download SVG</Button>
              <Button variant="outline" onClick={regeneratePublicLink} disabled={!church || updateChurch.isPending}><RefreshCw className="mr-2 h-4 w-4" /> Refresh QR</Button>
              <Button onClick={printPoster} disabled={!publicInviteUrl}><Printer className="mr-2 h-4 w-4" /> Print Poster</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics" className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard label="QR scans" value="Local only" hint="Server tracking requires a future event endpoint." />
            <MetricCard label="Registration starts" value={invitationStats.starts} />
            <MetricCard label="Completed" value={invitationStats.completedRegistrations} />
            <MetricCard label="Pending approvals" value={invitationStats.pendingApprovals} />
            <MetricCard label="Rejected" value={0} hint="No rejection status exists yet." />
            <MetricCard label="Conversion rate" value={`${invitationStats.conversion}%`} />
          </div>
          <Card className="glass-card">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base font-sans"><BarChart3 className="h-4 w-4" /> Recent Registrations</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {members.slice(0, 8).map((member: any) => (
                <div key={member.id} className="flex items-center justify-between rounded-2xl border border-border/70 p-3">
                  <span className="font-medium">{member.full_name}</span>
                  <span className="text-sm text-muted-foreground">{member.created_at ? new Date(member.created_at).toLocaleDateString() : "Recently"}</span>
                </div>
              ))}
              {members.length === 0 ? <p className="text-sm text-muted-foreground">Recent public registrations will appear here.</p> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="grid gap-5 lg:grid-cols-2">
          <Card className="glass-card">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base font-sans"><Settings className="h-4 w-4" /> Invitation Settings</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              {[
                ["Public registration enabled", publicRegistrationEnabled, (checked: boolean) => updateMetadata({ public_registration_enabled: checked })],
                ["Approval required", approvalRequired, (checked: boolean) => updateMetadata({ public_registration_approval_required: checked })],
                ["Allow guest registration", allowGuestRegistration, (checked: boolean) => updateMetadata({ allow_guest_registration: checked })],
                ["Require email verification", requireEmailVerification, (checked: boolean) => updateMetadata({ require_email_verification: checked })],
              ].map(([label, checked, onChange]) => (
                <div key={label as string} className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 p-4">
                  <Label>{label as string}</Label>
                  <Switch checked={checked as boolean} onCheckedChange={onChange as (checked: boolean) => void} />
                </div>
              ))}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Invitation expiry days</Label>
                  <Input type="number" min={1} max={90} defaultValue={invitationExpiryDays} onBlur={(event) => updateMetadata({ invitation_expiry_days: Number(event.target.value) || 7 })} />
                </div>
                <div className="space-y-2">
                  <Label>Maximum registrations</Label>
                  <Input type="number" min={0} defaultValue={maximumRegistrations} onBlur={(event) => updateMetadata({ maximum_public_registrations: Number(event.target.value) || 0 })} />
                  <p className="text-xs text-muted-foreground">0 means no configured limit.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader><CardTitle className="text-base font-sans">Public Link</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Current slug</p>
              <Input value={publicSlug || "No slug"} readOnly />
              <Button variant="outline" onClick={regeneratePublicLink} disabled={churchLoading || updateChurch.isPending}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerate public invite slug
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-5">
            {roleOptions.map((role) => (
              <MetricCard key={role} label={roleLabel(role)} value={memberRoles.filter((item) => item.role === role).length} />
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Input
              value={roleSearch}
              onChange={(event) => setRoleSearch(event.target.value)}
              placeholder="Search staff by name"
              aria-label="Search staff by name"
              className="sm:max-w-sm"
            />
            <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
              <DialogTrigger asChild><Button><UserPlus className="mr-2 h-4 w-4" /> Assign Role</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-serif">Assign Role to Linked Member</DialogTitle></DialogHeader>
                <form onSubmit={(event) => { event.preventDefault(); assignRole.mutate(undefined); }} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Member</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger><SelectValue placeholder="Select linked member" /></SelectTrigger>
                      <SelectContent>
                        {linkedMembers.map((member: any) => <SelectItem key={member.user_id} value={member.user_id}>{member.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((role) => <SelectItem key={role} value={role}>{roleLabel(role)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={assignRole.isPending || !selectedUserId}>
                      {assignRole.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Assign Role
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          {rolesLoading ? (
            <Card><CardContent className="py-12"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></CardContent></Card>
          ) : staffUsers.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No linked staff match your search.</CardContent></Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {staffUsers.map((staff: any) => (
                <Card key={staff.user_id} className="glass-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4 text-primary" />{staff.full_name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="mb-2 text-sm font-medium">Roles</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {roleOptions.map((role) => {
                          const assignment = staff.assignments.find((item: RoleAssignmentRow) => item.role === role);
                          const checked = Boolean(assignment);
                          return (
                            <label key={role} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                              <Checkbox
                                checked={checked}
                                disabled={assignRole.isPending || deleteRole.isPending}
                                aria-label={`${checked ? "Remove" : "Assign"} ${roleLabel(role)} for ${staff.full_name}`}
                                onCheckedChange={(next) => {
                                  if (next === true) assignRole.mutate({ userId: staff.user_id, role });
                                  else if (assignment) deleteRole.mutate(assignment.id);
                                }}
                              />
                              {roleLabel(role)}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-medium">Effective permissions</p>
                      <div className="flex flex-wrap gap-2">
                        {staff.effectivePermissions.length > 0
                          ? staff.effectivePermissions.map((permission: string) => <Badge key={permission} variant="secondary"><Check className="mr-1 h-3 w-3" />{permission}</Badge>)
                          : <span className="text-sm text-muted-foreground">No feature access inherited from assigned roles.</span>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
