import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Phone, Mail, Calendar, Building2, BookOpen, Heart, HandCoins, Loader2, Send, User, MessageCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useBillingAccess } from "@/hooks/use-billing-access";
import { formatTZS } from "@/lib/currency";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MemberForm } from "@/components/MemberForm";
import { v4 as uuidv4 } from "uuid";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { readOfflineCache, withOfflineCache } from "@/lib/offline-cache";
import { getEdgeFunctionErrorMessage } from "@/lib/edge-function-error";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";
import { PaginationFooter } from "@/components/ui/pagination-footer";
import { fetchChurchMessageTemplate, renderChurchMessageTemplate } from "@/lib/church-message-templates";
import { openWhatsAppShare } from "@/lib/whatsapp-share";

type MemberRow = Tables<"members">;
type InviteInsert = TablesInsert<"invitations">;
type ChurchScopedRecord = { id: string; name: string };
type MemberContext = Pick<Tables<"members">, "id" | "church_id" | "user_id">;

function filterMembersBySearch(members: MemberRow[], search: string) {
  const term = search.trim().toLowerCase();
  if (!term) return members;

  return members.filter((member) =>
    member.full_name?.toLowerCase().includes(term) ||
    member.email?.toLowerCase().includes(term) ||
    member.phone?.toLowerCase().includes(term)
  );
}

