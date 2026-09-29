import { useMemo, useRef, useState } from "react";

import { BookOpen, CalendarDays, Church, HandCoins, Megaphone, Radio, Send, Sparkles, Star } from "lucide-react";

import { AppLink } from "@/components/AppLink";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { useAuth } from "@/contexts/AuthContext";

import { useChurchLivestream } from "@/hooks/use-church-livestream";

import { useFeatureAccess } from "@/hooks/use-feature-access";

import { useLinkedMember } from "@/hooks/use-linked-member";

import { formatTZS } from "@/lib/currency";

import { fetchLatestAnnouncement, fetchNextTimetableMass, type MemberNextMass } from "@/lib/member-daily-life";

import { fetchMemberContributionTotalForRange } from "@/lib/member-contributions";

import { fetchOwnMassIntentionsSummary, type OwnMassIntentionsSummary } from "@/lib/member-linked-requests";

import {

  readOwnContributionSummary,

  resolveMemberAssistantIntent,

  type MemberAssistantResolution,

} from "@/lib/member-assistant";

import { cn } from "@/lib/utils";

type ConversationMessage = {

  id: string;

  role: "member" | "assistant";

  text: string;

  resolution?: MemberAssistantResolution;

};

const quickQuestions = [

  { id: "contributions", label: "Michango yangu", question: "Nionyeshe historia ya michango", icon: HandCoins },

  { id: "mass", label: "Nia za Misa", question: "Nia za Misa", icon: Church },

  { id: "announcements", label: "Matangazo", question: "Matangazo", icon: Megaphone },

  { id: "readings", label: "Masomo ya leo", question: "Masomo ya leo", icon: BookOpen },

  { id: "calendar", label: "Kalenda", question: "Kalenda ya parokia", icon: CalendarDays },

  { id: "prayers", label: "Sala", question: "Sala", icon: Sparkles },

  { id: "reflections", label: "Tafakari", question: "Tafakari", icon: Sparkles },

  { id: "saints", label: "Watakatifu", question: "Watakatifu", icon: Star },

  { id: "radio", label: "Radio", question: "Radio", icon: Radio },

] as const;

const CONTRIBUTION_HISTORY_ROUTE = "/portal/contribution-history";

const PARISH_SCHEDULE_ROUTE = "/portal/calendar";

const ANNOUNCEMENTS_ROUTE = "/portal/announcements";

const MASS_INTENTIONS_ROUTE = "/portal/mass-intentions";

const ANNOUNCEMENT_PREVIEW_LIMIT = 160;

const MASS_WEEKDAYS = ["Jumapili", "Jumatatu", "Jumanne", "Jumatano", "Alhamisi", "Ijumaa", "Jumamosi"];

const MASS_MONTHS = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ago", "Sep", "Okt", "Nov", "Des"];

function contributionAnswer(
  range: NonNullable<MemberAssistantResolution["contributionRange"]>,
  total: number,
) {
  if (total <= 0) {
    if (range === "today") {
      return "Hakuna mchango wako uliorekodiwa leo. Ungependa kuangalia wiki hii au mwezi huu?";
    }
    if (range === "this_week") {
      return "Hakuna mchango wako uliorekodiwa wiki hii. Ungependa kuangalia leo, mwezi huu, au jumla yako?";
    }
    if (range === "this_month") {
      return "Hakuna mchango wako uliorekodiwa mwezi huu. Ungependa kuangalia leo, wiki hii, au jumla yako?";
    }
    return "Hakuna mchango wako uliorekodiwa kwa sasa. Ungependa kuangalia kipindi kingine?";
  }

  if (range === "today") {
    return `Leo umechangia ${formatTZS(total)}. Ungependa kuona wiki hii au mwezi huu?`;
  }
  if (range === "this_week") {
    return `Wiki hii umechangia ${formatTZS(total)}. Ungependa kuona leo, mwezi huu, au jumla yako?`;
  }
  if (range === "this_month") {
    return `Mwezi huu umechangia ${formatTZS(total)}. Ungependa kuona leo, wiki hii, au jumla yako?`;
  }
  return `Mpaka sasa una michango ya ${formatTZS(total)} iliyorekodiwa. Ungependa kuona leo, wiki hii, au mwezi huu?`;
}

