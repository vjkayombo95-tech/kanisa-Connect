import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatTZS } from "@/lib/currency";
import { useBillingAccess } from "@/hooks/use-billing-access";
import { useLedCommunities } from "@/hooks/use-community-leader";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { COMMUNITY_HELP_SELECT, MASS_INTENTION_SELECT, enrichCommunityHelpRequests, mapMassIntentionRecord } from "@/lib/member-linked-requests";
import { useMemberPledges } from "@/lib/pledges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  User, Mail, Phone, Calendar, Shield, Users, Church, Heart,
  HandCoins, TrendingUp, ArrowRight, BookOpen, Megaphone, Flame,
  HelpCircle, FileText, Search, ChevronLeft, ChevronRight, Wallet,
  MapPin, Clock, Star, Gift, BarChart3, PieChart, Pencil, Loader2, Lock, Building2, Target,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, PieChart as RPieChart, Pie, Cell } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { optimizeImage, uploadFile, validateFile } from "@/lib/file-upload";
import { useTranslation } from "react-i18next";
import { translateContributionCategory } from "@/lib/translation-helpers";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 160 60% 45%))",
  "hsl(var(--chart-3, 30 80% 55%))",
  "hsl(var(--chart-4, 280 65% 60%))",
  "hsl(var(--chart-5, 340 75% 55%))",
  "hsl(200 70% 50%)",
];

const PAGE_SIZE = 10;
const DASHBOARD_QUERY_OPTIONS = {
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  staleTime: 5 * 60 * 1000,
};

const ADMIN_ROLE_KEYS = new Set(["church_admin", "pastor", "secretary", "treasurer", "admin"]);

