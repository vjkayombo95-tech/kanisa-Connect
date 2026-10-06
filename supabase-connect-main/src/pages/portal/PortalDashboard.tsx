import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatTZS } from "@/lib/currency";
import { useBillingAccess } from "@/hooks/use-billing-access";
import { useLedCommunities } from "@/hooks/use-community-leader";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { MASS_INTENTION_SELECT, mapMassIntentionRecord } from "@/lib/member-linked-requests";
import { useMemberPledges } from "@/lib/pledges";
import { fetchPortalAnnouncements } from "@/lib/portal-announcements";
import { announcementHtmlToPlainText } from "@/lib/announcement-content";
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
import { formatAppDate } from "@/lib/localization";
import { translateContributionCategory, translateStatus } from "@/lib/translation-helpers";
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

function startCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function translateRoleLabel(t: ReturnType<typeof useTranslation>["t"], role: string | null | undefined) {
  const normalizedRole = String(role ?? "member").trim().toLowerCase();
  const dashboardKey = ["jumuiya_leader", "community_leader", "ministry_leader"].includes(normalizedRole)
    ? `member_dashboard.roles.${normalizedRole}`
    : "";
  return t(dashboardKey || `role_labels.${normalizedRole}`, { defaultValue: startCase(normalizedRole) });
}

function formatDashboardDate(
  value: Date | string | number | null | undefined,
  language: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
  fallback = "—",
) {
  if (!value) return fallback;
  return formatAppDate(value, language, options);
}

function formatGenderLabel(t: ReturnType<typeof useTranslation>["t"], value: string | null | undefined) {
  if (!value) return null;
  const normalizedGender = value.trim().toLowerCase();
  return t(`member_dashboard.gender.${normalizedGender}`, { defaultValue: startCase(normalizedGender) });
}