function parseMassDateTime(massDate: string, startTime: string) {

  const dateMatch = massDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  const timeMatch = startTime.match(/^(\d{2}):(\d{2})/);

  if (!dateMatch || !timeMatch) return null;

  const [, yearText, monthText, dayText] = dateMatch;

  const [, hourText, minuteText] = timeMatch;

  const year = Number(yearText);

  const month = Number(monthText);

  const day = Number(dayText);

  const hour = Number(hourText);

  const minute = Number(minuteText);

  if (hour > 23 || minute > 59) return null;

  const localDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));

  if (localDate.getUTCFullYear() !== year || localDate.getUTCMonth() !== month - 1 || localDate.getUTCDate() !== day) return null;

  return { year, month, day, hour, minute, weekday: localDate.getUTCDay() };

}

function formatMassHour(hour: number) {

  if (hour < 12) return "asubuhi";

  if (hour < 16) return "mchana";

  if (hour < 19) return "jioni";

  return "usiku";

}

function formatNextMassAnswer(mass: MemberNextMass) {

  const parts = parseMassDateTime(mass.massDate, mass.startTime);

  const title = mass.title?.trim();

  if (!parts) {

    return title ? `Misa ijayo ni ${title}.` : "Misa ijayo imepangwa kwenye ratiba ya parokia.";

  }

  const dateLabel = `${MASS_WEEKDAYS[parts.weekday]} ${parts.day} ${MASS_MONTHS[parts.month - 1]} ${parts.year}`;

  const timeLabel = `${parts.hour}:${String(parts.minute).padStart(2, "0")} ${formatMassHour(parts.hour)}`;

  const prefix = title ? `Misa ijayo ni ${title},` : "Misa ijayo ni";

  return `${prefix} ${dateLabel} saa ${timeLabel}.`;

}

function decodeAnnouncementEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}
function announcementPreview(content: string | null | undefined) {

  const clean = decodeAnnouncementEntities(String(content ?? ""))

    .replace(/<[^>]*>/g, " ")

    .replace(/\s+/g, " ")

    .trim();

  if (!clean) return "";

  if (clean.length <= ANNOUNCEMENT_PREVIEW_LIMIT) return clean;

  return `${clean.slice(0, ANNOUNCEMENT_PREVIEW_LIMIT).trimEnd()}...`;

}

function formatAnnouncementAnswer(title: string, content: string | null | undefined) {

  const cleanTitle = title.trim() || "Tangazo";

  const preview = announcementPreview(content);

  return preview

    ? `Tangazo la hivi karibuni ni "${cleanTitle}". ${preview}`

    : `Tangazo la hivi karibuni ni "${cleanTitle}".`;

}

function pluralNia(count: number) {

  return count === 1 ? "Nia 1 ya Misa" : `Nia ${count} za Misa`;

}

function statusPart(count: number, label: string) {

  return count > 0 ? `${count} ${label}` : null;

}

function joinStatusParts(parts: string[]) {

  if (parts.length <= 1) return parts[0] ?? "";

  return `${parts.slice(0, -1).join(", ")} na ${parts[parts.length - 1]}`;

}

function formatMassIntentionsSummaryAnswer(summary: OwnMassIntentionsSummary) {

  if (summary.total <= 0) return "Huna Nia za Misa zilizorekodiwa kwa sasa.";

  const parts = [

    statusPart(summary.approved, "imekubaliwa"),

    statusPart(summary.scheduled, "imepangwa"),

    statusPart(summary.completed, "imekamilika"),

    statusPart(summary.pending, "inasubiri"),

    statusPart(summary.rejected, "imekataliwa"),

    statusPart(summary.archived, "imehifadhiwa"),

  ].filter((part): part is string => Boolean(part));

  return `Una ${pluralNia(summary.total)}: ${joinStatusParts(parts)}.`;

}