function formatRoleLabel(role: string) {
  const normalizedRole = role.trim().toLowerCase();

  switch (normalizedRole) {
    case "member":
      return "Member";
    case "jumuiya_leader":
    case "community_leader":
      return "Jumuiya Leader";
    case "ministry_leader":
      return "Ministry Leader";
    case "church_admin":
    case "admin":
      return "Admin";
    case "pastor":
      return "Pastor";
    case "secretary":
      return "Secretary";
    case "treasurer":
      return "Treasurer";
    default:
      return normalizedRole.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}

// ─── Hooks ────────────────────────────────────────────────────
function useMemberRecord() {
  const { user, churchId } = useAuth();
  return useQuery({
    queryKey: ["my-member-record", user?.id, user?.email, churchId],
    queryFn: async () => {
      if (!user || !churchId) return null;

      const { data: linkedMember } = await supabase
        .from("members")
        .select("*")
        .eq("user_id", user.id)
        .eq("church_id", churchId)
        .maybeSingle();

      if (linkedMember) {
        return linkedMember;
      }

      const normalizedEmail = user.email?.trim().toLowerCase();
      if (!normalizedEmail) return null;

      const { data: emailMember } = await supabase
        .from("members")
        .select("*")
        .ilike("email", normalizedEmail)
        .eq("church_id", churchId)
        .maybeSingle();

      return emailMember ?? null;
    },
    enabled: !!user && !!churchId,
    ...DASHBOARD_QUERY_OPTIONS,
  });
}

function useMemberCommunity(member: any | null | undefined) {
  return useQuery({
    queryKey: ["my-community", member?.id, member?.community_id, member?.church_id],
    queryFn: async () => {
      if (!member?.id) return null;

      let community: any | null = null;

      if (member.community_id) {
        const { data } = await supabase
          .from("communities")
          .select("id, name, description, leader_id, mwenyekiti_id, makamu_mwenyekiti_id, mweka_hazina_id, katibu_id")
          .eq("id", member.community_id)
          .maybeSingle();

        community = data ?? null;
      }

      if (!community) {
        const { data } = await supabase
          .from("member_communities")
          .select("community_id, communities(id, name, description, leader_id, mwenyekiti_id, makamu_mwenyekiti_id, mweka_hazina_id, katibu_id)")
          .eq("member_id", member.id)
          .limit(1)
          .maybeSingle();

        community = (data?.communities as any) ?? null;
      }

      if (!community && member.church_id) {
        const { data } = await supabase
          .from("communities")
          .select("id, name, description, leader_id, mwenyekiti_id, makamu_mwenyekiti_id, mweka_hazina_id, katibu_id")
          .eq("church_id", member.church_id)
          .or([
            `leader_id.eq.${member.id}`,
            `mwenyekiti_id.eq.${member.id}`,
            `makamu_mwenyekiti_id.eq.${member.id}`,
            `mweka_hazina_id.eq.${member.id}`,
            `katibu_id.eq.${member.id}`,
          ].join(","))
          .limit(1)
          .maybeSingle();

        community = data ?? null;
      }

      if (!community) return null;

      // Try to get leader name
      let leaderName: string | null = null;
      const leaderId = community?.mwenyekiti_id ?? community?.leader_id;
      if (leaderId) {
        const { data: ldr } = await supabase.from("members").select("full_name").eq("id", leaderId).maybeSingle();
        leaderName = ldr?.full_name ?? null;
      }
      return { ...community, leaderName };
    },
    enabled: !!member?.id,
    ...DASHBOARD_QUERY_OPTIONS,
  });
}

function useMemberMinistries(member: any | null | undefined) {
  return useQuery({
    queryKey: ["my-ministries", member?.id, member?.ministry_id],
    queryFn: async () => {
      if (!member?.id) return [];

      const { data } = await supabase
        .from("member_ministries")
        .select("ministry_id, ministries(id, name, description)")
        .eq("member_id", member.id)
        .order("created_at", { ascending: true });

      const joinTableMinistries = (data ?? [])
        .map((row: any) => row.ministries as any)
        .filter(Boolean);

      const joinedIds = new Set(
        joinTableMinistries
          .map((ministry: any) => ministry?.id)
          .filter(Boolean),
      );

      if (member.ministry_id && !joinedIds.has(member.ministry_id)) {
        const { data: directMinistry } = await supabase
          .from("ministries")
          .select("id, name, description")
          .eq("id", member.ministry_id)
          .maybeSingle();

        if (directMinistry) {
          joinTableMinistries.unshift(directMinistry);
        }
      }

      return joinTableMinistries.map((ministry: any) => ({ ...ministry, leaderName: null }));
    },
    enabled: !!member?.id,
    ...DASHBOARD_QUERY_OPTIONS,
  });
}

function useChurchSummary(churchId: string | null) {
  return useQuery({
    queryKey: ["portal-dashboard-church", churchId],
    queryFn: async () => {
      if (!churchId) return null;
      const { data } = await supabase.from("churches").select("name").eq("id", churchId).maybeSingle();
      return data;
    },
    enabled: !!churchId,
    ...DASHBOARD_QUERY_OPTIONS,
  });
}

function useMemberFamily(memberId: string | undefined) {
  return useQuery({
    queryKey: ["my-family", memberId],
    queryFn: async () => {
      if (!memberId) return null;
      const { data } = await supabase
        .from("members")
        .select("family_role, families(id, name)")
        .eq("id", memberId)
        .maybeSingle();
      return data?.families ? { role: data.family_role, ...(data.families as any) } : null;
    },
    enabled: !!memberId,
    ...DASHBOARD_QUERY_OPTIONS,
  });
}

function useMemberContributions(memberId: string | undefined) {
  return useQuery({
    queryKey: ["my-contributions-all", memberId],
    queryFn: async () => {
      if (!memberId) return [];
      const { data, error } = await supabase
        .from("contributions")
        .select("*, contribution_categories!contributions_category_id_fkey(name)")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return data ?? [];
    },
    enabled: !!memberId,
    ...DASHBOARD_QUERY_OPTIONS,
  });
}

function getContributionDate(contribution: any) {
  return contribution?.date ?? contribution?.created_at ?? null;
}

function useMemberPrayers(memberId: string | undefined) {
  return useQuery({
    queryKey: ["my-prayers", memberId],
    queryFn: async () => {
      if (!memberId) return [];
      const { data } = await supabase
        .from("prayer_requests")
        .select("id, request_text, status, created_at")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!memberId,
    ...DASHBOARD_QUERY_OPTIONS,
  });
}

function useMemberMassIntentions(memberId: string | undefined) {
  const { churchId } = useAuth();
  return useQuery({
    queryKey: ["my-mass-intentions-dashboard", memberId, churchId],
    queryFn: async () => {
      if (!memberId || !churchId) return [];
      const { data } = await supabase
        .from("mass_intentions")
        .select(MASS_INTENTION_SELECT)
        .eq("church_id", churchId)
        .eq("member_id", memberId)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data ?? []).map((row: any) => mapMassIntentionRecord(row));
    },
    enabled: !!memberId && !!churchId,
    ...DASHBOARD_QUERY_OPTIONS,
  });
}

function useMemberHelpRequests(memberId: string | undefined) {
  const { churchId } = useAuth();
  return useQuery({
    queryKey: ["my-help-requests-dashboard", memberId, churchId],
    queryFn: async () => {
      if (!memberId || !churchId) return [];
      const { data } = await supabase
        .from("community_help_requests")
        .select(COMMUNITY_HELP_SELECT)
        .eq("church_id", churchId)
        .eq("member_id", memberId)
        .order("created_at", { ascending: false })
        .limit(20);
      return enrichCommunityHelpRequests((data ?? []) as any[]);
    },
    enabled: !!memberId && !!churchId,
    ...DASHBOARD_QUERY_OPTIONS,
  });
}

function useCommunities(churchId: string | null) {
  return useQuery({
    queryKey: ["communities-list", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data } = await supabase.from("communities").select("id, name").eq("church_id", churchId).order("name");
      return data ?? [];
    },
    enabled: !!churchId,
    ...DASHBOARD_QUERY_OPTIONS,
  });
}

