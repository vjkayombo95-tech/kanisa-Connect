import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { fetchPortalAnnouncements } from "@/lib/portal-announcements";
import {
  RECORD_PRESERVATION_AMOUNT,
  RECORD_PRESERVATION_PAGE_SIZE,
  RECORD_PRESERVATION_YEARLY_AMOUNT,
  hasActiveRecordPreservation,
  isCurrentMonthDate,
  useMemberRecordPreservation,
} from "@/lib/member-record-preservation";
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
  MapPin, Clock, Star, Gift, BarChart3, PieChart, Pencil, Loader2, Lock, Building2, Target, Archive, Upload,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { optimizeImage, uploadFile, validateFile } from "@/lib/file-upload";
import { useTranslation } from "react-i18next";
import { translateContributionCategory } from "@/lib/translation-helpers";
import { logSupabaseError } from "@/lib/error-logger";
import type { Tables } from "@/integrations/supabase/types";

const PortalContributionCharts = lazy(() => import("./PortalContributionCharts"));
type PortalDashboardEvent = Tables<"events">;

const PAGE_SIZE = RECORD_PRESERVATION_PAGE_SIZE;
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
      return "Mwanachama";
    case "jumuiya_leader":
    case "community_leader":
      return "Kiongozi wa Jumuiya";
    case "ministry_leader":
      return "Kiongozi wa Huduma";
    case "church_admin":
    case "admin":
      return "Msimamizi";
    case "pastor":
      return "Paroko";
    case "secretary":
      return "Katibu";
    case "treasurer":
      return "Mweka Hazina";
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
        const { data, error } = await supabase
          .from("communities")
          .select("id, name, description, church_id, mwenyekiti_id, makamu_mwenyekiti_id, mweka_hazina_id, katibu_id")
          .eq("id", member.community_id)
          .eq("church_id", member.church_id)
          .maybeSingle();
        if (error) throw error;

        community = data ?? null;
      }

      if (!community) {
        const { data, error } = await supabase
          .from("member_communities")
          .select("community_id, communities(id, name, description, church_id, mwenyekiti_id, makamu_mwenyekiti_id, mweka_hazina_id, katibu_id)")
          .eq("member_id", member.id)
          .limit(1)
          .maybeSingle();
        if (error) throw error;

        const linkedCommunity = (data?.communities as any) ?? null;
        community = linkedCommunity?.church_id === member.church_id ? linkedCommunity : null;
      }

      if (!community && member.church_id) {
        const { data, error } = await supabase
          .from("communities")
          .select("id, name, description, church_id, mwenyekiti_id, makamu_mwenyekiti_id, mweka_hazina_id, katibu_id")
          .eq("church_id", member.church_id)
          .or([
            `mwenyekiti_id.eq.${member.id}`,
            `makamu_mwenyekiti_id.eq.${member.id}`,
            `mweka_hazina_id.eq.${member.id}`,
            `katibu_id.eq.${member.id}`,
          ].join(","))
          .limit(1)
          .maybeSingle();
        if (error) throw error;

        community = data ?? null;
      }

      if (!community) return null;

      // Try to get leader name
      let leaderName: string | null = null;
      const leaderId = community?.mwenyekiti_id;
      if (leaderId) {
        const { data: ldr, error } = await supabase
          .from("members")
          .select("full_name")
          .eq("id", leaderId)
          .eq("church_id", member.church_id)
          .maybeSingle();
        if (error) throw error;
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

function useMemberContributions({
  memberId,
  enabled = true,
  includeHistory = false,
  page = 0,
  search = "",
  category = "all",
}: {
  memberId: string | undefined;
  enabled?: boolean;
  includeHistory?: boolean;
  page?: number;
  search?: string;
  category?: string;
}) {
  return useQuery({
    queryKey: ["my-contributions", memberId, includeHistory ? "archive" : "current-month", page, search, category],
    queryFn: async () => {
      if (!memberId) return { records: [], totalCount: 0 };
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("contributions")
        .select("*, contribution_categories!contributions_category_id_fkey(name)", { count: "exact" })
        .eq("member_id", memberId)
        .order("date", { ascending: false });

      if (!includeHistory) {
        query = query.gte("date", startOfMonth.toISOString().slice(0, 10));
      }

      const safeSearch = search.trim().replace(/[%,]/g, "");
      if (safeSearch) {
        query = query.or(`donor_name.ilike.%${safeSearch}%,notes.ilike.%${safeSearch}%,payment_reference.ilike.%${safeSearch}%`);
      }

      const { data, error, count } = await query.range(from, to);

      if (error) {
        throw error;
      }

      let records = data ?? [];
      if (category !== "all") {
        records = records.filter((contribution: any) => (contribution.contribution_categories as any)?.name === category);
      }

      return { records, totalCount: count ?? records.length };
    },
    enabled: enabled && !!memberId,
    ...DASHBOARD_QUERY_OPTIONS,
  });
}

function getContributionDate(contribution: any) {
  return contribution?.date ?? contribution?.created_at ?? null;
}

function useMemberPrayers(memberId: string | undefined, enabled = true, includeHistory = false, page = 0) {
  return useQuery({
    queryKey: ["my-prayers", memberId, includeHistory ? "archive" : "current-month", page],
    queryFn: async () => {
      if (!memberId) return { records: [], totalCount: 0 };
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("prayer_requests")
        .select("id, request_text, status, created_at", { count: "exact" })
        .eq("member_id", memberId)
        .order("created_at", { ascending: false });

      if (!includeHistory) {
        query = query.gte("created_at", startOfMonth.toISOString());
      }

      const { data, count } = await query.range(from, to);
      return { records: data ?? [], totalCount: count ?? data?.length ?? 0 };
    },
    enabled: enabled && !!memberId,
    ...DASHBOARD_QUERY_OPTIONS,
  });
}

function useMemberMassIntentions(memberId: string | undefined, enabled = true, includeHistory = false, page = 0) {
  const { churchId } = useAuth();
  return useQuery({
    queryKey: ["my-mass-intentions-dashboard", memberId, churchId, includeHistory ? "archive" : "current-month", page],
    queryFn: async () => {
      if (!memberId || !churchId) return { records: [], totalCount: 0 };
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("mass_intentions")
        .select(MASS_INTENTION_SELECT, { count: "exact" })
        .eq("church_id", churchId)
        .eq("member_id", memberId)
        .order("created_at", { ascending: false });

      if (!includeHistory) {
        query = query.gte("created_at", startOfMonth.toISOString());
      }

      const { data, count } = await query.range(from, to);
      const records = (data ?? []).map((row: any) => mapMassIntentionRecord(row));
      return { records, totalCount: count ?? records.length };
    },
    enabled: enabled && !!memberId && !!churchId,
    ...DASHBOARD_QUERY_OPTIONS,
  });
}

function useMemberHelpRequests(memberId: string | undefined, enabled = true) {
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
    enabled: enabled && !!memberId && !!churchId,
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
        <p className="text-sm font-medium truncate">{value || "Bado haijawekwa"}</p>
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
  const [loadDashboardDetails, setLoadDashboardDetails] = useState(false);
  const [verseOfDay, setVerseOfDay] = useState<any | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [preservationOpen, setPreservationOpen] = useState(false);
  const [preservationTransactionId, setPreservationTransactionId] = useState("");
  const [preservationProofFile, setPreservationProofFile] = useState<File | null>(null);
  const [preservationPlan, setPreservationPlan] = useState<"monthly" | "yearly">("monthly");
  const [searchQ, setSearchQ] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [prayerPage, setPrayerPage] = useState(0);
  const [massIntentionPage, setMassIntentionPage] = useState(0);
  const {
    data: community,
    isLoading: communityLoading,
    isError: communityError,
    isFetching: communityFetching,
    refetch: retryCommunity,
  } = useMemberCommunity(member);
  const { data: ministries = [] } = useMemberMinistries(member);
  const { data: family } = useMemberFamily(member?.id);
  const { data: church } = useChurchSummary(churchId);
  const { data: ledCommunities = [] } = useLedCommunities();
  const { data: recordPreservation } = useMemberRecordPreservation(member?.id, churchId);
  const activeRecordPreservation = hasActiveRecordPreservation(recordPreservation?.active);
  const latestRecordPreservation = recordPreservation?.latest;
  const { data: contributionPageData = { records: [], totalCount: 0 }, isLoading: contribLoading } = useMemberContributions({
    memberId: member?.id,
    enabled: loadDashboardDetails,
    includeHistory: activeRecordPreservation,
    page,
    search: searchQ,
    category: catFilter,
  });
  const contributions = contributionPageData.records;
  const { data: pledges = [] } = useMemberPledges(member?.id, { enabled: loadDashboardDetails });
  const { data: prayerPageData = { records: [], totalCount: 0 } } = useMemberPrayers(member?.id, loadDashboardDetails, activeRecordPreservation, prayerPage);
  const prayers = prayerPageData.records;
  const { data: massIntentionPageData = { records: [], totalCount: 0 } } = useMemberMassIntentions(member?.id, loadDashboardDetails, activeRecordPreservation, massIntentionPage);
  const massIntentions = massIntentionPageData.records;
  const { data: helpRequests = [] } = useMemberHelpRequests(member?.id, loadDashboardDetails);
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { data: roleProfile } = useParticipationAndLeadershipProfile({
    member,
    ministries,
    ledCommunities,
    churchName: church?.name,
  });

  useEffect(() => {
    setLoadDashboardDetails(false);
    if (!member?.id || memberLoading) return;

    const browserWindow = window as Window &
      typeof globalThis & {
        requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
        cancelIdleCallback?: (handle: number) => void;
      };
    const load = () => setLoadDashboardDetails(true);

    if (browserWindow.requestIdleCallback && browserWindow.cancelIdleCallback) {
      const idleId = browserWindow.requestIdleCallback(load, { timeout: 1200 });
      return () => browserWindow.cancelIdleCallback?.(idleId);
    }

    const timeoutId = window.setTimeout(load, 450);
    return () => window.clearTimeout(timeoutId);
  }, [member?.id, memberLoading]);

  useEffect(() => {
    setPage(0);
    setPrayerPage(0);
    setMassIntentionPage(0);
  }, [member?.id, activeRecordPreservation, searchQ, catFilter]);

  // Announcements & events
  const { data: announcements = [] } = useQuery({
    queryKey: ["dash-announcements", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      return fetchPortalAnnouncements(churchId, 3);
    },
    enabled: !!churchId,
  });
  const { data: events = [] } = useQuery({
    queryKey: ["dash-events", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data } = await supabase
        .from("events")
        .select("*")
        .eq("church_id", churchId)
        .filter("status", "eq", "upcoming")
        .order("start_date")
        .limit(3)
        .returns<PortalDashboardEvent[]>();
      return data ?? [];
    },
    enabled: !!churchId && loadDashboardDetails,
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

    if (loadDashboardDetails) {
      void fetchVerse();
    }
  }, [churchId, loadDashboardDetails]);

  // ── Contribution Analytics ──
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const thisYearStart = `${now.getFullYear()}-01-01`;
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
  const visibleContributions = useMemo(
    () => activeRecordPreservation
      ? contributions
      : contributions.filter((contribution: any) => isCurrentMonthDate(getContributionDate(contribution))),
    [activeRecordPreservation, contributions],
  );
  const visiblePrayers = useMemo(
    () => activeRecordPreservation ? prayers : prayers.filter((prayer: any) => isCurrentMonthDate(prayer.created_at)),
    [activeRecordPreservation, prayers],
  );
  const visibleMassIntentions = useMemo(
    () => activeRecordPreservation
      ? massIntentions
      : massIntentions.filter((intention: any) => isCurrentMonthDate(intention.created_at)),
    [activeRecordPreservation, massIntentions],
  );

  const stats = useMemo(() => {
    const total = visibleContributions.reduce((s: number, c: any) => s + Number(c.amount), 0);
    const todayTotal = visibleContributions.filter((c: any) => {
      const contributionDate = getContributionDate(c);
      return contributionDate ? contributionDate.slice(0, 10) === today : false;
    }).reduce((s: number, c: any) => s + Number(c.amount), 0);
    const monthTotal = visibleContributions.filter((c: any) => {
      const contributionDate = getContributionDate(c);
      return contributionDate ? contributionDate.slice(0, 10) >= thisMonthStart : false;
    }).reduce((s: number, c: any) => s + Number(c.amount), 0);
    const yearTotal = visibleContributions.filter((c: any) => {
      const contributionDate = getContributionDate(c);
      return contributionDate ? contributionDate.slice(0, 10) >= thisYearStart : false;
    }).reduce((s: number, c: any) => s + Number(c.amount), 0);
    const lastMonthTotal = visibleContributions.filter((c: any) => {
      const contributionDate = getContributionDate(c);
      if (!contributionDate) return false;
      const normalizedDate = contributionDate.slice(0, 10);
      return normalizedDate >= lastMonthStart && normalizedDate <= lastMonthEnd;
    }).reduce((s: number, c: any) => s + Number(c.amount), 0);
    const lastContrib = visibleContributions.length > 0 ? visibleContributions[0] : null;
    // category breakdown
    const catMap: Record<string, number> = {};
    visibleContributions.forEach((c: any) => {
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
      const mTotal = visibleContributions.filter((c: any) => {
        const contributionDate = getContributionDate(c);
        if (!contributionDate) return false;
        const normalizedDate = contributionDate.slice(0, 10);
        return normalizedDate >= mStart && normalizedDate <= mEnd;
      }).reduce((s: number, c: any) => s + Number(c.amount), 0);
      monthlyTrend.push({ month: d.toLocaleDateString("en-US", { month: "short" }), amount: mTotal });
    }
    return { total, todayTotal, monthTotal, yearTotal, lastMonthTotal, count: visibleContributions.length, lastContrib, categoryBreakdown, monthlyTrend };
  }, [visibleContributions, t]);

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
  const filteredContribs = useMemo(() => {
    return visibleContributions;
  }, [visibleContributions]);

  const totalPages = Math.max(1, Math.ceil(contributionPageData.totalCount / PAGE_SIZE));
  const pagedContribs = filteredContribs;
  const prayerTotalPages = Math.max(1, Math.ceil(prayerPageData.totalCount / PAGE_SIZE));
  const massIntentionTotalPages = Math.max(1, Math.ceil(massIntentionPageData.totalCount / PAGE_SIZE));
  const categoryNames = useMemo(() => {
    const set = new Set<string>();
    visibleContributions.forEach((c: any) => {
      const n = (c.contribution_categories as any)?.name;
      if (n) set.add(n);
    });
    return Array.from(set);
  }, [visibleContributions]);

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
      toast({ title: "Picha ya wasifu imesasishwa" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    onSettled: () => setAvatarUploading(false),
  });

  const submitRecordPreservation = useMutation({
    mutationFn: async () => {
      if (!churchId || !member?.id) throw new Error("Wasifu wa mwanachama haukupatikana.");
      const transactionId = preservationTransactionId.trim();
      if (!transactionId) throw new Error("Namba ya muamala inahitajika.");
      if (!/^[A-Za-z0-9._-]{4,80}$/.test(transactionId)) {
        throw new Error("Tumia namba sahihi ya muamala yenye herufi, namba, nukta, vistari, au underscores.");
      }

      let proofPath: string | null = null;
      if (preservationProofFile) {
        if (preservationProofFile.size > 5 * 1024 * 1024) {
          throw new Error("Uthibitisho wa malipo lazima uwe 5MB au chini yake.");
        }
        const safeName = preservationProofFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        proofPath = `${churchId}/${member.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("record-preservation-proofs")
          .upload(proofPath, preservationProofFile, { upsert: false });

        if (uploadError) {
          logSupabaseError(uploadError, {
            page: "Portal Dashboard",
            component: "PortalDashboard",
            function: "submitRecordPreservation",
            church_id: churchId,
            operation: "storage.upload",
            bucket: "record-preservation-proofs",
            metadata: { member_id: member.id, proof_size: preservationProofFile.size },
          });
          throw uploadError;
        }
      }

      const { error } = await supabase.rpc("submit_member_record_subscription" as never, {
        p_church_id: churchId,
        p_member_id: member.id,
        p_plan_interval: preservationPlan,
        p_transaction_id: transactionId,
        p_proof_url: proofPath,
      } as never);

      if (error) {
        logSupabaseError(error, {
          page: "Portal Dashboard",
          component: "PortalDashboard",
          function: "submitRecordPreservation",
          church_id: churchId,
          operation: "rpc",
          rpc: "submit_member_record_subscription",
          metadata: { member_id: member.id, plan_interval: preservationPlan, has_proof: Boolean(proofPath) },
        });
        throw error;
      }
    },
    onSuccess: () => {
      setPreservationOpen(false);
      setPreservationTransactionId("");
      setPreservationProofFile(null);
      setPreservationPlan("monthly");
      void queryClient.invalidateQueries({ queryKey: ["member-record-preservation", member?.id, churchId] });
      toast({
        title: "Ombi la kuhifadhi rekodi limetumwa",
        description: "Ombi lako la Digital Record Preservation linasubiri ukaguzi wa mfumo.",
      });
    },
    onError: (err: any) => {
      logSupabaseError(err, {
        page: "Portal Dashboard",
        component: "PortalDashboard",
        function: "submitRecordPreservation",
        church_id: churchId,
        operation: "rpc",
        rpc: "submit_member_record_subscription",
        metadata: { member_id: member?.id, plan_interval: preservationPlan },
      });
      toast({ title: "Ombi halikuweza kutumwa", description: err.message, variant: "destructive" });
    },
  });

  const handleAvatarSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    uploadMemberPhoto.mutate(file);
    event.target.value = "";
  }, [uploadMemberPhoto]);

  const handlePreservationProofSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setPreservationProofFile(event.target.files?.[0] ?? null);
  }, []);

  const isLoading = memberLoading;
  const limitedPortal = billing.memberPortalAccess === "limited";
  const detailsLoading = !loadDashboardDetails || contribLoading;

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
              <p className="text-sm font-semibold text-primary">Ufikiaji mdogo - boresha mpango kufungua huduma zote za mwanachama</p>
              <p className="text-sm text-muted-foreground">
                Wanachama wa mpango wa bure wanaweza kuona wasifu wao na taarifa za msingi za parokia. Historia ya michango, maombi, na mawasiliano vimefungwa.
              </p>
            </div>
            <Badge variant="outline" className="border-primary/30 text-primary">
              <Lock className="mr-1 h-3 w-3" />
              Portal ya mwanachama yenye kikomo
            </Badge>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Wasifu Binafsi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <InfoRow label="Jina Kamili" value={member?.full_name || profile?.full_name} icon={User} />
              <InfoRow label="Email" value={member?.email || profile?.email} icon={Mail} />
              <InfoRow label="Simu" value={member?.phone || profile?.phone} icon={Phone} />
              <InfoRow label="Jumuiya" value={community?.name} icon={Users} />
              <InfoRow label="Huduma" value={ministryNames.length > 0 ? ministryNames.join(", ") : null} icon={Heart} />
              <InfoRow label="Tangu" value={member?.created_at ? new Date(member.created_at).toLocaleDateString() : null} icon={Calendar} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Church className="h-4 w-4 text-primary" /> Taarifa za Parokia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <InfoRow label="Parokia" value={church?.name} icon={Church} />
              <InfoRow label="Wajibu" value={userRole ? userRole.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase()) : "Mwanachama"} icon={Shield} />
              <InfoRow label="Familia" value={family?.name} icon={Users} />
              <InfoRow label="Nafasi ya Familia" value={family?.role ? family.role.charAt(0).toUpperCase() + family.role.slice(1) : null} icon={Shield} />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <LockedPortalCard title="Historia ya Michango" description="Boresha mpango kufungua rekodi za michango na takwimu." />
          <LockedPortalCard title="Maombi" description="Boresha mpango kufungua kutuma na kufuatilia maombi." />
          <LockedPortalCard title="Mawasiliano" description="Boresha mpango kufungua maombi, ujumbe, na zana za ushiriki." />
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
              <img src={member.photo_url} alt="" loading="lazy" decoding="async" className="h-16 w-16 rounded-2xl object-cover" />
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
            Karibu {church?.name || "parokia yako"}.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border/60 bg-muted/30 px-3 py-1">
              Jumuiya: {community?.name || "Haijawekwa"}
            </span>
            <span className="rounded-full border border-border/60 bg-muted/30 px-3 py-1">
              Huduma: {ministryNames.length > 0 ? ministryNames.join(", ") : "Bado"}
            </span>
          </div>
        </div>
        <Badge variant="outline" className="border-primary/30 text-primary">
          <Shield className="h-3 w-3 mr-1" />
          {userRole ? userRole.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase()) : "Mwanachama"}
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
                <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Wasifu Binafsi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <InfoRow label="Jina Kamili" value={member?.full_name} icon={User} />
                <InfoRow label="Email" value={member?.email} icon={Mail} />
                <InfoRow label="Simu" value={member?.phone} icon={Phone} />
                <InfoRow label="Jinsia" value={member?.gender ? (member.gender === "male" ? "Mwanaume" : "Mwanamke") : null} icon={Users} />
                <InfoRow label="Tarehe ya Kujiunga" value={member?.created_at ? new Date(member.created_at).toLocaleDateString() : null} icon={Calendar} />
                <InfoRow label="Namba ya Mwanachama" value={member?.id?.slice(0, 8).toUpperCase()} icon={Shield} />
              </CardContent>
            </Card>

            <div className="space-y-6">
              <MyParticipationCard
                community={community}
                communityLoading={communityLoading}
                communityError={communityError}
                communityRetrying={communityFetching}
                onRetryCommunity={() => retryCommunity()}
                ministries={ministries}
                family={family}
                roleLabels={roleProfile?.roleLabels ?? ["Member"]}
              />
              <LeadershipPanelCard leadershipScopes={roleProfile?.leadershipScopes ?? []} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Summary Cards ── */}
      <Card className="border-primary/15">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Archive className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold">Uhifadhi wa Rekodi za Kidigitali</h2>
                <Badge variant={activeRecordPreservation ? "default" : latestRecordPreservation?.status === "pending" ? "secondary" : "outline"}>
                  {activeRecordPreservation ? "Inatumika" : latestRecordPreservation?.status === "pending" ? "Inasubiri ukaguzi" : "Sasisha hifadhi"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {activeRecordPreservation && recordPreservation?.active?.end_date
                  ? `Rekodi zako zimehifadhiwa hadi ${new Date(recordPreservation.active.end_date).toLocaleDateString()}.`
                  : latestRecordPreservation?.status === "pending"
                    ? "Ombi lako la Secure Church Record Archive linasubiri ukaguzi wa mfumo."
                    : "Rekodi zako zimehifadhiwa salama. Sasisha kuona kumbukumbu zako zote za zamani."}
              </p>
              {!activeRecordPreservation ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Shughuli za mwezi huu zinaendelea kuonekana. Rekodi za zamani, muhtasari wa mwaka, na rekodi za kupakua zitafunguka tena uhifadhi ukiwa hai.
                </p>
              ) : null}
            </div>
          </div>
          <Dialog open={preservationOpen} onOpenChange={setPreservationOpen}>
            <DialogTrigger asChild>
              <Button variant={activeRecordPreservation ? "outline" : "default"}>
                {activeRecordPreservation ? "Ongeza muda wa hifadhi" : "Hifadhi rekodi"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Uhifadhi wa Rekodi za Kidigitali</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
                  <p className="font-medium">
                    {preservationPlan === "yearly" ? "TSh 30,000 / year" : "TSh 3,000 / month"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Weka namba ya muamala wa malipo ya Secure Church Record Archive. Ufikiaji wako wa kawaida wa programu ya mwanachama unabaki bure.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Mpango wa uhifadhi</Label>
                  <Select value={preservationPlan} onValueChange={(value) => setPreservationPlan(value as "monthly" | "yearly")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chagua mpango" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Kila mwezi - TSh 3,000</SelectItem>
                      <SelectItem value="yearly">Kila mwaka - TSh 30,000</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preservation-transaction">Namba ya muamala</Label>
                  <Input
                    id="preservation-transaction"
                    value={preservationTransactionId}
                    onChange={(event) => setPreservationTransactionId(event.target.value)}
                    placeholder="Weka namba ya muamala wa malipo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preservation-proof">Uthibitisho wa malipo</Label>
                  <Input id="preservation-proof" type="file" accept="image/*,.pdf" onChange={handlePreservationProofSelect} />
                  {preservationProofFile ? (
                    <p className="text-xs text-muted-foreground">{preservationProofFile.name}</p>
                  ) : null}
                </div>
                <Button
                  className="w-full"
                  onClick={() => submitRecordPreservation.mutate()}
                  disabled={submitRecordPreservation.isPending}
                >
                  {submitRecordPreservation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Tuma kwa ukaguzi
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard icon={HandCoins} label="Jumla ya Michango" value={formatTZS(stats.total)} />
        <SummaryCard icon={TrendingUp} label="Mwezi Huu" value={formatTZS(stats.monthTotal)} />
        <SummaryCard icon={BarChart3} label="Mwaka Huu" value={formatTZS(stats.yearTotal)} />
        <SummaryCard icon={Calendar} label="Mwanachama Tangu" value={member?.created_at ? new Date(member.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—"} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard icon={Gift} label="Leo" value={formatTZS(stats.todayTotal)} subtle />
        <SummaryCard icon={FileText} label="Rekodi" value={String(stats.count)} subtle />
        <SummaryCard icon={Clock} label="Mwisho Kuchangia" value={stats.lastContrib && getContributionDate(stats.lastContrib) ? new Date(getContributionDate(stats.lastContrib)!).toLocaleDateString() : "—"} subtle />
        <SummaryCard icon={Star} label="Hali" value={member?.status ? member.status.charAt(0).toUpperCase() + member.status.slice(1) : "—"} subtle />
      </div>

      {/* ── Contribution Analytics ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Takwimu za Michango</CardTitle>
        </CardHeader>
        <CardContent>
          {detailsLoading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Skeleton className="h-56 rounded-xl" />
              <Skeleton className="h-56 rounded-xl" />
            </div>
          ) : visibleContributions.length === 0 ? (
            <EmptyState icon={HandCoins} title="Bado hakuna michango" desc="Takwimu za michango yako zitaonekana hapa ukianza kuchangia." />
          ) : (
            <Suspense fallback={
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Skeleton className="h-56 rounded-xl" />
                <Skeleton className="h-56 rounded-xl" />
              </div>
            }>
              <PortalContributionCharts
                monthlyTrend={stats.monthlyTrend}
                categoryBreakdown={stats.categoryBreakdown}
                monthTotal={stats.monthTotal}
                lastMonthTotal={stats.lastMonthTotal}
              />
            </Suspense>
          )}
        </CardContent>
      </Card>

      {/* ── Contribution History ── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Historia ya Michango</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Tafuta..." className="pl-8 h-8 w-40 text-xs" value={searchQ} onChange={(e) => { setSearchQ(e.target.value); setPage(0); }} />
              </div>
              <Select value={catFilter} onValueChange={(v) => { setCatFilter(v); setPage(0); }}>
                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Aina" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Aina Zote</SelectItem>
                  {categoryNames.map((n) => <SelectItem key={n} value={n}>{translateContributionCategory(t, n, "short")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!activeRecordPreservation ? (
            <div className="mb-4 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
              Shughuli za mwezi huu zinaonyeshwa hapa. Rekodi zako zimehifadhiwa salama. Sasisha kuona kumbukumbu zako zote za zamani.
            </div>
          ) : null}
          {filteredContribs.length === 0 ? (
            <EmptyState icon={HandCoins} title="Hakuna rekodi zilizopatikana" desc="Historia ya michango yako itaonekana hapa." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Tarehe</th>
                      <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Aina</th>
                      <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Kiasi</th>
                      <th className="pb-2 text-xs font-medium text-muted-foreground hidden sm:table-cell">Dokezo</th>
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
                  <p className="text-xs text-muted-foreground">Ukurasa {page + 1} kati ya {totalPages}</p>
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
            <CardTitle className="text-base flex items-center gap-2"><Flame className="h-4 w-4 text-primary" /> Maombi Yangu</CardTitle>
          </CardHeader>
          <CardContent>
            {detailsLoading ? (
              <Skeleton className="h-32 rounded-xl" />
            ) : visiblePrayers.length === 0 ? (
              <EmptyState icon={Flame} title="Bado hakuna maombi" desc="Tuma ombi la sala na litaonekana hapa." />
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {visiblePrayers.map((p: any) => (
                  <div key={p.id} className="flex items-start justify-between gap-2 pb-3 border-b border-border/50 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.request_text}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{new Date(p.created_at).toLocaleDateString()}</p>
                    </div>
                    <Badge variant={p.status === "pending" ? "default" : "secondary"} className="shrink-0 text-xs">{p.status}</Badge>
                  </div>
                ))}
                {prayerTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-muted-foreground">Ukurasa {prayerPage + 1} kati ya {prayerTotalPages}</p>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={prayerPage === 0} onClick={() => setPrayerPage((current) => current - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={prayerPage >= prayerTotalPages - 1} onClick={() => setPrayerPage((current) => current + 1)}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {isFeatureEnabled("mass_intentions") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Heart className="h-4 w-4 text-primary" /> Nia Zangu za Misa</CardTitle>
          </CardHeader>
          <CardContent>
            {detailsLoading ? (
              <Skeleton className="h-32 rounded-xl" />
            ) : visibleMassIntentions.length === 0 ? (
              <EmptyState icon={Heart} title="Bado hakuna nia za misa" desc="Tuma nia ya misa na itaonekana hapa." />
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {visibleMassIntentions.map((m: any) => (
                  <div key={m.id} className="flex items-start justify-between gap-2 pb-3 border-b border-border/50 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{m.member_name} — {m.intention_type}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{m.message}</p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">{new Date(m.created_at).toLocaleDateString()}</p>
                    </div>
                    <Badge variant={m.status === "pending" ? "outline" : "secondary"} className="shrink-0 text-xs">{m.status}</Badge>
                  </div>
                ))}
                {massIntentionTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-muted-foreground">Ukurasa {massIntentionPage + 1} kati ya {massIntentionTotalPages}</p>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={massIntentionPage === 0} onClick={() => setMassIntentionPage((current) => current - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={massIntentionPage >= massIntentionTotalPages - 1} onClick={() => setMassIntentionPage((current) => current + 1)}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  </div>
                )}
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
          <CardTitle className="text-base flex items-center gap-2"><HelpCircle className="h-4 w-4 text-primary" /> Maombi Yangu ya Msaada</CardTitle>
        </CardHeader>
        <CardContent>
          {detailsLoading ? (
            <Skeleton className="h-32 rounded-xl" />
          ) : helpRequests.length === 0 ? (
            <EmptyState icon={HelpCircle} title="Hakuna maombi ya msaada" desc="Tuma ombi la msaada wa jumuiya na litaonekana hapa." />
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
              <CardTitle className="text-base flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary" /> Matangazo Mapya</CardTitle>
              <Button variant="ghost" size="sm" asChild><Link to="/portal/announcements">Tazama yote <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
            </div>
          </CardHeader>
          <CardContent>
            {announcements.length === 0 ? (
              <EmptyState icon={Megaphone} title="Hakuna matangazo" desc="Rudi baadaye kuona taarifa za parokia." />
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
              <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> Matukio Yajayo</CardTitle>
              <Button variant="ghost" size="sm" asChild><Link to="/portal/events">Tazama yote <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
            </div>
          </CardHeader>
          <CardContent>
            {!loadDashboardDetails ? (
              <Skeleton className="h-32 rounded-xl" />
            ) : events.length === 0 ? (
              <EmptyState icon={Calendar} title="Hakuna matukio yajayo" desc="Matukio mapya yataonekana hapa." />
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
              Dashibodi za Uongozi wa Jumuiya
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
                        Fungua wanachama, michango, ripoti, na takwimu za uongozi.
                      </p>
                    </div>
                    <Badge variant="outline" className="border-primary/30 text-primary shrink-0">
                      {ledCommunity.leadership_role}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs font-medium text-primary">
                    <span>Fungua dashibodi</span>
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
          <CardTitle className="text-base">Vitendo vya Haraka</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {isFeatureEnabled("give") && <QuickAction icon={HandCoins} label="Changia Sasa" to="/portal/give" />}
            {isFeatureEnabled("pledges") && <QuickAction icon={Target} label="Ahadi" to="/portal/pledges" />}
            {isFeatureEnabled("prayer_requests") && <QuickAction icon={Flame} label="Ombi la Sala" to="/portal/prayer-requests" />}
            {isFeatureEnabled("mass_intentions") && <QuickAction icon={Heart} label="Nia ya Misa" to="/portal/mass-intentions" />}
            {isFeatureEnabled("community_help") && <QuickAction icon={HelpCircle} label="Omba Msaada" to="/portal/community-help" />}
            {isFeatureEnabled("events") && <QuickAction icon={Calendar} label="Tazama Matukio" to="/portal/events" />}
            {isFeatureEnabled("sermons") && <QuickAction icon={BookOpen} label="Tazama Mahubiri" to="/portal/sermons" />}
            {isFeatureEnabled("announcements") && <QuickAction icon={Megaphone} label="Matangazo" to="/portal/announcements" />}
            {ledCommunities[0] && <QuickAction icon={Building2} label="Dashibodi ya Kiongozi" to={`/community/${ledCommunities[0].community_id}`} />}
            <QuickAction icon={User} label="Nyumbani" to="/portal" />
          </div>
        </CardContent>
      </Card>
      )}

      {isFeatureEnabled("pledges") && (
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Ahadi Zangu</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link to="/portal/pledges">Fungua Ahadi <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {detailsLoading ? (
            <Skeleton className="h-32 rounded-xl" />
          ) : pledges.length === 0 ? (
            <EmptyState icon={Target} title="Bado hakuna ahadi" desc="Ahadi zako zitaonekana hapa zikirekodiwa." />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SummaryCard icon={Target} label="Ahadi" value={formatTZS(pledgeSummary.pledged)} />
                <SummaryCard icon={HandCoins} label="Imelipwa" value={formatTZS(pledgeSummary.paid)} />
                <SummaryCard icon={Wallet} label="Salio" value={formatTZS(pledgeSummary.balance)} />
              </div>
              <div className="space-y-2">
                <Progress value={pledgeProgress} className="h-2.5" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{pledgeProgress.toFixed(0)}% imekamilika</span>
                  <span>{pledges.length} {pledges.length === 1 ? "ahadi" : "ahadi"}</span>
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
  communityLoading,
  communityError,
  communityRetrying,
  onRetryCommunity,
  ministries,
  family,
  roleLabels,
}: {
  community: any;
  communityLoading: boolean;
  communityError: boolean;
  communityRetrying: boolean;
  onRetryCommunity: () => void;
  ministries: any[];
  family: any;
  roleLabels: string[];
}) {
  const personalRole = roleLabels.length > 0 ? roleLabels.join(", ") : "Mwanachama";
  const jumuiyaItem = communityLoading ? (
    <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/50 p-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Users className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Jumuiya</p>
        <p className="mt-1 text-sm text-muted-foreground">Tunaangalia taarifa ya Jumuiya yako...</p>
      </div>
    </div>
  ) : communityError ? (
    <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
        <Users className="h-4 w-4 text-destructive" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Jumuiya</p>
        <p className="mt-1 text-sm text-muted-foreground">Taarifa ya Jumuiya haikuweza kupakiwa kwa sasa.</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={onRetryCommunity} disabled={communityRetrying}>
          {communityRetrying ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
          Jaribu tena
        </Button>
      </div>
    </div>
  ) : (
    <ParticipationItem
      label="Jumuiya"
      value={community?.name ?? null}
      emptyMessage="Jumuiya yako bado haijawekwa. Wasiliana na ofisi ya parokia ili kusasisha taarifa hii."
      icon={Users}
    />
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Church className="h-4 w-4 text-primary" />
          Ushiriki Wangu
        </CardTitle>
        <p className="text-sm text-muted-foreground">Mwonekano wa mwanachama pekee. Hapa unaona ushiriki wako binafsi bila kuchanganya data za usimamizi.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {jumuiyaItem}
        <ParticipationItem
          label="Huduma"
          value={ministries.length ? ministries.map((ministry: any) => ministry.name).join(", ") : null}
          emptyMessage="Bado hujawekwa kwenye huduma yoyote"
          icon={Heart}
        />
        <ParticipationItem
          label="Familia"
          value={
            family?.name
              ? [family.name, family?.role ? `(${family.role.charAt(0).toUpperCase() + family.role.slice(1)})` : null].filter(Boolean).join(" ")
              : null
          }
          emptyMessage="Bado hujawekwa kwenye familia"
          icon={Users}
        />
        <ParticipationItem
          label="Wajibu Binafsi"
          value={personalRole}
          emptyMessage="Taarifa za wajibu wako zitaonekana hapa"
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
          Jopo la Uongozi
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
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Unasimamia</p>
                <p className="mt-1 text-sm font-medium">{scope.managingLabel}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Jumla ya Wanachama</p>
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
