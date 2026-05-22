import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, UserPlus, Mail, Loader2, RefreshCw, Trash2, Send, Check, ChevronsUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";

const appRoles: { label: string; value: string }[] = [
  { label: "Church Admin", value: "church_admin" },
  { label: "Pastor", value: "pastor" },
  { label: "Secretary", value: "secretary" },
  { label: "Treasurer", value: "treasurer" },
  { label: "Member", value: "member" },
];

type InvitationRow = Tables<"invitations">;
type InvitationInsert = TablesInsert<"invitations">;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export default function RolesPage() {
  const { churchId, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // --- Roles ---
  const { data: memberRoles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["church-roles", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("*, profiles:user_id(full_name)")
        .eq("church_id", churchId)
        .order("created_at", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
    enabled: !!churchId,
  });

  // Members for role assignment
  const { data: members = [] } = useQuery({
    queryKey: ["church-members-for-roles", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data } = await supabase.from("members").select("id, full_name, user_id").eq("church_id", churchId).eq("status", "active").order("full_name");
      return data ?? [];
    },
    enabled: !!churchId,
  });

  const deleteRole = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["church-roles"] }); toast({ title: "Role removed" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // --- Manual Role Assignment ---
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState("member");

  const assignRole = useMutation({
    mutationFn: async () => {
      if (!churchId || !selectedUserId) throw new Error("Missing fields");
      // Check for existing role
      const { data: existing } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", selectedUserId)
        .eq("church_id", churchId)
        .maybeSingle();

      if (existing) {
        // Update existing role
        const { error } = await supabase.from("user_roles").update({ role: selectedRole as any }).eq("id", existing.id);
        if (error) throw error;
      } else {
        // Insert new role
        const { error } = await supabase.from("user_roles").insert([{
          user_id: selectedUserId,
          church_id: churchId,
          role: selectedRole as any,
        }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["church-roles"] });
      toast({ title: "Role assigned successfully" });
      setAssignDialogOpen(false);
      setMemberPickerOpen(false);
      setSelectedUserId("");
      setSelectedRole("member");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Members with linked user accounts (only these can have roles)
  const linkedMembers = members.filter((m: any) => m.user_id);
  const selectedMember = useMemo(
    () => linkedMembers.find((member: any) => member.user_id === selectedUserId) ?? null,
    [linkedMembers, selectedUserId],
  );

  // --- Invitations ---
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [debugInviteEmail, setDebugInviteEmail] = useState("kayombotino24@gmail.com");
  const [creatingDebugInvite, setCreatingDebugInvite] = useState(false);

  const { data: invitations = [], isLoading: invLoading } = useQuery({
    queryKey: ["church-invitations", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from("invitations")
        .select("*")
        .eq("church_id", churchId)
        .order("created_at", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
    enabled: !!churchId,
  });

  const createInvitationRecord = async ({
    email,
    role,
    token,
  }: {
    email: string;
    role: string;
    token?: string;
  }) => {
    if (!churchId) {
      throw new Error("Missing church context.");
    }

    const invitationPayload: InvitationInsert = {
      church_id: churchId,
      email: normalizeEmail(email),
      role: role as InvitationInsert["role"],
      invited_by: user?.id ?? null,
      token: token ?? uuidv4(),
      status: "pending",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const { data, error } = await supabase
      .from("invitations")
      .insert(invitationPayload)
      .select("*")
      .single();

    if (error) throw error;
    return data as InvitationRow;
  };

  const sendInvitationEmail = async ({ email, token }: { email: string; token: string }) => {
    try {
      const { data, error } = await supabase.functions.invoke("send-invitation", {
        body: {
          email: normalizeEmail(email),
          token,
        },
      });

      if (error) {
        console.error("Invitation email failed:", error);
        return { sent: false, data: null };
      }

      return { sent: true, data };
    } catch (error) {
      console.error("Invitation email failed:", error);
      return { sent: false, data: null };
    }
  };

  const sendInvite = useMutation({
    mutationFn: async () => {
      if (!churchId || !inviteEmail.trim()) throw new Error("Missing fields");
      const inv = await createInvitationRecord({
        email: inviteEmail,
        role: inviteRole,
      });
      const sendResult = await sendInvitationEmail({
        email: inv.email,
        token: inv.token,
      });
      return { inv, sendResult };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["church-invitations"] });
      const msg = result?.sendResult?.existing_user
        ? `Invitation created. ${inviteEmail} already has an account — share the invite link with them.`
        : `Invitation email sent to ${inviteEmail}`;
      toast({
        title: result.sendResult.sent ? "Invitation sent" : "Invitation saved, email pending",
        description: result.sendResult.sent
          ? msg
          : `The invitation was created for ${result.inv.email}, but the email could not be sent (test mode).`,
      });
      setInviteEmail("");
      setInviteRole("member");
      setInviteDialogOpen(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const resendInviteEmail = async (inv: any) => {
    setSendingEmail(inv.id);
    try {
      // Reset expiry
      await supabase.from("invitations").update({
        status: "pending" as any,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }).eq("id", inv.id);

      const sendResult = await sendInvitationEmail({
        email: inv.email,
        token: inv.token,
      });

      queryClient.invalidateQueries({ queryKey: ["church-invitations"] });
      toast({
        title: sendResult.sent ? "Invitation resent" : "Invitation updated, email pending",
        description: sendResult.sent
          ? `Resent to ${inv.email}`
          : `The invitation was reset for ${inv.email}, but the email could not be sent (test mode).`,
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSendingEmail(null);
    }
  };

  const revokeInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invitations").update({ status: "revoked" as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["church-invitations"] }); toast({ title: "Invitation revoked" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Invite link copied to clipboard" });
  };

  const createDebugInvite = async () => {
    if (!churchId) {
      toast({ title: "Missing church", description: "Church context is required.", variant: "destructive" });
      return;
    }

    if (!debugInviteEmail.trim()) {
      toast({ title: "Missing email", description: "Enter an email address for the debug invite.", variant: "destructive" });
      return;
    }

    setCreatingDebugInvite(true);

    try {
      const normalizedEmail = normalizeEmail(debugInviteEmail);
      const token = "test123";
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: existingInvite, error: existingError } = await supabase
        .from("invitations")
        .select("*")
        .eq("church_id", churchId)
        .eq("email", normalizedEmail)
        .eq("token", token)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      let invitation: InvitationRow;

      if (existingInvite) {
        const { data, error } = await supabase
          .from("invitations")
          .update({
            status: "pending",
            role: "member",
            invited_by: user?.id ?? null,
            expires_at: expiresAt,
          })
          .eq("id", existingInvite.id)
          .select("*")
          .single();

        if (error) throw error;
        invitation = data as InvitationRow;
      } else {
        invitation = await createInvitationRecord({
          email: normalizedEmail,
          role: "member",
          token,
        });
      }

      await sendInvitationEmail({
        email: invitation.email,
        token: invitation.token,
      });

      queryClient.invalidateQueries({ queryKey: ["church-invitations"] });
      toast({
        title: "Debug invite ready",
        description: `Created and sent /invite/${invitation.token} for ${invitation.email}.`,
      });
    } catch (err: any) {
      toast({ title: "Debug invite failed", description: err.message, variant: "destructive" });
    } finally {
      setCreatingDebugInvite(false);
    }
  };

  const invStatusColor = (s: string) => {
    if (s === "accepted") return "bg-primary/20 text-primary border-primary/30";
    if (s === "expired" || s === "revoked") return "bg-muted text-muted-foreground border-border";
    return "bg-accent/20 text-accent border-accent/30";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-serif">Roles & Invitations</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage church roles and invite new members</p>
      </div>

      <Tabs defaultValue="roles">
        <TabsList className="bg-secondary">
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
        </TabsList>

        {/* ROLES TAB */}
        <TabsContent value="roles" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 flex-1">
              {appRoles.map((role) => {
                const count = memberRoles.filter((r: any) => r.role === role.value).length;
                return (
                  <Card key={role.value} className="glass-card text-center">
                    <CardContent className="py-4">
                      <Shield className="h-6 w-6 mx-auto mb-2 text-primary" />
                      <p className="text-sm font-medium">{role.label}</p>
                      <p className="text-xs text-muted-foreground">{count} assigned</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><UserPlus className="mr-2 h-4 w-4" /> Assign Role</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-serif">Assign Role to Member</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); assignRole.mutate(); }} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Member (must have a linked account)</Label>
                    <Popover open={memberPickerOpen} onOpenChange={setMemberPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={memberPickerOpen}
                          className="w-full justify-between"
                        >
                          <span className="truncate">
                            {selectedMember ? selectedMember.full_name : "Search and select a member..."}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search member by name..." />
                          <CommandList>
                            <CommandEmpty>No member found.</CommandEmpty>
                            <CommandGroup>
                              {linkedMembers.map((m: any) => (
                                <CommandItem
                                  key={m.user_id}
                                  value={`${m.full_name} ${m.user_id}`}
                                  onSelect={() => {
                                    setSelectedUserId(m.user_id);
                                    setMemberPickerOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedUserId === m.user_id ? "opacity-100" : "opacity-0",
                                    )}
                                  />
                                  {m.full_name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {linkedMembers.length === 0 && (
                      <p className="text-xs text-muted-foreground">Members need to accept an invitation first to have a linked account.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {appRoles.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
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

          <Card className="glass-card">
            <CardHeader><CardTitle className="text-base font-sans">Current Assignments</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rolesLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-12"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                  ) : memberRoles.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">No role assignments yet.</TableCell></TableRow>
                  ) : memberRoles.map((mr: any) => (
                    <TableRow key={mr.id} className="border-border">
                      <TableCell className="font-medium">{mr.profiles?.full_name || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">{mr.role?.replace("_", " ")}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{new Date(mr.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteRole.mutate(mr.id)} disabled={deleteRole.isPending}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* INVITATIONS TAB */}
        <TabsContent value="invitations" className="mt-4 space-y-4">
          {import.meta.env.DEV && (
            <Card className="glass-card border-dashed">
              <CardHeader>
                <CardTitle className="text-base font-sans">Debug Invite Tools</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="debug-invite-email">Debug email</Label>
                  <Input
                    id="debug-invite-email"
                    type="email"
                    placeholder="member@example.com"
                    value={debugInviteEmail}
                    onChange={(event) => setDebugInviteEmail(event.target.value)}
                  />
                </div>
                <Button onClick={createDebugInvite} disabled={creatingDebugInvite || !churchId}>
                  {creatingDebugInvite ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Create test123 invite
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild><Button size="sm"><Mail className="mr-2 h-4 w-4" /> Invite Member</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-serif">Send Invitation</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); sendInvite.mutate(); }} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input type="email" placeholder="member@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {appRoles.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
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
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-12"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                  ) : invitations.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      <Mail className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                      No invitations sent yet.
                    </TableCell></TableRow>
                  ) : invitations.map((inv: any) => (
                    <TableRow key={inv.id} className="border-border">
                      <TableCell className="font-medium">{inv.email}</TableCell>
                      <TableCell><Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">{inv.role?.replace("_", " ")}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className={invStatusColor(inv.status)}>{inv.status}</Badge></TableCell>
                      <TableCell className="text-muted-foreground text-sm">{new Date(inv.expires_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" title="Copy link" onClick={() => copyInviteLink(inv.token)}>
                            Link
                          </Button>
                          {(inv.status === "pending" || inv.status === "expired") && (
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7" title="Resend"
                              onClick={() => resendInviteEmail(inv)}
                              disabled={sendingEmail === inv.id}
                            >
                              {sendingEmail === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                          {inv.status === "pending" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Revoke" onClick={() => revokeInvite.mutate(inv.id)} disabled={revokeInvite.isPending}>
                              <Trash2 className="h-3.5 w-3.5" />
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
      </Tabs>
    </div>
  );
}