function translateFamilyRole(t: ReturnType<typeof useTranslation>["t"], value: string | null | undefined) {
  if (!value) return null;
  const normalizedRole = value.trim().toLowerCase();
  return t(`member_dashboard.family_roles.${normalizedRole}`, { defaultValue: startCase(normalizedRole) });
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
          roleKeys: ["member"],
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
              roleKeys: ["jumuiya_leader"],
              detailRole: ledCommunity.leadership_role || null,
              managingLabel: ledCommunity.community_name,
              memberCount: count ?? 0,
              summaryKey: "member_dashboard.leadership.summary.community",
              summaryValues: { name: ledCommunity.community_name },
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
          roleKeys: adminRoles,
          detailRole: "church_leadership",
          managingLabel: churchName || null,
          memberCount: count ?? 0,
          summaryKey: "member_dashboard.leadership.summary.admin",
          summaryValues: { name: churchName || null },
          viewMembersTo: "/church-admin/members",
          addMemberTo: "/church-admin/members",
          manageTo: "/church-admin/contributions",
        });
      }

      if (Array.from(roleKeys).some((role) => role.includes("ministry_leader"))) {
        roleKeys.add("ministry_leader");
      }

      const normalizedRoleKeys = Array.from(new Set(Array.from(roleKeys)));
      if (!normalizedRoleKeys.includes("member")) {
        normalizedRoleKeys.unshift("member");
      }

      return {
        roleKeys: normalizedRoleKeys,
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

function InfoRow({ label, value, fallback, icon: Icon }: { label: string; value: string | null | undefined; fallback: string; icon?: any }) {
  return (
    <div className="flex items-start gap-3 py-2">
      {Icon && <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value || fallback}</p>
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
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const missingValue = t("member_dashboard.common.not_set");
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
      monthlyTrend.push({ month: formatAppDate(d, i18n.language, { month: "short" }), amount: mTotal });
    }
    return { total, todayTotal, monthTotal, yearTotal, lastMonthTotal, count: visibleContributions.length, lastContrib, categoryBreakdown, monthlyTrend };
  }, [visibleContributions, t, i18n.language]);

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
      toast({ title: t("member_dashboard.toasts.photo_updated") });
    },
    onError: (err: any) => toast({ title: t("common.error"), description: err.message, variant: "destructive" }),
    onSettled: () => setAvatarUploading(false),
  });

  const submitRecordPreservation = useMutation({
    mutationFn: async () => {
      if (!churchId || !member?.id) throw new Error(t("member_dashboard.validation.member_profile_missing"));
      const transactionId = preservationTransactionId.trim();
      if (!transactionId) throw new Error(t("member_dashboard.validation.transaction_required"));
      if (!/^[A-Za-z0-9._-]{4,80}$/.test(transactionId)) {
        throw new Error(t("member_dashboard.validation.transaction_invalid"));
      }

      let proofPath: string | null = null;
      if (preservationProofFile) {
        if (preservationProofFile.size > 5 * 1024 * 1024) {
          throw new Error(t("member_dashboard.validation.proof_size"));
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
        title: t("member_dashboard.toasts.preservation_submitted_title"),
        description: t("member_dashboard.toasts.preservation_submitted_description"),
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
      toast({ title: t("member_dashboard.toasts.preservation_submit_failed"), description: err.message, variant: "destructive" });
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
              <p className="text-sm font-semibold text-primary">{t("member_dashboard.limited.title")}</p>
              <p className="text-sm text-muted-foreground">
                {t("member_dashboard.limited.description")}
              </p>
            </div>
            <Badge variant="outline" className="border-primary/30 text-primary">
              <Lock className="mr-1 h-3 w-3" />
              {t("member_dashboard.limited.badge")}
            </Badge>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4 text-primary" /> {t("member_dashboard.profile.personal_title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <InfoRow label={t("member_dashboard.profile.full_name")} value={member?.full_name || profile?.full_name} fallback={missingValue} icon={User} />
              <InfoRow label={t("member_dashboard.profile.email")} value={member?.email || profile?.email} fallback={missingValue} icon={Mail} />
              <InfoRow label={t("member_dashboard.profile.phone")} value={member?.phone || profile?.phone} fallback={missingValue} icon={Phone} />
              <InfoRow label={t("member_dashboard.participation.jumuiya")} value={community?.name} fallback={missingValue} icon={Users} />
              <InfoRow label={t("member_dashboard.participation.ministry")} value={ministryNames.length > 0 ? ministryNames.join(", ") : null} fallback={missingValue} icon={Heart} />
              <InfoRow label={t("member_dashboard.profile.since")} value={formatDashboardDate(member?.created_at, i18n.language, { dateStyle: "medium" }, "")} fallback={missingValue} icon={Calendar} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Church className="h-4 w-4 text-primary" /> {t("member_dashboard.parish.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <InfoRow label={t("member_dashboard.parish.parish")} value={church?.name} fallback={missingValue} icon={Church} />
              <InfoRow label={t("member_dashboard.parish.role")} value={translateRoleLabel(t, userRole ?? "member")} fallback={missingValue} icon={Shield} />
              <InfoRow label={t("member_dashboard.participation.family")} value={family?.name} fallback={missingValue} icon={Users} />
              <InfoRow label={t("member_dashboard.participation.family_role")} value={translateFamilyRole(t, family?.role)} fallback={missingValue} icon={Shield} />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <LockedPortalCard title={t("member_dashboard.locked.contributions_title")} description={t("member_dashboard.locked.contributions_description")} />
          <LockedPortalCard title={t("member_dashboard.locked.prayers_title")} description={t("member_dashboard.locked.prayers_description")} />
          <LockedPortalCard title={t("member_dashboard.locked.communication_title")} description={t("member_dashboard.locked.communication_description")} />
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
          <p className="text-xs text-primary font-medium uppercase tracking-wider">{t("member_dashboard.welcome.eyebrow")}</p>
          <h1 className="text-2xl md:text-3xl font-bold font-serif truncate">{displayName}</h1>
          <p className="text-sm text-muted-foreground">
            {t("member_dashboard.welcome.subtitle", { church: church?.name || t("member_dashboard.welcome.parish_fallback") })}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border/60 bg-muted/30 px-3 py-1">
              {t("member_dashboard.welcome.community", { value: community?.name || missingValue })}
            </span>
            <span className="rounded-full border border-border/60 bg-muted/30 px-3 py-1">
              {t("member_dashboard.welcome.ministry", { value: ministryNames.length > 0 ? ministryNames.join(", ") : missingValue })}
            </span>
          </div>
        </div>
        <Badge variant="outline" className="border-primary/30 text-primary">
          <Shield className="h-3 w-3 mr-1" />
          {translateRoleLabel(t, userRole ?? "member")}
        </Badge>
      </div>

      {/* ── Taarifa Zangu ── */}
      <Card className="border-primary/15 bg-gradient-to-b from-card to-card/90 shadow-[0_18px_48px_-28px_rgba(0,0,0,0.55)]">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            {t("member_dashboard.profile.section_title")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("member_dashboard.profile.section_description")}</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4 text-primary" /> {t("member_dashboard.profile.personal_title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <InfoRow label={t("member_dashboard.profile.full_name")} value={member?.full_name} fallback={missingValue} icon={User} />
                <InfoRow label={t("member_dashboard.profile.email")} value={member?.email} fallback={missingValue} icon={Mail} />
                <InfoRow label={t("member_dashboard.profile.phone")} value={member?.phone} fallback={missingValue} icon={Phone} />
                <InfoRow label={t("member_dashboard.profile.gender")} value={formatGenderLabel(t, member?.gender)} fallback={missingValue} icon={Users} />
                <InfoRow label={t("member_dashboard.profile.joined_date")} value={formatDashboardDate(member?.created_at, i18n.language, { dateStyle: "medium" }, "")} fallback={missingValue} icon={Calendar} />
                <InfoRow label={t("member_dashboard.profile.member_number")} value={member?.id?.slice(0, 8).toUpperCase()} fallback={missingValue} icon={Shield} />
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
                roleKeys={roleProfile?.roleKeys ?? ["member"]}
                t={t}
              />
              <LeadershipPanelCard leadershipScopes={roleProfile?.leadershipScopes ?? []} t={t} />
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
              <h2 className="text-base font-semibold">{t("member_dashboard.record_preservation.title")}</h2>
                <Badge variant={activeRecordPreservation ? "default" : latestRecordPreservation?.status === "pending" ? "secondary" : "outline"}>
                  {activeRecordPreservation ? t("member_dashboard.record_preservation.status.active") : latestRecordPreservation?.status === "pending" ? t("member_dashboard.record_preservation.status.pending") : t("member_dashboard.record_preservation.status.inactive")}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {activeRecordPreservation && recordPreservation?.active?.end_date
                  ? t("member_dashboard.record_preservation.active_until", { date: formatDashboardDate(recordPreservation.active.end_date, i18n.language) })
                  : latestRecordPreservation?.status === "pending"
                    ? t("member_dashboard.record_preservation.pending_description")
                    : t("member_dashboard.record_preservation.inactive_description")}
              </p>
              {!activeRecordPreservation ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("member_dashboard.record_preservation.limited_history_notice")}
                </p>
              ) : null}
            </div>
          </div>
          <Dialog open={preservationOpen} onOpenChange={setPreservationOpen}>
            <DialogTrigger asChild>
              <Button variant={activeRecordPreservation ? "outline" : "default"}>
                {activeRecordPreservation ? t("member_dashboard.record_preservation.extend_action") : t("member_dashboard.record_preservation.save_action")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("member_dashboard.record_preservation.title")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
                  <p className="font-medium">
                    {preservationPlan === "yearly" ? t("member_dashboard.record_preservation.yearly_price", { amount: formatTZS(RECORD_PRESERVATION_YEARLY_AMOUNT) }) : t("member_dashboard.record_preservation.monthly_price", { amount: formatTZS(RECORD_PRESERVATION_AMOUNT) })}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("member_dashboard.record_preservation.payment_help")}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>{t("member_dashboard.record_preservation.plan_label")}</Label>
                  <Select value={preservationPlan} onValueChange={(value) => setPreservationPlan(value as "monthly" | "yearly")}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("member_dashboard.record_preservation.plan_placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">{t("member_dashboard.record_preservation.monthly_option", { amount: formatTZS(RECORD_PRESERVATION_AMOUNT) })}</SelectItem>
                      <SelectItem value="yearly">{t("member_dashboard.record_preservation.yearly_option", { amount: formatTZS(RECORD_PRESERVATION_YEARLY_AMOUNT) })}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preservation-transaction">{t("member_dashboard.record_preservation.transaction_label")}</Label>
                  <Input
                    id="preservation-transaction"
                    value={preservationTransactionId}
                    onChange={(event) => setPreservationTransactionId(event.target.value)}
                    placeholder={t("member_dashboard.record_preservation.transaction_placeholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preservation-proof">{t("member_dashboard.record_preservation.proof_label")}</Label>
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
                  {t("member_dashboard.record_preservation.submit_action")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard icon={HandCoins} label={t("member_dashboard.summary.total_contributions")} value={formatTZS(stats.total)} />
        <SummaryCard icon={TrendingUp} label={t("member_dashboard.summary.this_month")} value={formatTZS(stats.monthTotal)} />
        <SummaryCard icon={BarChart3} label={t("member_dashboard.summary.this_year")} value={formatTZS(stats.yearTotal)} />
        <SummaryCard icon={Calendar} label={t("member_dashboard.summary.member_since")} value={formatDashboardDate(member?.created_at, i18n.language, { month: "short", year: "numeric" }, missingValue)} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard icon={Gift} label={t("member_dashboard.summary.today")} value={formatTZS(stats.todayTotal)} subtle />
        <SummaryCard icon={FileText} label={t("member_dashboard.summary.records")} value={String(stats.count)} subtle />
        <SummaryCard icon={Clock} label={t("member_dashboard.summary.last_contribution")} value={formatDashboardDate(stats.lastContrib ? getContributionDate(stats.lastContrib) : null, i18n.language, undefined, missingValue)} subtle />
        <SummaryCard icon={Star} label={t("member_dashboard.summary.status")} value={member?.status ? translateStatus(t, member.status) : missingValue} subtle />
      </div>

      {/* ── Contribution Analytics ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> {t("member_dashboard.contributions.analytics_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {detailsLoading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Skeleton className="h-56 rounded-xl" />
              <Skeleton className="h-56 rounded-xl" />
            </div>
          ) : visibleContributions.length === 0 ? (
            <EmptyState icon={HandCoins} title={t("member_dashboard.contributions.analytics_empty_title")} desc={t("member_dashboard.contributions.analytics_empty_description")} />
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
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> {t("member_dashboard.contributions.history_title")}</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder={t("member_dashboard.contributions.search_placeholder")} aria-label={t("member_dashboard.contributions.search_label")} className="pl-8 h-8 w-40 text-xs" value={searchQ} onChange={(e) => { setSearchQ(e.target.value); setPage(0); }} />
              </div>
              <Select value={catFilter} onValueChange={(v) => { setCatFilter(v); setPage(0); }}>
                <SelectTrigger className="h-8 w-36 text-xs" aria-label={t("member_dashboard.contributions.category_filter_label")}><SelectValue placeholder={t("member_dashboard.contributions.category_placeholder")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("member_dashboard.contributions.all_categories")}</SelectItem>
                  {categoryNames.map((n) => <SelectItem key={n} value={n}>{translateContributionCategory(t, n, "short")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!activeRecordPreservation ? (
            <div className="mb-4 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
              {t("member_dashboard.record_preservation.limited_history_notice")}
            </div>
          ) : null}
          {filteredContribs.length === 0 ? (
            <EmptyState icon={HandCoins} title={t("member_dashboard.contributions.empty_title")} desc={t("member_dashboard.contributions.empty_description")} />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">{t("member_dashboard.contributions.date")}</th>
                      <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">{t("member_dashboard.contributions.category")}</th>
                      <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">{t("member_dashboard.contributions.amount")}</th>
                      <th className="pb-2 text-xs font-medium text-muted-foreground hidden sm:table-cell">{t("member_dashboard.contributions.note")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedContribs.map((c: any) => (
                      <tr key={c.id} className="border-b border-border/50 last:border-0">
                        <td className="py-2.5 pr-4 text-xs">{formatDashboardDate(c.date, i18n.language, undefined, missingValue)}</td>
                        <td className="py-2.5 pr-4">
                          <Badge variant="secondary" className="text-xs">{(c.contribution_categories as any)?.name ? translateContributionCategory(t, (c.contribution_categories as any)?.name, "short") : missingValue}</Badge>
                        </td>
                        <td className="py-2.5 pr-4 font-semibold text-primary">{formatTZS(Number(c.amount))}</td>
                        <td className="py-2.5 text-xs text-muted-foreground hidden sm:table-cell truncate max-w-[200px]">{c.notes || missingValue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-xs text-muted-foreground">{t("member_dashboard.pagination.page_of", { page: page + 1, total: totalPages })}</p>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("member_dashboard.pagination.previous")} disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("member_dashboard.pagination.next")} disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
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
            <CardTitle className="text-base flex items-center gap-2"><Flame className="h-4 w-4 text-primary" /> {t("member_dashboard.prayers.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {detailsLoading ? (
              <Skeleton className="h-32 rounded-xl" />
            ) : visiblePrayers.length === 0 ? (
              <EmptyState icon={Flame} title={t("member_dashboard.prayers.empty_title")} desc={t("member_dashboard.prayers.empty_description")} />
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {visiblePrayers.map((p: any) => (
                  <div key={p.id} className="flex items-start justify-between gap-2 pb-3 border-b border-border/50 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.request_text}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDashboardDate(p.created_at, i18n.language, undefined, missingValue)}</p>
                    </div>
                    <Badge variant={p.status === "pending" ? "default" : "secondary"} className="shrink-0 text-xs">{translateStatus(t, p.status)}</Badge>
                  </div>
                ))}
                {prayerTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-muted-foreground">{t("member_dashboard.pagination.page_of", { page: prayerPage + 1, total: prayerTotalPages })}</p>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("member_dashboard.pagination.previous")} disabled={prayerPage === 0} onClick={() => setPrayerPage((current) => current - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("member_dashboard.pagination.next")} disabled={prayerPage >= prayerTotalPages - 1} onClick={() => setPrayerPage((current) => current + 1)}><ChevronRight className="h-4 w-4" /></Button>
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
            <CardTitle className="text-base flex items-center gap-2"><Heart className="h-4 w-4 text-primary" /> {t("member_dashboard.mass_intentions.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {detailsLoading ? (
              <Skeleton className="h-32 rounded-xl" />
            ) : visibleMassIntentions.length === 0 ? (
              <EmptyState icon={Heart} title={t("member_dashboard.mass_intentions.empty_title")} desc={t("member_dashboard.mass_intentions.empty_description")} />
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {visibleMassIntentions.map((m: any) => (
                  <div key={m.id} className="flex items-start justify-between gap-2 pb-3 border-b border-border/50 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{m.member_name} — {m.intention_type}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{m.message}</p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">{formatDashboardDate(m.created_at, i18n.language, undefined, missingValue)}</p>
                    </div>
                    <Badge variant={m.status === "pending" ? "outline" : "secondary"} className="shrink-0 text-xs">{translateStatus(t, m.status)}</Badge>
                  </div>
                ))}
                {massIntentionTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-muted-foreground">{t("member_dashboard.pagination.page_of", { page: massIntentionPage + 1, total: massIntentionTotalPages })}</p>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("member_dashboard.pagination.previous")} disabled={massIntentionPage === 0} onClick={() => setMassIntentionPage((current) => current - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("member_dashboard.pagination.next")} disabled={massIntentionPage >= massIntentionTotalPages - 1} onClick={() => setMassIntentionPage((current) => current + 1)}><ChevronRight className="h-4 w-4" /></Button>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isFeatureEnabled("announcements") && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary" /> {t("member_dashboard.announcements.title")}</CardTitle>
              <Button variant="ghost" size="sm" asChild><Link to="/portal/announcements">{t("member_dashboard.actions.view_all")} <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
            </div>
          </CardHeader>
          <CardContent>
            {announcements.length === 0 ? (
              <EmptyState icon={Megaphone} title={t("member_dashboard.announcements.empty_title")} desc={t("member_dashboard.announcements.empty_description")} />
            ) : (
              <div className="space-y-3">
                {announcements.map((a: any) => (
                  <div key={a.id} className="pb-3 border-b border-border/50 last:border-0">
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{announcementHtmlToPlainText(a.content)}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">{formatDashboardDate(a.created_at, i18n.language, undefined, missingValue)}</p>
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
              <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> {t("member_dashboard.events.title")}</CardTitle>
              <Button variant="ghost" size="sm" asChild><Link to="/portal/events">{t("member_dashboard.actions.view_all")} <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
            </div>
          </CardHeader>
          <CardContent>
            {!loadDashboardDetails ? (
              <Skeleton className="h-32 rounded-xl" />
            ) : events.length === 0 ? (
              <EmptyState icon={Calendar} title={t("member_dashboard.events.empty_title")} desc={t("member_dashboard.events.empty_description")} />
            ) : (
              <div className="space-y-3">
                {events.map((e: any) => (
                  <div key={e.id} className="pb-3 border-b border-border/50 last:border-0">
                    <p className="text-xs text-primary font-medium">{formatDashboardDate(e.start_date, i18n.language, { weekday: "short", month: "short", day: "numeric" }, missingValue)}</p>
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
              {t("member_dashboard.community_leadership.title")}
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
                        {t("member_dashboard.community_leadership.description")}
                      </p>
                    </div>
                    <Badge variant="outline" className="border-primary/30 text-primary shrink-0">
                      {ledCommunity.leadership_role}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs font-medium text-primary">
                    <span>{t("member_dashboard.community_leadership.open_dashboard")}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Quick Actions ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("member_dashboard.quick_actions.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {isFeatureEnabled("give") && <QuickAction icon={HandCoins} label={t("member_dashboard.quick_actions.give")} to="/portal/give" />}
            {isFeatureEnabled("pledges") && <QuickAction icon={Target} label={t("member_dashboard.quick_actions.pledges")} to="/portal/pledges" />}
            {isFeatureEnabled("prayer_requests") && <QuickAction icon={Flame} label={t("member_dashboard.quick_actions.prayer_request")} to="/portal/prayer-requests" />}
            {isFeatureEnabled("mass_intentions") && <QuickAction icon={Heart} label={t("member_dashboard.quick_actions.mass_intention")} to="/portal/mass-intentions" />}
            {isFeatureEnabled("events") && <QuickAction icon={Calendar} label={t("member_dashboard.quick_actions.events")} to="/portal/events" />}
            {isFeatureEnabled("sermons") && <QuickAction icon={BookOpen} label={t("member_dashboard.quick_actions.sermons")} to="/portal/sermons" />}
            {isFeatureEnabled("announcements") && <QuickAction icon={Megaphone} label={t("member_dashboard.quick_actions.announcements")} to="/portal/announcements" />}
            {ledCommunities[0] && <QuickAction icon={Building2} label={t("member_dashboard.quick_actions.leader_dashboard")} to={`/community/${ledCommunities[0].community_id}`} />}
            <QuickAction icon={User} label={t("member_dashboard.quick_actions.home")} to="/portal" />
          </div>
        </CardContent>
      </Card>

      {isFeatureEnabled("pledges") && (
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> {t("member_dashboard.pledges.title")}</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link to="/portal/pledges">{t("member_dashboard.pledges.open")} <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {detailsLoading ? (
            <Skeleton className="h-32 rounded-xl" />
          ) : pledges.length === 0 ? (
            <EmptyState icon={Target} title={t("member_dashboard.pledges.empty_title")} desc={t("member_dashboard.pledges.empty_description")} />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SummaryCard icon={Target} label={t("member_dashboard.pledges.pledged")} value={formatTZS(pledgeSummary.pledged)} />
                <SummaryCard icon={HandCoins} label={t("member_dashboard.pledges.paid")} value={formatTZS(pledgeSummary.paid)} />
                <SummaryCard icon={Wallet} label={t("member_dashboard.pledges.balance")} value={formatTZS(pledgeSummary.balance)} />
              </div>
              <div className="space-y-2">
                <Progress value={pledgeProgress} className="h-2.5" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("member_dashboard.pledges.progress", { percent: pledgeProgress.toFixed(0) })}</span>
                  <span>{t("member_dashboard.pledges.count", { count: pledges.length })}</span>
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
              <p className="text-xs font-medium text-primary uppercase tracking-wider">{t("member_dashboard.verse.title")}</p>
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
  roleKeys,
  t,
}: {
  community: any;
  communityLoading: boolean;
  communityError: boolean;
  communityRetrying: boolean;
  onRetryCommunity: () => void;
  ministries: any[];
  family: any;
  roleKeys: string[];
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const personalRole = roleKeys.length > 0 ? roleKeys.map((role) => translateRoleLabel(t, role)).join(", ") : translateRoleLabel(t, "member");
  const jumuiyaItem = communityLoading ? (
    <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/50 p-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Users className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("member_dashboard.participation.jumuiya")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("member_dashboard.participation.community_loading")}</p>
      </div>
    </div>
  ) : communityError ? (
    <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
        <Users className="h-4 w-4 text-destructive" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("member_dashboard.participation.jumuiya")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("member_dashboard.participation.community_error")}</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={onRetryCommunity} disabled={communityRetrying}>
          {communityRetrying ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
          {t("member_dashboard.actions.retry")}
        </Button>
      </div>
    </div>
  ) : (
    <ParticipationItem
      label={t("member_dashboard.participation.jumuiya")}
      value={community?.name ?? null}
      emptyMessage={t("member_dashboard.participation.community_empty")}
      icon={Users}
    />
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Church className="h-4 w-4 text-primary" />
          {t("member_dashboard.participation.title")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("member_dashboard.participation.description")}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {jumuiyaItem}
        <ParticipationItem
          label={t("member_dashboard.participation.ministry")}
          value={ministries.length ? ministries.map((ministry: any) => ministry.name).join(", ") : null}
          emptyMessage={t("member_dashboard.participation.ministry_empty")}
          icon={Heart}
        />
        <ParticipationItem
          label={t("member_dashboard.participation.family")}
          value={
            family?.name
              ? [family.name, family?.role ? `(${translateFamilyRole(t, family.role)})` : null].filter(Boolean).join(" ")
              : null
          }
          emptyMessage={t("member_dashboard.participation.family_empty")}
          icon={Users}
        />
        <ParticipationItem
          label={t("member_dashboard.participation.personal_role")}
          value={personalRole}
          emptyMessage={t("member_dashboard.participation.role_empty")}
          icon={Shield}
        />
      </CardContent>
    </Card>
  );
}

function LeadershipPanelCard({ leadershipScopes, t }: { leadershipScopes: any[]; t: ReturnType<typeof useTranslation>["t"] }) {
  if (!leadershipScopes.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          {t("member_dashboard.leadership.title")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("member_dashboard.leadership.description")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {leadershipScopes.map((scope) => (
          <div key={scope.id} className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{(scope.roleKeys ?? []).map((role: string) => translateRoleLabel(t, role)).join(", ")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{String(t(scope.summaryKey, { ...(scope.summaryValues ?? {}), name: scope.summaryValues?.name ?? t("member_dashboard.leadership.this_church") }))}</p>
              </div>
              <Badge variant="outline" className="border-primary/30 text-primary">
                {scope.id === "church-admin-scope" ? t("member_dashboard.leadership.church_leadership") : scope.detailRole || t("member_dashboard.leadership.leader")}
              </Badge>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("member_dashboard.leadership.managing")}</p>
                <p className="mt-1 text-sm font-medium">{scope.managingLabel ?? t("member_dashboard.leadership.church_members_operations")}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("member_dashboard.leadership.member_count")}</p>
                <p className="mt-1 text-sm font-medium">{scope.memberCount}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link to={scope.viewMembersTo}>{t("member_dashboard.leadership.view_members")}</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to={scope.addMemberTo}>{t("member_dashboard.leadership.add_member")}</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to={scope.manageTo}>{t("member_dashboard.leadership.manage_attendance_contributions")}</Link>
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


