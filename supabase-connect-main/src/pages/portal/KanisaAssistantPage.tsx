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
import {
  readOwnContributionSummary,
  resolveMemberAssistantIntent,
  type MemberAssistantIntent,
  type MemberAssistantResolution,
} from "@/lib/member-assistant";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

type ConversationMessage = {
  id: string;
  role: "member" | "assistant";
  text: string;
  resolution?: MemberAssistantResolution;
};

const quickQuestions = [
  { id: "contributions", labelKey: "member_assistant.quick_questions.contributions", question: "Nionyeshe historia ya michango", icon: HandCoins },
  { id: "mass", labelKey: "member_assistant.quick_questions.mass", question: "Nia za Misa", icon: Church },
  { id: "announcements", labelKey: "member_assistant.quick_questions.announcements", question: "Matangazo", icon: Megaphone },
  { id: "readings", labelKey: "member_assistant.quick_questions.readings", question: "Masomo ya leo", icon: BookOpen },
  { id: "calendar", labelKey: "member_assistant.quick_questions.calendar", question: "Kalenda ya parokia", icon: CalendarDays },
  { id: "prayers", labelKey: "member_assistant.quick_questions.prayers", question: "Sala", icon: Sparkles },
  { id: "reflections", labelKey: "member_assistant.quick_questions.reflections", question: "Tafakari", icon: Sparkles },
  { id: "saints", labelKey: "member_assistant.quick_questions.saints", question: "Watakatifu", icon: Star },
  { id: "radio", labelKey: "member_assistant.quick_questions.radio", question: "Radio", icon: Radio },
] as const;

const responseKeyByIntent: Record<MemberAssistantIntent, string> = {
  contribution_summary: "member_assistant.responses.contribution_summary_checking",
  contribution_history: "member_assistant.responses.contribution_history",
  contribute: "member_assistant.responses.contribute",
  mass_intentions: "member_assistant.responses.mass_intentions",
  mass_schedule: "member_assistant.responses.mass_schedule",
  announcements: "member_assistant.responses.announcements",
  prayers: "member_assistant.responses.prayers",
  reflections: "member_assistant.responses.reflections",
  bible: "member_assistant.responses.bible",
  daily_readings: "member_assistant.responses.daily_readings",
  calendar: "member_assistant.responses.calendar",
  saints: "member_assistant.responses.saints",
  radio: "member_assistant.responses.radio_available",
  live_mass: "member_assistant.responses.live_mass_available",
  parish_information: "member_assistant.responses.parish_information",
  unknown: "member_assistant.responses.unknown",
};

const actionLabelKeyByIntent: Partial<Record<MemberAssistantIntent, string>> = {
  contribution_history: "member_assistant.actions.contribution_history",
  contribute: "member_assistant.actions.contribute",
  mass_intentions: "member_assistant.actions.mass_intentions",
  mass_schedule: "member_assistant.actions.mass_schedule",
  announcements: "member_assistant.actions.announcements",
  prayers: "member_assistant.actions.prayers",
  reflections: "member_assistant.actions.reflections",
  bible: "member_assistant.actions.bible",
  daily_readings: "member_assistant.actions.daily_readings",
  calendar: "member_assistant.actions.calendar",
  saints: "member_assistant.actions.saints",
  radio: "member_assistant.actions.radio",
  live_mass: "member_assistant.actions.live_mass",
};