export default function MembersPage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailMember, setDetailMember] = useState<MemberRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<MemberRow | null>(null);
  const [sendingInviteId, setSendingInviteId] = useState<string | null>(null);
  const [invitedMemberIds, setInvitedMemberIds] = useState<string[]>([]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value), []);
  const { churchId, user, isLoading: authLoading } = useAuth();
  const { isOnline } = useNetworkStatus();
  const billing = useBillingAccess();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: church } = useQuery({
    queryKey: ["members-page-church", churchId],
    queryFn: async () => {
      if (!churchId) return null;
      const { data, error } = await supabase.from("churches").select("name").eq("id", churchId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!churchId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: birthdayTemplate } = useQuery({
    queryKey: ["church-message-template", churchId, "birthday_wish"],
    queryFn: () => fetchChurchMessageTemplate(churchId, "birthday_wish"),
    enabled: !!churchId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: anniversaryTemplate } = useQuery({
    queryKey: ["church-message-template", churchId, "wedding_anniversary_wish"],
    queryFn: () => fetchChurchMessageTemplate(churchId, "wedding_anniversary_wish"),
    enabled: !!churchId,
    staleTime: 5 * 60 * 1000,
  });

  const shareMemberMessage = useCallback((member: MemberRow, type: "birthday" | "anniversary") => {
    const template = type === "birthday" ? birthdayTemplate : anniversaryTemplate;
    if (!template) return;

    openWhatsAppShare(
      renderChurchMessageTemplate(template, {
        church_name: church?.name,
        member_name: member.full_name,
        date: new Date().toLocaleDateString("en-TZ"),
      }),
    );
  }, [anniversaryTemplate, birthdayTemplate, church?.name]);

  const {
    data: memberContext,
    isLoading: memberContextLoading,
    error: memberContextError,
  } = useQuery({
    queryKey: ["member-context", user?.id, churchId],
    queryFn: async () => {
      if (!user) return null;

      let query = supabase
        .from("members")
        .select("id, church_id, user_id")
        .eq("user_id", user.id);

      if (churchId) {
        query = query.eq("church_id", churchId);
      }

      const { data, error } = await query
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching member context:", error);
        throw error;
      }

      return (data ?? null) as MemberContext | null;
    },
    enabled: !!user,
  });

  const trustedChurchId = churchId ?? memberContext?.church_id ?? null;
  const membersCacheKey = trustedChurchId ? `offline-cache:members:${trustedChurchId}` : null;
  const communitiesCacheKey = trustedChurchId ? `offline-cache:members-communities:${trustedChurchId}` : null;
  const ministriesCacheKey = trustedChurchId ? `offline-cache:members-ministries:${trustedChurchId}` : null;
  const familiesCacheKey = trustedChurchId ? `offline-cache:members-families:${trustedChurchId}` : null;
  const canAccessMemberData = !!user && !!trustedChurchId;
  const [memberTotalCount, setMemberTotalCount] = useState(0);
  const memberPagination = usePaginatedQuery({
    totalCount: memberTotalCount,
    resetKey: `${trustedChurchId ?? "none"}:${search}`,
  });

  useEffect(() => {
    if (memberContextError) {
      toast({
        title: "Unable to load member context",
        description: "We couldn't verify your member access right now.",
        variant: "destructive",
      });
    }
  }, [memberContextError, toast]);

  // Queries
  const {
    data: membersPage = { rows: [] as MemberRow[], count: 0 },
    isLoading,
    error: membersError,
  } = useQuery({
    queryKey: ["members", trustedChurchId, search, memberPagination.page, memberPagination.pageSize],
    queryFn: async () => {
      if (!canAccessMemberData) return { rows: [] as MemberRow[], count: 0 };
      const cachedMembers = readOfflineCache(membersCacheKey, [] as MemberRow[])
        .filter((member) => member.church_id === trustedChurchId);
      if (!isOnline) {
        const filteredMembers = filterMembersBySearch(cachedMembers, search);
        return {
          rows: filteredMembers.slice(memberPagination.from, memberPagination.to + 1),
          count: filteredMembers.length,
        };
      }
      return withOfflineCache(
        `${membersCacheKey}:${search}:${memberPagination.page}:${memberPagination.pageSize}`,
        async () => {
          const term = search.trim().replace(/[,()]/g, " ");
          let query = supabase
            .from("members")
            .select("*", { count: "exact" })
            .eq("church_id", trustedChurchId)
            .order("created_at", { ascending: false });

          if (term) {
            query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
          }

          const { data, error, count } = await query.range(memberPagination.from, memberPagination.to);

          if (error) {
            console.error("Error fetching members:", error);
            throw error;
          }
          return { rows: (data ?? []) as MemberRow[], count: count ?? 0 };
        },
        {
          rows: filterMembersBySearch(cachedMembers, search).slice(memberPagination.from, memberPagination.to + 1),
          count: filterMembersBySearch(cachedMembers, search).length,
        },
      );
    },
    enabled: canAccessMemberData,
  });
  const members = membersPage.rows;

  useEffect(() => {
    setMemberTotalCount(membersPage.count);
  }, [membersPage.count]);

  const pageMemberIds = useMemo(() => members.map((member) => member.id), [members]);

  const { data: communities = [] } = useQuery({
    queryKey: ["communities-list", trustedChurchId],
    queryFn: async () => {
      if (!canAccessMemberData) return [];
      const cachedCommunities = readOfflineCache(communitiesCacheKey, [] as ChurchScopedRecord[]);
      if (!isOnline) {
        return cachedCommunities;
      }
      return withOfflineCache(
        communitiesCacheKey,
        async () => {
          const { data, error } = await supabase
            .from("communities")
            .select("id, name")
            .eq("church_id", trustedChurchId)
            .order("name");

          if (error) {
            console.warn("Community details unavailable on members page.", error);
            return cachedCommunities;
          }
          return (data ?? []) as ChurchScopedRecord[];
        },
        cachedCommunities,
      );
    },
    enabled: canAccessMemberData,
  });

  const { data: ministries = [] } = useQuery({
    queryKey: ["ministries-list", trustedChurchId],
    queryFn: async () => {
      if (!canAccessMemberData) return [];
      const cachedMinistries = readOfflineCache(ministriesCacheKey, [] as ChurchScopedRecord[]);
      if (!isOnline) {
        return cachedMinistries;
      }
      return withOfflineCache(
        ministriesCacheKey,
        async () => {
          const { data, error } = await supabase
            .from("ministries")
            .select("id, name")
            .eq("church_id", trustedChurchId)
            .order("name");

          if (error) {
            console.warn("Ministry details unavailable on members page.", error);
            return cachedMinistries;
          }
          return (data ?? []) as ChurchScopedRecord[];
        },
        cachedMinistries,
      );
    },
    enabled: canAccessMemberData,
  });

  const { data: families = [] } = useQuery({
    queryKey: ["families-list", trustedChurchId],
    queryFn: async () => {
      if (!canAccessMemberData) return [];
      const cachedFamilies = readOfflineCache(familiesCacheKey, [] as ChurchScopedRecord[]);
      if (!isOnline) {
        return cachedFamilies;
      }
      return withOfflineCache(
        familiesCacheKey,
        async () => {
          const { data, error } = await supabase
            .from("families")
            .select("id, name")
            .eq("church_id", trustedChurchId)
            .order("name");

          if (error) {
            console.warn("Family details unavailable on members page.", error);
            return cachedFamilies;
          }

          return (data ?? []) as ChurchScopedRecord[];
        },
        cachedFamilies,
      );
    },
    enabled: canAccessMemberData,
  });

  const { data: communityMemberships = [] } = useQuery({
    queryKey: ["community-memberships", trustedChurchId, pageMemberIds],
    queryFn: async () => {
      if (!canAccessMemberData || communities.length === 0 || pageMemberIds.length === 0) return [];
      const { data, error } = await supabase
        .from("member_communities")
        .select("member_id, community_id")
        .in("member_id", pageMemberIds);
      if (error) {
        console.warn("Community memberships unavailable on members page.", error);
        return [];
      }
      return data ?? [];
    },
    enabled: canAccessMemberData && communities.length > 0 && pageMemberIds.length > 0,
  });

  const { data: ministryMemberships = [] } = useQuery({
    queryKey: ["ministry-memberships", trustedChurchId, pageMemberIds],
    queryFn: async () => {
      if (!canAccessMemberData || ministries.length === 0 || pageMemberIds.length === 0) return [];
      const { data, error } = await supabase
        .from("member_ministries")
        .select("member_id, ministry_id")
        .in("member_id", pageMemberIds);
      if (error) {
        console.warn("Ministry memberships unavailable on members page.", error);
        return [];
      }
      return data ?? [];
    },
    enabled: canAccessMemberData && ministries.length > 0 && pageMemberIds.length > 0,
  });

  const { data: familyMemberships = [] } = useQuery({
    queryKey: ["family-memberships", trustedChurchId, pageMemberIds],
    queryFn: async () => {
      if (!canAccessMemberData || families.length === 0 || pageMemberIds.length === 0) return [];
      const { data, error } = await supabase
        .from("members")
        .select("id, family_id, family_role")
        .eq("church_id", trustedChurchId)
        .not("family_id", "is", null)
        .in("id", pageMemberIds);

      if (error) {
        console.warn("Family memberships unavailable on members page.", error);
        return [];
      }

      return (data ?? []).map((member) => ({
        member_id: member.id,
        family_id: member.family_id,
        role: member.family_role,
      }));
    },
    enabled: canAccessMemberData && families.length > 0 && pageMemberIds.length > 0,
  });

  const { data: memberContributions = [] } = useQuery({
    queryKey: ["member-contributions", trustedChurchId, detailMember?.id],
    queryFn: async () => {
      if (!canAccessMemberData || !detailMember) return [];
      const { data, error } = await supabase
        .from("contributions")
        .select("id, member_id, amount, created_at, donor_name, notes, contribution_categories!contributions_category_id_fkey(name)")
        .eq("church_id", trustedChurchId)
        .eq("member_id", detailMember.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Contribution details unavailable on members page.", error);
        return [];
      }

      return data ?? [];
    },
    enabled: canAccessMemberData && !!detailMember,
  });

  useEffect(() => {
    if (membersError) {
      toast({
        title: "Unable to load members",
        description: "The member list could not be loaded. Please try again.",
        variant: "destructive",
      });
    }
  }, [membersError, toast]);

  const getMemberCommunity = (memberId: string) => communityMemberships.find((cm: any) => cm.member_id === memberId);
  const getMemberMinistry = (memberId: string) => ministryMemberships.find((mm: any) => mm.member_id === memberId);
  const getMemberCommunityIds = (memberId: string) => communityMemberships
    .filter((cm: any) => cm.member_id === memberId)
    .map((cm: any) => cm.community_id);
  const getMemberMinistryIds = (memberId: string) => ministryMemberships
    .filter((mm: any) => mm.member_id === memberId)
    .map((mm: any) => mm.ministry_id);
  const getMemberFamily = (memberId: string) => familyMemberships.find((fm: any) => fm.member_id === memberId);
  const getCommunityName = (communityId?: string | null) =>
    communities.find((community: any) => community.id === communityId)?.name ?? "None";
  const getMinistryName = (ministryId?: string | null) =>
    ministries.find((ministry: any) => ministry.id === ministryId)?.name ?? "None";
  const getFamilyName = (familyId?: string | null) =>
    families.find((family: any) => family.id === familyId)?.name ?? "None";
  const getMemberContribs = (memberId: string) => memberContributions.filter((c: any) => c.member_id === memberId);

  const openEdit = (m: MemberRow) => {
    setEditingMember(m);
    setEditDialogOpen(true);
  };

  const sendInvite = useCallback(async (member: MemberRow) => {
    if (!trustedChurchId || invitedMemberIds.includes(member.id)) return;

    if (!member.email?.trim()) {
      toast({ title: "Error", description: "This member needs an email address before you can send an invite.", variant: "destructive" });
      return;
    }

    setSendingInviteId(member.id);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      const currentUserId = authData.user?.id;
      if (!currentUserId) throw new Error("No logged in user found");

      const token = uuidv4();
      const invitePayload: InviteInsert = {
        email: member.email.trim().toLowerCase(),
        church_id: trustedChurchId,
        token,
        invited_by: currentUserId,
        role: "member",
        status: "pending",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const { error: inviteError } = await supabase
        .from("invitations")
        .insert(invitePayload);

      if (inviteError) throw inviteError;

      let emailFailed = false;
      let emailFailureMessage = "";

      try {
        const { error: sendError } = await supabase.functions.invoke("send-invitation", {
          body: {
            email: member.email.trim().toLowerCase(),
            token,
          },
        });

        if (sendError) {
          emailFailed = true;
          emailFailureMessage = await getEdgeFunctionErrorMessage(sendError, "The email service rejected this request.");
          console.error("Invitation email failed:", sendError);
        }
      } catch (error) {
        emailFailed = true;
        emailFailureMessage = await getEdgeFunctionErrorMessage(error, "The email service rejected this request.");
        console.error("Invitation email failed:", error);
      }

      setInvitedMemberIds((current) => current.includes(member.id) ? current : [...current, member.id]);
      toast({
        title: emailFailed ? "Invite saved, email not sent" : "Invite sent successfully",
        description: emailFailed
          ? `The invitation was created successfully, but the email could not be sent: ${emailFailureMessage}`
          : undefined,
        variant: emailFailed ? "destructive" : undefined,
      });
    } catch (err: any) {
      console.error("Invite flow failed:", err);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSendingInviteId(null);
    }
  }, [trustedChurchId, invitedMemberIds, toast]);

  const filtered = members;

  const memberCount = memberTotalCount;
  const usageRatio = billing.memberLimit ? memberCount / billing.memberLimit : 0;
  const nearLimit = billing.memberLimit !== null && usageRatio >= 0.9;
  const limitReached = billing.memberLimit !== null && memberCount >= billing.memberLimit;

  const statusColor = useCallback((s: string) => {
    if (s === "active") return "bg-success/20 text-success border-success/30";
    if (s === "pending") return "bg-warning/20 text-warning border-warning/30";
    return "bg-muted text-muted-foreground border-border";
  }, []);

  const memberRows = useMemo(() => {
    if (isLoading) return null;
    if (filtered.length === 0) return null;

    return filtered.map((m: MemberRow) => (
      <TableRow key={m.id} className="border-border">
        <TableCell>
          <button onClick={() => setDetailMember(m)} className="flex items-center gap-2 hover:text-primary transition-colors text-left font-medium">
            <Avatar className="h-7 w-7">
              <AvatarImage src={m.photo_url} loading="lazy" />
              <AvatarFallback className="text-xs gradient-gold text-primary-foreground">{m.full_name?.charAt(0)}</AvatarFallback>
            </Avatar>
            {m.full_name}
          </button>
        </TableCell>
        <TableCell className="text-muted-foreground">{m.email || "—"}</TableCell>
        <TableCell className="text-muted-foreground">{m.phone || "—"}</TableCell>
        <TableCell className="text-muted-foreground capitalize">{m.gender || "—"}</TableCell>
        <TableCell><Badge variant="outline" className={statusColor(m.status)}>{m.status}</Badge></TableCell>
        <TableCell className="text-muted-foreground">{m.created_at ? new Date(m.created_at).toLocaleDateString() : "—"}</TableCell>
        <TableCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(m)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={() => sendInvite(m)} disabled={sendingInviteId === m.id || invitedMemberIds.includes(m.id)}>
                {sendingInviteId === m.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {invitedMemberIds.includes(m.id) ? "Invited" : "Send Invite"}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteConfirm(m.id)}><Trash2 className="mr-2 h-4 w-4" /> Remove</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    ));
  }, [filtered, invitedMemberIds, isLoading, openEdit, sendInvite, sendingInviteId, setDetailMember, setDeleteConfirm, statusColor]);



  // Member detail modal
  const DetailModal = useMemo(() => {
    return () => {
      if (!detailMember) return null;
      const m = detailMember;
      const cm = getMemberCommunity(m.id);
      const mm = getMemberMinistry(m.id);
      const fm = getMemberFamily(m.id);
      const contribs = getMemberContribs(m.id);
      const totalContrib = contribs.reduce((s: number, c: any) => s + (c.amount || 0), 0);

      return (
        <Dialog open={!!detailMember} onOpenChange={(o) => { if (!o) setDetailMember(null); }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-serif">Member Profile</DialogTitle></DialogHeader>
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-start gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={m.photo_url} loading="lazy" />
                  <AvatarFallback className="text-lg gradient-gold text-primary-foreground">{m.full_name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-bold font-serif">{m.full_name}</h3>
                  <Badge variant="outline" className={statusColor(m.status)}>{m.status}</Badge>
                  <div className="flex gap-4 mt-3 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => { setDetailMember(null); openEdit(m); }}><Pencil className="mr-2 h-3 w-3" /> Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => sendInvite(m)} disabled={sendingInviteId === m.id || invitedMemberIds.includes(m.id)}>
                      {sendingInviteId === m.id ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Send className="mr-2 h-3 w-3" />}
                      {invitedMemberIds.includes(m.id) ? "Invited" : "Send Invite"}
                    </Button>
                    {m.date_of_birth && (
                      <Button size="sm" variant="outline" onClick={() => shareMemberMessage(m, "birthday")}>
                        <MessageCircle className="mr-2 h-3 w-3" /> Share Birthday Wish to WhatsApp
                      </Button>
                    )}
                    {m.wedding_date && (
                      <Button size="sm" variant="outline" onClick={() => shareMemberMessage(m, "anniversary")}>
                        <MessageCircle className="mr-2 h-3 w-3" /> Share Anniversary Wish to WhatsApp
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={() => setDeleteConfirm(m.id)}><Trash2 className="mr-2 h-3 w-3" /> Remove</Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" /> {m.email || "No email"}</div>
                <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" /> {m.phone || "No phone"}</div>
                <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-4 w-4" /> Joined: {m.created_at ? new Date(m.created_at).toLocaleDateString() : "—"}</div>
                <div className="flex items-center gap-2 text-muted-foreground capitalize"><User className="h-4 w-4" /> {m.gender || "—"}</div>
                <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-4 w-4" /> Birthdate: {m.date_of_birth ? new Date(m.date_of_birth).toLocaleDateString() : "—"}</div>
                <div className="flex items-center gap-2 text-muted-foreground"><Building2 className="h-4 w-4" /> Jumuiya: {getCommunityName((cm as any)?.community_id)}</div>
                <div className="flex items-center gap-2 text-muted-foreground"><BookOpen className="h-4 w-4" /> Ministry: {getMinistryName((mm as any)?.ministry_id)}</div>
                <div className="flex items-center gap-2 text-muted-foreground"><Heart className="h-4 w-4" /> Family: {getFamilyName((fm as any)?.family_id)} {fm ? `(${(fm as any).role})` : ""}</div>
                <div className="flex items-center gap-2 text-muted-foreground"><HandCoins className="h-4 w-4" /> Total: {formatTZS(totalContrib)}</div>
              </div>

              {/* Recent contributions */}
              {contribs.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold mb-3">Recent Contributions</h4>
                    <div className="space-y-2">
                      {contribs.slice(0, 10).map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between text-sm p-2 rounded bg-secondary/50">
                          <div>
                            <span className="font-medium">{(c as any).contribution_categories?.name || "Uncategorized"}</span>
                            <span className="text-muted-foreground ml-2">{c.notes || ""}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-medium text-primary">{formatTZS(c.amount)}</span>
                            <span className="text-muted-foreground text-xs ml-2">{new Date(c.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      );
    };
  }, [detailMember, getMemberCommunity, getMemberMinistry, getMemberFamily, getCommunityName, getMinistryName, getFamilyName, getMemberContribs, invitedMemberIds, statusColor, openEdit, sendInvite, sendingInviteId, setDetailMember, setDeleteConfirm, shareMemberMessage]);

  if (authLoading || memberContextLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Card className="glass-card">
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading members...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Card className="glass-card">
          <CardContent className="py-12 text-center text-muted-foreground">
            You need to sign in to view members.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!trustedChurchId) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Card className="glass-card">
          <CardContent className="py-12 text-center text-muted-foreground">
            No member record was found for your account. You don’t have access to this page yet.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif">Members</h1>
          <p className="text-sm text-muted-foreground mt-1">{memberTotalCount} total members</p>
          <p className="text-xs text-muted-foreground mt-1">
            {billing.memberLimit === null ? `${memberCount} members / Unlimited` : `${memberCount} / ${billing.memberLimit} members`}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); }}>
          <DialogTrigger asChild><Button size="sm" disabled={limitReached}><Plus className="mr-2 h-4 w-4" /> Add Member</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="font-serif">Add New Member</DialogTitle></DialogHeader>
            <MemberForm
              isEdit={false}
              churchId={trustedChurchId}
              communities={communities}
              ministries={ministries}
              selectedCommunityIds={[]}
              selectedMinistryIds={[]}
              onSuccess={() => setDialogOpen(false)}
              onCancel={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card className={`glass-card ${nearLimit ? "border-primary/30" : ""}`}>
        <CardContent className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium">Member usage</p>
            <p className="text-sm text-muted-foreground">
              {billing.memberLimit === null ? `${memberCount} members / Unlimited` : `${memberCount} / ${billing.memberLimit} members`}
            </p>
          </div>
          {billing.isTrial ? (
            <Badge className="gradient-gold text-primary-foreground">Trial includes unlimited members</Badge>
          ) : limitReached ? (
            <Badge variant="outline" className="border-destructive/30 text-destructive">
              You have reached your member limit. Upgrade your plan to add more members.
            </Badge>
          ) : nearLimit ? (
            <Badge variant="outline" className="border-primary/30 text-primary">
              Approaching limit - Upgrade to unlock more capacity
            </Badge>
          ) : (
            <Badge variant="outline">Within plan limit</Badge>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardContent className="p-0">
          <div className="p-4 border-b border-border">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search members..." className="pl-9 bg-secondary border-border/50" value={search} onChange={handleSearchChange} />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  {search ? "No members match your search" : "No members found or you don’t have access"}
                </TableCell></TableRow>
              ) : memberRows}
            </TableBody>
          </Table>
          <PaginationFooter
            page={memberPagination.page}
            pageSize={memberPagination.pageSize}
            totalCount={memberPagination.totalCount}
            hasPreviousPage={memberPagination.hasPreviousPage}
            hasNextPage={memberPagination.hasNextPage}
            previousPage={memberPagination.previousPage}
            nextPage={memberPagination.nextPage}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(o) => { setEditDialogOpen(o); if (!o) { setEditingMember(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-serif">Edit Member</DialogTitle></DialogHeader>
          <MemberForm
            isEdit={true}
            member={editingMember}
            churchId={trustedChurchId}
            communities={communities}
            ministries={ministries}
            selectedCommunityIds={editingMember ? getMemberCommunityIds(editingMember.id) : []}
            selectedMinistryIds={editingMember ? getMemberMinistryIds(editingMember.id) : []}
            onSuccess={() => { setEditDialogOpen(false); setEditingMember(null); }}
            onCancel={() => { setEditDialogOpen(false); setEditingMember(null); }}
          />
        </DialogContent>
      </Dialog>

      <DetailModal />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The member record will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteConfirm) return;
                try {
                  const { error } = await supabase.from("members").delete().eq("id", deleteConfirm).eq("church_id", trustedChurchId);
                  if (error) throw error;
                  queryClient.invalidateQueries({ queryKey: ["members"] });
                  toast({ title: "Member removed" });
                  setDeleteConfirm(null);
                  setDetailMember(null);
                } catch (err: any) {
                  console.error("Member deletion failed:", err);
                  toast({ title: "Error", description: err.message, variant: "destructive" });
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