function useParticipationAndLeadershipProfile({
  member,
  ministries,
  ledCommunities,
  churchName,
}: {
  member: any;
  ministries: any[];
  ledCommunities: any[];
  churchName: string | null | undefined;
}) {
  const { user, churchId } = useAuth();

  return useQuery({
    queryKey: [
      "portal-participation-leadership",
      user?.id,
      churchId,
      member?.id,
      ledCommunities.map((item: any) => item.community_id).join(","),
      ministries.map((item: any) => item.id).join(","),
      churchName ?? "",
    ],
    queryFn: async () => {
      if (!user || !churchId) {
        return {
          roleLabels: ["Member"],
          hasLeadershipAccess: false,
          leadershipScopes: [] as any[],
        };
      }

      const { data: userRoles, error: userRolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("church_id", churchId);

      if (userRolesError) throw userRolesError;

      const roleKeys = new Set<string>(["member"]);
      (userRoles ?? []).forEach((row: any) => {
        if (row?.role) roleKeys.add(String(row.role).toLowerCase());
      });

      const leadershipScopes: any[] = [];

      if (ledCommunities.length > 0) {
        roleKeys.add("jumuiya_leader");

        const communityScopes = await Promise.all(
          ledCommunities.map(async (ledCommunity: any) => {
            const { count, error } = await supabase
              .from("member_communities")
              .select("*", { count: "exact", head: true })
              .eq("community_id", ledCommunity.community_id);

            if (error) throw error;

            return {
              id: `community-${ledCommunity.community_id}`,
              roleLabel: "Jumuiya Leader",
              detailRoleLabel: ledCommunity.leadership_role || "Leader",
              managingLabel: ledCommunity.community_name,
              memberCount: count ?? 0,
              summary: `You lead ${ledCommunity.community_name}`,
              viewMembersTo: `/community/${ledCommunity.community_id}/members`,
              addMemberTo: `/community/${ledCommunity.community_id}/members`,
              manageTo: `/community/${ledCommunity.community_id}/contributions`,
            };
          }),
        );

        leadershipScopes.push(...communityScopes);
      }

      const adminRoles = Array.from(roleKeys).filter((role) => ADMIN_ROLE_KEYS.has(role));
      if (adminRoles.length > 0) {
        roleKeys.add("admin");

        const { count, error } = await supabase
          .from("members")
          .select("*", { count: "exact", head: true })
          .eq("church_id", churchId);

        if (error) throw error;

        leadershipScopes.unshift({
          id: "church-admin-scope",
          roleLabel: adminRoles.map(formatRoleLabel).join(", "),
          detailRoleLabel: "Church Leadership",
          managingLabel: churchName || "Church members and operations",
          memberCount: count ?? 0,
          summary: `You help manage ${churchName || "this church"}`,
          viewMembersTo: "/church-admin/members",
          addMemberTo: "/church-admin/members",
          manageTo: "/church-admin/contributions",
        });
      }

      if (Array.from(roleKeys).some((role) => role.includes("ministry_leader"))) {
        roleKeys.add("ministry_leader");
      }

      const roleLabels = Array.from(new Set(Array.from(roleKeys).map(formatRoleLabel)));
      if (!roleLabels.includes("Member")) {
        roleLabels.unshift("Member");
      }

      return {
        roleLabels,
        hasLeadershipAccess: leadershipScopes.length > 0,
        leadershipScopes,
      };
    },
    enabled: !!user && !!churchId,
    ...DASHBOARD_QUERY_OPTIONS,
  });
}

// ─── Utility ──────────────────────────────────────────────────
function EmptyState({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground/70 mt-1">{desc}</p>
    </div>
  );
}

function LockedPortalCard({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-primary/15 bg-primary/5">
      <CardContent className="space-y-3 p-5 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Lock className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">{title} 🔒</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value, icon: Icon }: { label: string; value: string | null | undefined; icon?: any }) {
  return (
    <div className="flex items-start gap-3 py-2">
      {Icon && <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value || "Not assigned yet"}</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function PortalDashboard() {
  const { user, profile, churchId, userRole } = useAuth();
  const billing = useBillingAccess();
  const { isFeatureEnabled } = useFeatureAccess();
  const { toast } = useToast();
  const { data: member, isLoading: memberLoading } = useMemberRecord();
  const { data: community } = useMemberCommunity(member);
  const { data: ministries = [] } = useMemberMinistries(member);
  const { data: family } = useMemberFamily(member?.id);
  const { data: church } = useChurchSummary(churchId);
  const { data: ledCommunities = [] } = useLedCommunities();
  const { data: contributions = [], isLoading: contribLoading } = useMemberContributions(member?.id);
  const { data: pledges = [] } = useMemberPledges(member?.id);
  const { data: prayers = [] } = useMemberPrayers(member?.id);
  const { data: massIntentions = [] } = useMemberMassIntentions(member?.id);
  const { data: helpRequests = [] } = useMemberHelpRequests(member?.id);
  const { data: communities = [] } = useCommunities(churchId);
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [verseOfDay, setVerseOfDay] = useState<any | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { data: roleProfile } = useParticipationAndLeadershipProfile({
    member,
    ministries,
    ledCommunities,
    churchName: church?.name,
  });

  // Announcements & events
  const { data: announcements = [] } = useQuery({
    queryKey: ["dash-announcements", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data } = await supabase
        .from("announcements")
        .select("*")
        .eq("church_id", churchId)
        .eq("is_published", true)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
    enabled: !!churchId,
  });
  const { data: events = [] } = useQuery({
    queryKey: ["dash-events", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data } = await supabase.from("events").select("*").eq("church_id", churchId).eq("status", "upcoming").order("start_date").limit(3);
      return data ?? [];
    },
    enabled: !!churchId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    const fetchVerse = async () => {
      const { data, error } = await supabase
        .from("bible_verses")
        .select("id, verse_text, reference")
        .eq("church_id", churchId)
        .limit(24);

      if (error || !data?.length) {
        setVerseOfDay(null);
        return;
      }

      const dayIndex = new Date().getDate() % data.length;
      const verse = data[dayIndex];
      setVerseOfDay({
        ...verse,
        text: verse.verse_text,
      });
    };

    void fetchVerse();
  }, [churchId]);

  // ── Contribution Analytics ──
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const thisYearStart = `${now.getFullYear()}-01-01`;
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

  const stats = useMemo(() => {
    const total = contributions.reduce((s: number, c: any) => s + Number(c.amount), 0);
    const todayTotal = contributions.filter((c: any) => {
      const contributionDate = getContributionDate(c);
      return contributionDate ? contributionDate.slice(0, 10) === today : false;
    }).reduce((s: number, c: any) => s + Number(c.amount), 0);
    const monthTotal = contributions.filter((c: any) => {
      const contributionDate = getContributionDate(c);
      return contributionDate ? contributionDate.slice(0, 10) >= thisMonthStart : false;
    }).reduce((s: number, c: any) => s + Number(c.amount), 0);
    const yearTotal = contributions.filter((c: any) => {
      const contributionDate = getContributionDate(c);
      return contributionDate ? contributionDate.slice(0, 10) >= thisYearStart : false;
    }).reduce((s: number, c: any) => s + Number(c.amount), 0);
    const lastMonthTotal = contributions.filter((c: any) => {
      const contributionDate = getContributionDate(c);
      if (!contributionDate) return false;
      const normalizedDate = contributionDate.slice(0, 10);
      return normalizedDate >= lastMonthStart && normalizedDate <= lastMonthEnd;
    }).reduce((s: number, c: any) => s + Number(c.amount), 0);
    const lastContrib = contributions.length > 0 ? contributions[0] : null;
    // category breakdown
    const catMap: Record<string, number> = {};
    contributions.forEach((c: any) => {
      const name = (c.contribution_categories as any)?.name || "Other";
      catMap[name] = (catMap[name] || 0) + Number(c.amount);
    });
    const categoryBreakdown = Object.entries(catMap).map(([name, value]) => ({ name: translateContributionCategory(t, name, "short"), value })).sort((a, b) => b.value - a.value);
    // monthly trend (last 6 months)
    const monthlyTrend: { month: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStart = d.toISOString().slice(0, 10);
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
      const mTotal = contributions.filter((c: any) => {
        const contributionDate = getContributionDate(c);
        if (!contributionDate) return false;
        const normalizedDate = contributionDate.slice(0, 10);
        return normalizedDate >= mStart && normalizedDate <= mEnd;
      }).reduce((s: number, c: any) => s + Number(c.amount), 0);
      monthlyTrend.push({ month: d.toLocaleDateString("en-US", { month: "short" }), amount: mTotal });
    }
    return { total, todayTotal, monthTotal, yearTotal, lastMonthTotal, count: contributions.length, lastContrib, categoryBreakdown, monthlyTrend };
  }, [contributions, t]);

  const handleRequestAssignment = useCallback(() => {
    toast({
      title: "Assignment request noted",
      description: "Please contact your church administrator so they can assign you to a Jumuiya.",
    });
  }, [toast]);
  const pledgeSummary = useMemo(() => pledges.reduce(
    (acc: { pledged: number; paid: number; balance: number }, pledge: any) => ({
      pledged: acc.pledged + Number(pledge.amount_pledged ?? 0),
      paid: acc.paid + Number(pledge.amount_paid ?? 0),
      balance: acc.balance + Number(pledge.balance ?? 0),
    }),
    { pledged: 0, paid: 0, balance: 0 },
  ), [pledges]);
  const pledgeProgress = pledgeSummary.pledged > 0 ? (pledgeSummary.paid / pledgeSummary.pledged) * 100 : 0;

  // ── Contribution History State ──
  const [searchQ, setSearchQ] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [page, setPage] = useState(0);

  const filteredContribs = useMemo(() => {
    let list = contributions;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      list = list.filter((c: any) => (c.donor_name || "").toLowerCase().includes(q) || (c.notes || "").toLowerCase().includes(q) || (c.payment_reference || "").toLowerCase().includes(q));
    }
    if (catFilter !== "all") {
      list = list.filter((c: any) => (c.contribution_categories as any)?.name === catFilter);
    }
    return list;
  }, [contributions, searchQ, catFilter]);

  const totalPages = Math.ceil(filteredContribs.length / PAGE_SIZE);
  const pagedContribs = filteredContribs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const categoryNames = useMemo(() => {
    const set = new Set<string>();
    contributions.forEach((c: any) => {
      const n = (c.contribution_categories as any)?.name;
      if (n) set.add(n);
    });
    return Array.from(set);
  }, [contributions]);

  const displayName = member?.full_name || profile?.full_name || "Member";
  const ministryNames = ministries.map((ministry: any) => ministry.name).filter(Boolean);

  const uploadMemberPhoto = useMutation({
    mutationFn: async (file: File) => {
      if (!churchId || !member?.id) throw new Error("Member profile not found.");

      const validation = validateFile(file, "member-photo");
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      setAvatarUploading(true);
      const { blob } = await optimizeImage(file, "member-photo");
      const result = await uploadFile(blob, "member-photo", churchId, member.id);

      const { error } = await supabase
        .from("members")
        .update({ photo_url: result.publicUrl })
        .eq("id", member.id);

      if (error) throw error;

      return result.publicUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-member-record"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast({ title: "Profile photo updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    onSettled: () => setAvatarUploading(false),
  });

  const handleAvatarSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    uploadMemberPhoto.mutate(file);
    event.target.value = "";
  }, [uploadMemberPhoto]);

  const isLoading = memberLoading;
  const limitedPortal = billing.memberPortalAccess === "limited";

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-10 space-y-4 animate-fade-in">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (limitedPortal) {
    return (
      <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8 animate-fade-in">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-2 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-primary">Limited access - upgrade to unlock full member features</p>
              <p className="text-sm text-muted-foreground">
                Free plan members can view their profile and basic church info. Contribution history, prayer requests, and communication features are locked.
              </p>
            </div>
            <Badge variant="outline" className="border-primary/30 text-primary">
              <Lock className="mr-1 h-3 w-3" />
              Limited member portal
            </Badge>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Personal Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <InfoRow label="Full Name" value={member?.full_name || profile?.full_name} icon={User} />
              <InfoRow label="Email" value={member?.email || profile?.email} icon={Mail} />
              <InfoRow label="Phone" value={member?.phone || profile?.phone} icon={Phone} />
              <InfoRow label="Community" value={community?.name} icon={Users} />
              <InfoRow label="Ministries" value={ministryNames.length > 0 ? ministryNames.join(", ") : null} icon={Heart} />
              <InfoRow label="Member Since" value={member?.date_joined ? new Date(member.date_joined).toLocaleDateString() : member?.created_at ? new Date(member.created_at).toLocaleDateString() : null} icon={Calendar} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Church className="h-4 w-4 text-primary" /> Basic Church Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <InfoRow label="Church" value={church?.name} icon={Church} />
              <InfoRow label="Role" value={userRole ? userRole.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase()) : "Member"} icon={Shield} />
              <InfoRow label="Family" value={family?.name} icon={Users} />
              <InfoRow label="Family Role" value={family?.role ? family.role.charAt(0).toUpperCase() + family.role.slice(1) : null} icon={Shield} />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <LockedPortalCard title="Contribution History" description="Upgrade to unlock giving records and analytics." />
          <LockedPortalCard title="Prayer Requests" description="Upgrade to unlock prayer submission and tracking." />
          <LockedPortalCard title="Communication Features" description="Upgrade to unlock requests, messages, and engagement tools." />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8 animate-fade-in max-w-6xl">

      {/* ── Welcome Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0 shadow-lg">
          <div className="relative">
            <input
              ref={avatarInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={handleAvatarSelect}
            />
            {member?.photo_url ? (
              <img src={member.photo_url} alt="" className="h-16 w-16 rounded-2xl object-cover" />
            ) : (
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <User className="h-8 w-8 text-primary-foreground" />
              </div>
            )}
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute -bottom-2 -right-2 h-7 w-7 rounded-full border border-border/60"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading || uploadMemberPhoto.isPending || !member?.id}
            >
              {avatarUploading || uploadMemberPhoto.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Pencil className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-primary font-medium uppercase tracking-wider">Karibu nyumbani</p>
          <h1 className="text-2xl md:text-3xl font-bold font-serif truncate">{displayName}</h1>
          <p className="text-sm text-muted-foreground">
            Welcome to {church?.name || "your church"}.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border/60 bg-muted/30 px-3 py-1">
              Jumuiya: {community?.name || "Not assigned"}
            </span>
            <span className="rounded-full border border-border/60 bg-muted/30 px-3 py-1">
              Ministries: {ministryNames.length > 0 ? ministryNames.join(", ") : "None yet"}
            </span>
          </div>
        </div>
        <Badge variant="outline" className="border-primary/30 text-primary">
          <Shield className="h-3 w-3 mr-1" />
          {userRole ? userRole.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase()) : "Member"}
        </Badge>
      </div>

      {/* ── Taarifa Zangu ── */}
      <Card className="border-primary/15 bg-gradient-to-b from-card to-card/90 shadow-[0_18px_48px_-28px_rgba(0,0,0,0.55)]">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Taarifa Zangu
          </CardTitle>
          <p className="text-sm text-muted-foreground">Waone wasifu wako wote kwa urahisi.</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Personal Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <InfoRow label="Full Name" value={member?.full_name} icon={User} />
                <InfoRow label="Email" value={member?.email} icon={Mail} />
                <InfoRow label="Phone" value={member?.phone} icon={Phone} />
                <InfoRow label="Gender" value={member?.gender ? (member.gender === "male" ? "Male" : "Female") : null} icon={Users} />
                <InfoRow label="Date Joined" value={member?.date_joined ? new Date(member.date_joined).toLocaleDateString() : member?.created_at ? new Date(member.created_at).toLocaleDateString() : null} icon={Calendar} />
                <InfoRow label="Member ID" value={member?.id?.slice(0, 8).toUpperCase()} icon={Shield} />
              </CardContent>
            </Card>

            <div className="space-y-6">
              <MyParticipationCard
                community={community}
                ministries={ministries}
                family={family}
                roleLabels={roleProfile?.roleLabels ?? ["Member"]}
                onRequestAssignment={handleRequestAssignment}
              />
              <LeadershipPanelCard leadershipScopes={roleProfile?.leadershipScopes ?? []} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard icon={HandCoins} label="Total Given" value={formatTZS(stats.total)} />
        <SummaryCard icon={TrendingUp} label="This Month" value={formatTZS(stats.monthTotal)} />
        <SummaryCard icon={BarChart3} label="This Year" value={formatTZS(stats.yearTotal)} />
        <SummaryCard icon={Calendar} label="Member Since" value={member?.date_joined ? new Date(member.date_joined).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : member?.created_at ? new Date(member.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—"} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard icon={Gift} label="Today" value={formatTZS(stats.todayTotal)} subtle />
        <SummaryCard icon={FileText} label="Records" value={String(stats.count)} subtle />
        <SummaryCard icon={Clock} label="Last Given" value={stats.lastContrib && getContributionDate(stats.lastContrib) ? new Date(getContributionDate(stats.lastContrib)!).toLocaleDateString() : "—"} subtle />
        <SummaryCard icon={Star} label="Status" value={member?.status ? member.status.charAt(0).toUpperCase() + member.status.slice(1) : "—"} subtle />
      </div>

      {/* ── Contribution Analytics ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Contribution Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          {contributions.length === 0 ? (
            <EmptyState icon={HandCoins} title="No contributions yet" desc="Your contribution analytics will appear here once you start giving." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Monthly Trend */}
              <div>
                <p className="text-sm font-medium mb-3">Monthly Trend (6 months)</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.monthlyTrend}>
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <RTooltip formatter={(v: number) => formatTZS(v)} />
                    <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Category Breakdown */}
              <div>
                <p className="text-sm font-medium mb-3">Category Breakdown</p>
                {stats.categoryBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <RPieChart>
                      <Pie data={stats.categoryBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {stats.categoryBreakdown.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <RTooltip formatter={(v: number) => formatTZS(v)} />
                    </RPieChart>
                  </ResponsiveContainer>
                ) : null}
              </div>
              {/* Comparison */}
              <div className="md:col-span-2 grid grid-cols-2 gap-4">
                <Card className="bg-muted/30">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">This Month</p>
                    <p className="text-lg font-bold text-primary">{formatTZS(stats.monthTotal)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">Last Month</p>
                    <p className="text-lg font-bold">{formatTZS(stats.lastMonthTotal)}</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Contribution History ── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Contribution History</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search..." className="pl-8 h-8 w-40 text-xs" value={searchQ} onChange={(e) => { setSearchQ(e.target.value); setPage(0); }} />
              </div>
              <Select value={catFilter} onValueChange={(v) => { setCatFilter(v); setPage(0); }}>
                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categoryNames.map((n) => <SelectItem key={n} value={n}>{translateContributionCategory(t, n, "short")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredContribs.length === 0 ? (
            <EmptyState icon={HandCoins} title="No records found" desc="Your contribution history will show here." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Date</th>
                      <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Category</th>
                      <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Amount</th>
                      <th className="pb-2 text-xs font-medium text-muted-foreground hidden sm:table-cell">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedContribs.map((c: any) => (
                      <tr key={c.id} className="border-b border-border/50 last:border-0">
                        <td className="py-2.5 pr-4 text-xs">{new Date(c.date).toLocaleDateString()}</td>
                        <td className="py-2.5 pr-4">
                          <Badge variant="secondary" className="text-xs">{(c.contribution_categories as any)?.name ? translateContributionCategory(t, (c.contribution_categories as any)?.name, "short") : "—"}</Badge>
                        </td>
                        <td className="py-2.5 pr-4 font-semibold text-primary">{formatTZS(Number(c.amount))}</td>
                        <td className="py-2.5 text-xs text-muted-foreground hidden sm:table-cell truncate max-w-[200px]">{c.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</p>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Prayers & Mass Intentions ── */}
      {(isFeatureEnabled("prayer_requests") || isFeatureEnabled("mass_intentions")) && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isFeatureEnabled("prayer_requests") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Flame className="h-4 w-4 text-primary" /> My Prayer Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {prayers.length === 0 ? (
              <EmptyState icon={Flame} title="No prayer requests yet" desc="Submit a prayer request and it will appear here." />
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {prayers.map((p: any) => (
                  <div key={p.id} className="flex items-start justify-between gap-2 pb-3 border-b border-border/50 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.request_text}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{new Date(p.created_at).toLocaleDateString()}</p>
                    </div>
                    <Badge variant={p.status === "pending" ? "default" : "secondary"} className="shrink-0 text-xs">{p.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {isFeatureEnabled("mass_intentions") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Heart className="h-4 w-4 text-primary" /> My Mass Intentions</CardTitle>
          </CardHeader>
          <CardContent>
            {massIntentions.length === 0 ? (
              <EmptyState icon={Heart} title="No mass intentions yet" desc="Submit a mass intention and it will appear here." />
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {massIntentions.map((m: any) => (
                  <div key={m.id} className="flex items-start justify-between gap-2 pb-3 border-b border-border/50 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{m.member_name} — {m.intention_type}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{m.message}</p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">{new Date(m.created_at).toLocaleDateString()}</p>
                    </div>
                    <Badge variant={m.status === "pending" ? "outline" : "secondary"} className="shrink-0 text-xs">{m.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>
      )}

      {/* ── My Community Help Requests ── */}
      {isFeatureEnabled("community_help") && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><HelpCircle className="h-4 w-4 text-primary" /> My Help Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {helpRequests.length === 0 ? (
            <EmptyState icon={HelpCircle} title="No help requests" desc="Submit a community help request and it will appear here." />
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {helpRequests.map((h: any) => (
                <div key={h.id} className="flex items-start justify-between gap-2 pb-3 border-b border-border/50 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{h.category} — {h.description?.slice(0, 60)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{new Date(h.created_at).toLocaleDateString()}</p>
                  </div>
                  <Badge variant={h.status === "pending" ? "outline" : h.status === "approved" ? "default" : "secondary"} className="shrink-0 text-xs">{h.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isFeatureEnabled("announcements") && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary" /> Latest Announcements</CardTitle>
              <Button variant="ghost" size="sm" asChild><Link to="/portal/announcements">View All <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
            </div>
          </CardHeader>
          <CardContent>
            {announcements.length === 0 ? (
              <EmptyState icon={Megaphone} title="No announcements" desc="Check back later for church updates." />
            ) : (
              <div className="space-y-3">
                {announcements.map((a: any) => (
                  <div key={a.id} className="pb-3 border-b border-border/50 last:border-0">
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.content}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">{new Date(a.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {isFeatureEnabled("events") && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> Upcoming Events</CardTitle>
              <Button variant="ghost" size="sm" asChild><Link to="/portal/events">View All <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
            </div>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <EmptyState icon={Calendar} title="No upcoming events" desc="New events will appear here." />
            ) : (
              <div className="space-y-3">
                {events.map((e: any) => (
                  <div key={e.id} className="pb-3 border-b border-border/50 last:border-0">
                    <p className="text-xs text-primary font-medium">{new Date(e.start_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
                    <p className="text-sm font-medium mt-0.5">{e.title}</p>
                    {e.location && <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><MapPin className="h-3 w-3" />{e.location}</p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>

      {ledCommunities.length > 0 && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Community Leadership Dashboards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ledCommunities.map((ledCommunity) => (
                <Link
                  key={ledCommunity.community_id}
                  to={`/community/${ledCommunity.community_id}`}
                  className="rounded-xl border border-border/60 bg-card/70 p-4 transition-all hover:border-primary/30 hover:bg-primary/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{ledCommunity.community_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Open members, contributions, reports, and leadership analytics.
                      </p>
                    </div>
                    <Badge variant="outline" className="border-primary/30 text-primary shrink-0">
                      {ledCommunity.leadership_role}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs font-medium text-primary">
                    <span>Open dashboard</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Quick Actions ── */}
      {isFeatureEnabled("community_help") && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {isFeatureEnabled("give") && <QuickAction icon={HandCoins} label="Give Now" to="/portal/give" />}
            {isFeatureEnabled("pledges") && <QuickAction icon={Target} label="Pledges" to="/portal/pledges" />}
            {isFeatureEnabled("prayer_requests") && <QuickAction icon={Flame} label="Prayer Request" to="/portal/prayer-requests" />}
            {isFeatureEnabled("mass_intentions") && <QuickAction icon={Heart} label="Mass Intention" to="/portal/mass-intentions" />}
            {isFeatureEnabled("community_help") && <QuickAction icon={HelpCircle} label="Request Help" to="/portal/community-help" />}
            {isFeatureEnabled("events") && <QuickAction icon={Calendar} label="View Events" to="/portal/events" />}
            {isFeatureEnabled("sermons") && <QuickAction icon={BookOpen} label="View Sermons" to="/portal/sermons" />}
            {isFeatureEnabled("announcements") && <QuickAction icon={Megaphone} label="Announcements" to="/portal/announcements" />}
            {ledCommunities[0] && <QuickAction icon={Building2} label="Leader Dashboard" to={`/community/${ledCommunities[0].community_id}`} />}
            <QuickAction icon={User} label="Portal Home" to="/portal" />
          </div>
        </CardContent>
      </Card>
      )}

      {isFeatureEnabled("pledges") && (
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> My Pledges</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link to="/portal/pledges">Open Pledges <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {pledges.length === 0 ? (
            <EmptyState icon={Target} title="No pledges yet" desc="Your pledge commitments will appear here once they are recorded." />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SummaryCard icon={Target} label="Pledged" value={formatTZS(pledgeSummary.pledged)} />
                <SummaryCard icon={HandCoins} label="Paid" value={formatTZS(pledgeSummary.paid)} />
                <SummaryCard icon={Wallet} label="Balance" value={formatTZS(pledgeSummary.balance)} />
              </div>
              <div className="space-y-2">
                <Progress value={pledgeProgress} className="h-2.5" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{pledgeProgress.toFixed(0)}% complete</span>
                  <span>{pledges.length} pledge{pledges.length === 1 ? "" : "s"}</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      )}

      {/* ── Verse of the Day ── */}
      {isFeatureEnabled("bible_verses") && verseOfDay && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="p-5 flex items-start gap-3">
            <BookOpen className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-primary uppercase tracking-wider">Neno la Leo</p>
              <p className="text-sm italic leading-relaxed mt-1">"{verseOfDay.text}"</p>
              <p className="text-xs text-muted-foreground font-semibold mt-1">— {verseOfDay.reference}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Sub Components ──
function JumuiyaInvolvementCard({ member, community, ministries, family, communities, churchId, queryClient }: any) {
  const [editing, setEditing] = useState(false);
  const [selectedCommunity, setSelectedCommunity] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!member?.id || !selectedCommunity) return;
    setSaving(true);
    try {
      // Remove existing community membership
      await supabase.from("member_communities").delete().eq("member_id", member.id);
      // Add new
      if (selectedCommunity !== "none") {
        await supabase.from("member_communities").insert({ community_id: selectedCommunity, member_id: member.id });
      }
      queryClient.invalidateQueries({ queryKey: ["my-community"] });
      setEditing(false);
    } catch { /* ignore */ }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Church className="h-4 w-4 text-primary" /> Church Involvement</CardTitle>
          {member && !editing && (
            <Button variant="ghost" size="sm" onClick={() => { setSelectedCommunity(community?.id || ""); setEditing(true); }}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit Jumuiya
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {editing ? (
          <div className="space-y-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
            <Label className="text-xs">Select your Jumuiya</Label>
            <Select value={selectedCommunity} onValueChange={setSelectedCommunity}>
              <SelectTrigger><SelectValue placeholder="Choose Jumuiya" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {communities.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <>
            <InfoRow label="Jumuiya / Community" value={community?.name} icon={Users} />
            <InfoRow label="Jumuiya Leader" value={community?.leaderName} icon={User} />
          </>
        )}
        <InfoRow label="Ministries" value={ministries?.length ? ministries.map((ministry: any) => ministry.name).join(", ") : null} icon={Heart} />
        <InfoRow label="Ministry Leaders" value={ministries?.length ? ministries.map((ministry: any) => ministry.leaderName).filter(Boolean).join(", ") : null} icon={User} />
        <InfoRow label="Family" value={family?.name} icon={Users} />
        <InfoRow label="Family Role" value={family?.role ? family.role.charAt(0).toUpperCase() + family.role.slice(1) : null} icon={Shield} />
      </CardContent>
    </Card>
  );
}

function ParticipationItem({
  label,
  value,
  emptyMessage,
  icon: Icon,
  action,
}: {
  label: string;
  value?: string | null;
  emptyMessage: string;
  icon: any;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/50 p-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        {value ? (
          <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">{emptyMessage}</p>
            {action ? <div className="mt-3">{action}</div> : null}
          </>
        )}
      </div>
    </div>
  );
}

function MyParticipationCard({
  community,
  ministries,
  family,
  roleLabels,
  onRequestAssignment,
}: {
  community: any;
  ministries: any[];
  family: any;
  roleLabels: string[];
  onRequestAssignment: () => void;
}) {
  const personalRole = roleLabels.length > 0 ? roleLabels.join(", ") : "Member";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Church className="h-4 w-4 text-primary" />
          My Participation
        </CardTitle>
        <p className="text-sm text-muted-foreground">Member view only. Hapa unaona ushiriki wako binafsi bila kuchanganya data za usimamizi.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <ParticipationItem
          label="Jumuiya / Community"
          value={community?.name ?? null}
          emptyMessage="You are not assigned to a Jumuiya yet"
          icon={Users}
          action={
            <Button size="sm" variant="outline" onClick={onRequestAssignment}>
              Request Assignment
            </Button>
          }
        />
        <ParticipationItem
          label="Ministries"
          value={ministries.length ? ministries.map((ministry: any) => ministry.name).join(", ") : null}
          emptyMessage="You are not assigned to a ministry yet"
          icon={Heart}
        />
        <ParticipationItem
          label="Family"
          value={
            family?.name
              ? [family.name, family?.role ? `(${family.role.charAt(0).toUpperCase() + family.role.slice(1)})` : null].filter(Boolean).join(" ")
              : null
          }
          emptyMessage="You are not assigned to a family yet"
          icon={Users}
        />
        <ParticipationItem
          label="Personal Role"
          value={personalRole}
          emptyMessage="Your role details will appear here"
          icon={Shield}
        />
      </CardContent>
    </Card>
  );
}

function LeadershipPanelCard({ leadershipScopes }: { leadershipScopes: any[] }) {
  if (!leadershipScopes.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          Leadership Panel
        </CardTitle>
        <p className="text-sm text-muted-foreground">Inaonekana tu kama una role ya uongozi au usimamizi.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {leadershipScopes.map((scope) => (
          <div key={scope.id} className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{scope.roleLabel}</p>
                <p className="mt-1 text-sm text-muted-foreground">{scope.summary}</p>
              </div>
              <Badge variant="outline" className="border-primary/30 text-primary">
                {scope.detailRoleLabel}
              </Badge>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Managing</p>
                <p className="mt-1 text-sm font-medium">{scope.managingLabel}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Members</p>
                <p className="mt-1 text-sm font-medium">{scope.memberCount}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link to={scope.viewMembersTo}>View Members</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to={scope.addMemberTo}>Add Member</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to={scope.manageTo}>Manage Attendance / Contributions</Link>
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SummaryCard({ icon: Icon, label, value, subtle }: { icon: any; label: string; value: string; subtle?: boolean }) {
  return (
    <Card className={subtle ? "bg-muted/20" : ""}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${subtle ? "bg-muted" : "bg-primary/10"}`}>
          <Icon className={`h-4 w-4 ${subtle ? "text-muted-foreground" : "text-primary"}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-bold truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({ icon: Icon, label, to }: { icon: any; label: string; to: string }) {
  return (
    <Link to={to}>
      <div className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all group cursor-pointer">
        <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
        <span className="text-xs font-medium text-center">{label}</span>
      </div>
    </Link>
  );
}