export default function KanisaAssistantPage() {
  const { churchId, profile, user } = useAuth();
  const { data: linkedMember } = useLinkedMember();
  const { getFeatureState } = useFeatureAccess();
  const livestream = useChurchLivestream();
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isAnswering, setIsAnswering] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const firstName = String(profile?.full_name || user?.user_metadata?.full_name || t("member_assistant.fallbacks.first_name")).trim().split(/\s+/)[0];
  const churchName = String(profile?.church_name || t("member_assistant.fallbacks.church_name")).trim();
  const capabilities = useMemo(() => ({
    radioEnabled: getFeatureState("radio").visible,
    liveMassAvailable: livestream.featureEnabled && Boolean(livestream.data),
  }), [getFeatureState, livestream.data, livestream.featureEnabled]);

  const assistantResponse = (resolution: MemberAssistantResolution) => {
    if (resolution.intent === "radio" && resolution.action === "unavailable") {
      return String(t("member_assistant.responses.radio_unavailable"));
    }
    if (resolution.intent === "live_mass" && resolution.action === "unavailable") {
      return String(t("member_assistant.responses.live_mass_unavailable"));
    }
    return String(t(responseKeyByIntent[resolution.intent], { defaultValue: resolution.response }));
  };

  const actionLabel = (resolution: MemberAssistantResolution) => {
    const key = actionLabelKeyByIntent[resolution.intent];
    return String(key ? t(key, { defaultValue: resolution.actionLabel }) : t("member_assistant.actions.open"));
  };

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || isAnswering) return;
    const resolution = resolveMemberAssistantIntent(text, capabilities);
    const stamp = `${Date.now()}-${messages.length}`;
    setMessages((current) => [...current, { id: `member-${stamp}`, role: "member", text }]);
    setDraft("");
    setIsAnswering(true);

    let answer = assistantResponse(resolution);
    if (resolution.intent === "contribution_summary") {
      if (!churchId || !linkedMember?.id) {
        answer = String(t("member_assistant.responses.contribution_summary_unlinked"));
      } else {
        try {
          const total = await readOwnContributionSummary(churchId, linkedMember.id);
          answer = total > 0
            ? String(t("member_assistant.responses.contribution_summary_total", { amount: formatTZS(total) }))
            : String(t("member_assistant.responses.contribution_summary_zero"));
        } catch {
          answer = String(t("member_assistant.responses.contribution_summary_error"));
        }
      }
    }

    setMessages((current) => [...current, { id: `assistant-${stamp}`, role: "assistant", text: answer, resolution }]);
    setIsAnswering(false);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <main className="mx-auto flex min-h-[calc(100svh-8rem)] w-full max-w-3xl flex-col px-4 py-5 pb-28 lg:min-h-[calc(100svh-12rem)] lg:px-8 lg:pb-8" data-testid="uliza-kanisa-page">
      <header className="flex items-center gap-3 border-b border-border/70 pb-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Church className="h-6 w-6" aria-hidden="true" /></span>
        <div className="min-w-0"><h1 className="text-2xl font-bold">{t("member_assistant.title")}</h1><p className="break-words text-sm text-muted-foreground">{t("member_assistant.subtitle")}</p></div>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto py-5" aria-live="polite">
        {!messages.length ? (
          <>
            <section className="rounded-3xl bg-primary/5 p-5 sm:p-6">
              <p className="text-lg font-bold">{t("member_assistant.greeting", { firstName })}</p>
              <p className="mt-2 break-words text-base leading-7 text-muted-foreground">{t("member_assistant.intro", { churchName })}</p>
            </section>
            <section aria-labelledby="uliza-quick-actions">
              <h2 id="uliza-quick-actions" className="text-lg font-bold">{t("member_assistant.quick_questions.heading")}</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 min-[340px]:grid-cols-2">
                {quickQuestions.map((item) => {
                  const Icon = item.icon;
                  return <button key={item.id} type="button" onClick={() => void ask(item.question)} className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-border/70 bg-card px-3 py-2 text-left shadow-sm transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-5 w-5" aria-hidden="true" /></span><span className="min-w-0 text-sm font-bold leading-5">{String(t(item.labelKey))}</span></button>;
                })}
              </div>
            </section>
          </>
        ) : messages.map((message) => (
          <article key={message.id} className={cn("flex", message.role === "member" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[88%] rounded-3xl px-4 py-3 text-base leading-6", message.role === "member" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted text-foreground")}>
              <p className="whitespace-pre-line">{message.text}</p>
              {message.role === "assistant" && message.resolution?.route && message.resolution.action === "navigate" ? <Button asChild className="mt-3 min-h-11 rounded-xl"><AppLink to={message.resolution.route}>{actionLabel(message.resolution)}</AppLink></Button> : null}
              {message.role === "assistant" && message.resolution?.intent === "unknown" ? <div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => void ask("Matangazo")}>{t("member_assistant.suggestions.announcements")}</Button><Button type="button" variant="outline" onClick={() => void ask("Masomo ya leo")}>{t("member_assistant.suggestions.readings")}</Button></div> : null}
            </div>
          </article>
        ))}
        {isAnswering ? <p className="text-sm text-muted-foreground" role="status">{t("member_assistant.loading")}</p> : null}
      </div>

      <form onSubmit={(event) => { event.preventDefault(); void ask(draft); }} className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 mt-auto border-t border-border/70 bg-background/95 py-3 backdrop-blur lg:bottom-0">
        <label htmlFor="uliza-kanisa-input" className="sr-only">{t("member_assistant.input.label")}</label>
        <div className="flex items-center gap-2 rounded-3xl border border-border bg-card p-2 shadow-sm">
          <Input ref={inputRef} id="uliza-kanisa-input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t("member_assistant.input.placeholder")} className="h-12 min-w-0 flex-1 border-0 bg-transparent text-base shadow-none focus-visible:ring-0" autoComplete="off" />
          <Button type="submit" size="icon" disabled={!draft.trim() || isAnswering} className="h-12 w-12 shrink-0 rounded-full" aria-label={t("member_assistant.input.send_aria")}><Send className="h-5 w-5" /></Button>
        </div>
      </form>
    </main>
  );
}
