import { supabase } from "@/integrations/supabase/client";
import { fetchParishCalendarFeed } from "@/lib/calendar";
import { filterMemberPrayers, prayerMatchesCmsSearch, type CatholicPrayerContent } from "@/lib/catholic-cms";
import { fetchMemberCmsDailyReadingByDate } from "@/lib/super-admin/daily-readings-service";
import { fetchPublishedCmsPrayers } from "@/lib/super-admin/prayer-library-service";
import { SAINT_SELECT, type LibrarySaint } from "@/lib/catholic-library";
import { fetchMemberForUser } from "@/hooks/useMember";
import { MASS_INTENTION_SELECT, mapMassIntentionRecord, type MassIntentionWithMember } from "@/lib/member-linked-requests";
import type { KanisaAIContext, KanisaAIIntent } from "./types";

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function hasCachedRows(context: KanisaAIContext, queryKey: unknown[]) {
  const queryClient = context.queryClient;
  if (!queryClient) return false;
  return queryClient
    .getQueriesData<unknown | unknown[]>({ queryKey })
    .some(([, data]) => Array.isArray(data) ? data.length > 0 : Boolean(data));
}

function setCache(context: KanisaAIContext, queryKey: unknown[], data: unknown) {
  context.queryClient?.setQueryData(queryKey, data);
}

function normalizeQuery(input: string) {
  return input.toLowerCase().replace(/[^\p{L}\p{N}\s:,-]/gu, " ").replace(/\s+/g, " ").trim();
}

async function retrieveSaint(context: KanisaAIContext) {
  if (hasCachedRows(context, ["saint-of-day"]) || hasCachedRows(context, ["member-catholic-library-saints"])) return;

  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const { data, error } = await supabase
    .from("saints" as never)
    .select(SAINT_SELECT)
    .eq("is_active", true)
    .eq("feast_month", month)
    .eq("feast_day", day)
    .order("is_featured", { ascending: false })
    .order("name", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  const saint = data as unknown as LibrarySaint | null;
  setCache(context, ["saint-of-day", todayKey()], { liturgicalDay: null, saint });
}

async function retrieveDailyReading(context: KanisaAIContext) {
  if (hasCachedRows(context, ["member-cms-daily-reading"])) return;
  const reading = await fetchMemberCmsDailyReadingByDate(todayKey(), context.language === "sw" ? "sw" : "en");
  setCache(context, ["member-cms-daily-reading", todayKey(), context.language], reading ? [reading] : []);
}

async function retrievePrayers(context: KanisaAIContext, input: string) {
  if (hasCachedRows(context, ["member-catholic-library-prayers"])) return;
  const prayers = await fetchPublishedCmsPrayers(250);
  const text = normalizeQuery(input);
  const requestTerms = text
    .split(/\s+/)
    .filter((term) => term.length > 3 && !["find", "prayer", "show", "give", "need", "tafuta", "sala"].includes(term));
  const matches = filterMemberPrayers(prayers)
    .filter((prayer) => {
      if (prayerMatchesCmsSearch(prayer, input)) return true;
      const haystack = normalizeQuery([prayer.title, prayer.summary, prayer.body, prayer.category?.name, prayer.liturgical_season].filter(Boolean).join(" "));
      return requestTerms.some((term) => haystack.includes(term));
    })
    .slice(0, 12);

  setCache(context, ["member-catholic-library-prayers"], matches.length ? matches : prayers);
}

async function retrieveEvents(context: KanisaAIContext) {
  if (!context.church.id || hasCachedRows(context, ["parish-calendar-events", context.church.id, context.workspace])) return;
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 90);
  const events = await fetchParishCalendarFeed({ churchId: context.church.id, workspace: context.workspace, from, to });
  setCache(context, ["parish-calendar-events", context.church.id, context.workspace], events);
}

async function resolveMember(context: KanisaAIContext) {
  if (!context.user || !context.church.id) return null;
  return fetchMemberForUser({ user: context.user as never, churchId: context.church.id, select: "id, full_name, church_id, email" });
}

async function retrieveMassIntentions(context: KanisaAIContext) {
  if (context.workspace !== "member" || hasCachedRows(context, ["my-mass-intentions"])) return;
  const member = await resolveMember(context);
  if (!member?.id || !context.church.id) {
    setCache(context, ["my-mass-intentions", "unresolved", context.church.id], []);
    return;
  }

  const { data, error } = await supabase
    .from("mass_intentions")
    .select(MASS_INTENTION_SELECT)
    .eq("church_id", context.church.id)
    .eq("member_id", member.id)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) throw error;
  setCache(context, ["my-mass-intentions", member.id, context.church.id], ((data ?? []) as unknown as MassIntentionWithMember[]).map(mapMassIntentionRecord));
}

async function retrieveContributions(context: KanisaAIContext) {
  if (context.workspace !== "member" || hasCachedRows(context, ["my-contributions"])) return;
  const member = await resolveMember(context);
  if (!member?.id || !context.church.id) {
    setCache(context, ["my-contributions", "unresolved", context.church.id], []);
    return;
  }

  const { data, error } = await supabase
    .from("contributions")
    .select("id, amount, date, created_at, notes, payment_reference, category_id, contribution_categories!contributions_category_id_fkey(name)")
    .eq("church_id", context.church.id)
    .eq("member_id", member.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  setCache(context, ["my-contributions", member.id, context.church.id], data ?? []);
}

export async function retrieveKanisaAIContextForIntent(intent: KanisaAIIntent, input: string, context: KanisaAIContext) {
  if (!context.queryClient) return context;

  if (intent === "OPEN_SAINT") await retrieveSaint(context);
  if (intent === "OPEN_DAILY_READINGS") await retrieveDailyReading(context);
  if (intent === "OPEN_PRAYER_LIBRARY") await retrievePrayers(context, input);
  if (intent === "OPEN_CALENDAR" || intent === "OPEN_EVENTS") await retrieveEvents(context);
  if (intent === "OPEN_MASS_INTENTIONS") await retrieveMassIntentions(context);
  if (intent === "OPEN_CONTRIBUTIONS") await retrieveContributions(context);

  return context;
}