export default function KanisaAssistantPage() {

  const { churchId, profile, user } = useAuth();

  const { data: linkedMember } = useLinkedMember();

  const { getFeatureState } = useFeatureAccess();

  const livestream = useChurchLivestream();

  const [draft, setDraft] = useState("");

  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  const [isAnswering, setIsAnswering] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const firstName = String(profile?.full_name || user?.user_metadata?.full_name || "Mshirika").trim().split(/\s+/)[0];

  const churchName = String(profile?.church_name || "parokia yako").trim();

  const capabilities = useMemo(() => ({

    radioEnabled: getFeatureState("radio").visible,

    liveMassAvailable: livestream.featureEnabled && Boolean(livestream.data),

  }), [getFeatureState, livestream.data, livestream.featureEnabled]);

  const ask = async (question: string) => {

    const text = question.trim();

    if (!text || isAnswering) return;

    const resolution = resolveMemberAssistantIntent(text, capabilities);

    const stamp = `${Date.now()}-${messages.length}`;

    setMessages((current) => [...current, { id: `member-${stamp}`, role: "member", text }]);

    setDraft("");

    setIsAnswering(true);

    let answer = resolution.response;

    let assistantResolution = resolution;

    if (resolution.intent === "contribution_summary") {

      if (!churchId || !linkedMember?.id) {

        answer = "Akaunti yako haijaunganishwa na rekodi ya mwanachama. Tumia Historia ya Michango kwa msaada zaidi.";

      } else {

        try {

          const total = await readOwnContributionSummary(churchId, linkedMember.id);

          answer = total > 0

            ? `Jumla ya michango yako iliyorekodiwa ni ${formatTZS(total)}.`

            : "Hakuna michango iliyorekodiwa kwenye akaunti yako kwa sasa.";

        } catch {

          answer = "Taarifa za michango hazikuweza kupakiwa kwa sasa. Tafadhali jaribu tena baadaye.";

        }

      }

    }

    if (resolution.intent === "own_contributions" && resolution.contributionRange) {

      if (!churchId || !linkedMember?.id) {

        answer = "Akaunti yako haijaunganishwa na rekodi ya mwanachama. Taarifa za michango haziwezi kupatikana kwa sasa.";

      } else {

        try {

          const total = await fetchMemberContributionTotalForRange(churchId, linkedMember.id, resolution.contributionRange);

          answer = contributionAnswer(resolution.contributionRange, total);

          assistantResolution = { ...resolution, action: "navigate", route: CONTRIBUTION_HISTORY_ROUTE, actionLabel: "Angalia historia yangu" };

        } catch {

          answer = "Taarifa za michango hazikuweza kupakiwa kwa sasa. Tafadhali jaribu tena.";

        }

      }

    }

    if (resolution.intent === "next_mass") {

      if (!churchId) {

        answer = "Ratiba ya Misa haikuweza kupakiwa kwa sasa. Tafadhali jaribu tena.";

      } else {

        try {

          const mass = await fetchNextTimetableMass(churchId);

          answer = mass ? formatNextMassAnswer(mass) : "Hakuna Misa ijayo iliyopangwa kwa sasa.";

          if (mass) {

            assistantResolution = { ...resolution, action: "navigate", route: PARISH_SCHEDULE_ROUTE, actionLabel: "Angalia ratiba" };

          }

        } catch {

          answer = "Ratiba ya Misa haikuweza kupakiwa kwa sasa. Tafadhali jaribu tena.";

        }

      }

    }

    if (resolution.intent === "latest_announcement") {

      if (!churchId) {

        answer = "Matangazo hayakuweza kupakiwa kwa sasa. Tafadhali jaribu tena.";

      } else {

        try {

          const announcement = await fetchLatestAnnouncement(churchId);

          answer = announcement ? formatAnnouncementAnswer(announcement.title, announcement.content) : "Hakuna tangazo jipya kwa sasa.";

          if (announcement) {

            assistantResolution = { ...resolution, action: "navigate", route: ANNOUNCEMENTS_ROUTE, actionLabel: "Fungua Matangazo" };

          }

        } catch {

          answer = "Matangazo hayakuweza kupakiwa kwa sasa. Tafadhali jaribu tena.";

        }

      }

    }

    if (resolution.intent === "mass_intentions" && resolution.massIntentionsMode === "status") {

      if (!churchId || !linkedMember?.id) {

        answer = "Akaunti yako haijaunganishwa na rekodi ya mwanachama. Hali ya Nia za Misa haiwezi kupatikana kwa sasa.";

      } else {

        try {

          const summary = await fetchOwnMassIntentionsSummary(churchId, linkedMember.id);

          answer = formatMassIntentionsSummaryAnswer(summary);

          if (summary.total > 0) {

            assistantResolution = { ...resolution, action: "navigate", route: MASS_INTENTIONS_ROUTE, actionLabel: "Fungua Nia za Misa" };

          }

        } catch {

          answer = "Nia za Misa hazikuweza kupakiwa kwa sasa. Tafadhali jaribu tena.";

        }

      }

    }

    setMessages((current) => [...current, { id: `assistant-${stamp}`, role: "assistant", text: answer, resolution: assistantResolution }]);

    setIsAnswering(false);

    window.setTimeout(() => inputRef.current?.focus(), 0);

  };

  return (

    <main className="mx-auto flex min-h-[calc(100svh-8rem)] w-full max-w-3xl flex-col px-4 py-5 pb-28 lg:min-h-[calc(100svh-12rem)] lg:px-8 lg:pb-8" data-testid="uliza-kanisa-page">

      <header className="flex items-center gap-3 border-b border-border/70 pb-4">

        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Church className="h-6 w-6" aria-hidden="true" /></span>

        <div className="min-w-0"><h1 className="text-2xl font-bold">Uliza Kanisa</h1><p className="break-words text-sm text-muted-foreground">Uliza kuhusu huduma za kanisa lako</p></div>

      </header>

      <div className="flex-1 space-y-5 overflow-y-auto py-5" aria-live="polite">

        {!messages.length ? (

          <>

            <section className="rounded-3xl bg-primary/5 p-5 sm:p-6">

              <p className="text-lg font-bold">Habari {firstName}</p>

              <p className="mt-2 break-words text-base leading-7 text-muted-foreground">Ninaweza kukusaidia kupata huduma na taarifa zilizoidhinishwa za {churchName}. Chagua huduma au andika swali rahisi.</p>

            </section>

            <section aria-labelledby="uliza-quick-actions">

              <h2 id="uliza-quick-actions" className="text-lg font-bold">Maswali ya haraka</h2>

              <div className="mt-3 grid grid-cols-1 gap-3 min-[340px]:grid-cols-2">

                {quickQuestions.map((item) => {

                  const Icon = item.icon;

                  return <button key={item.id} type="button" onClick={() => void ask(item.question)} className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-border/70 bg-card px-3 py-2 text-left shadow-sm transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-5 w-5" aria-hidden="true" /></span><span className="min-w-0 text-sm font-bold leading-5">{item.label}</span></button>;

                })}

              </div>

            </section>

          </>

        ) : messages.map((message) => (

          <article key={message.id} className={cn("flex", message.role === "member" ? "justify-end" : "justify-start")}>

            <div className={cn("max-w-[88%] rounded-3xl px-4 py-3 text-base leading-6", message.role === "member" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted text-foreground")}>

              <p className="whitespace-pre-line">{message.text}</p>

              {message.role === "assistant" && message.resolution?.route && message.resolution.action === "navigate" ? <Button asChild className="mt-3 min-h-11 rounded-xl"><AppLink to={message.resolution.route}>{message.resolution.actionLabel ?? "Fungua"}</AppLink></Button> : null}

              {message.role === "assistant" && message.resolution?.intent === "own_contributions" ? (
                <div className="mt-3 flex flex-wrap gap-2" aria-label="Chagua kipindi cha michango">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isAnswering}
                    onClick={() => void ask("Nimechangia kiasi gani leo?")}
                  >
                    Leo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isAnswering}
                    onClick={() => void ask("Nimechangia kiasi gani wiki hii?")}
                  >
                    Wiki hii
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isAnswering}
                    onClick={() => void ask("Nimechangia kiasi gani mwezi huu?")}
                  >
                    Mwezi huu
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isAnswering}
                    onClick={() => void ask("Nimechangia kiasi gani?")}
                  >
                    Jumla yangu
                  </Button>
                </div>
              ) : null}

              {message.role === "assistant" && message.resolution?.intent === "unknown" ? <div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => void ask("Matangazo")}>Matangazo</Button><Button type="button" variant="outline" onClick={() => void ask("Masomo ya leo")}>Masomo ya leo</Button></div> : null}

            </div>

          </article>

        ))}

        {isAnswering ? <p className="text-sm text-muted-foreground" role="status">Inapakia taarifa...</p> : null}

      </div>

      <form onSubmit={(event) => { event.preventDefault(); void ask(draft); }} className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 mt-auto border-t border-border/70 bg-background/95 py-3 backdrop-blur lg:bottom-0">

        <label htmlFor="uliza-kanisa-input" className="sr-only">Andika swali lako</label>

        <div className="flex items-center gap-2 rounded-3xl border border-border bg-card p-2 shadow-sm">

          <Input ref={inputRef} id="uliza-kanisa-input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Andika swali lako..." className="h-12 min-w-0 flex-1 border-0 bg-transparent text-base shadow-none focus-visible:ring-0" autoComplete="off" />

          <Button type="submit" size="icon" disabled={!draft.trim() || isAnswering} className="h-12 w-12 shrink-0 rounded-full" aria-label="Tuma swali"><Send className="h-5 w-5" /></Button>

        </div>

      </form>

    </main>

  );

}