import { useMemo, useRef, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Church, HandCoins, HeartHandshake, Megaphone, Send, Users } from "lucide-react";

import { AppLink } from "@/components/AppLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { resolveMemberAssistantIntent, type MemberAssistantResolution } from "@/lib/member-assistant";
import { cn } from "@/lib/utils";

type ConversationMessage = {
  id: string;
  role: "member" | "assistant";
  text: string;
  resolution?: MemberAssistantResolution;
};

const suggestions = [
  { id: "contributions", label: "Michango Yangu", to: "/portal/contribution-history", icon: HandCoins, feature: "contributions", primary: true },
  { id: "intention", label: "Nia ya Misa", to: "/portal/mass-intentions", icon: Church, feature: "mass_intentions", primary: true },
  { id: "schedule", label: "Ratiba ya Misa", to: "/portal/calendar", icon: Church, feature: "events", primary: true },
  { id: "announcements", label: "Matangazo", to: "/portal/announcements", icon: Megaphone, feature: "announcements", primary: true },
  { id: "prayer", label: "Ombi la Maombi", to: "/portal/prayer-requests", icon: HeartHandshake, feature: "prayer_requests", primary: false },
  { id: "readings", label: "Masomo ya Leo", to: "/portal/today", icon: BookOpen, feature: "catholic_content", primary: false },
  { id: "community", label: "Jumuiya Yangu", to: "/portal/channels", icon: Users, feature: "channels", primary: false },
  { id: "contact", label: "Wasiliana na Parokia", to: "/portal/my-parish", icon: Church, primary: false },
] as const;

export default function KanisaAssistantPage() {
  const { profile, user } = useAuth();
  const { getFeatureState, isLoading: featuresLoading } = useFeatureAccess();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [showMore, setShowMore] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const firstName = String(profile?.member?.full_name || profile?.full_name || user?.user_metadata?.full_name || "Mshirika").trim().split(/\s+/)[0];
  const churchName = String(profile?.church_name || profile?.church?.name || "parokia yako").trim();
  const visibleSuggestions = useMemo(
    () => suggestions.filter((item) => !("feature" in item) || getFeatureState(item.feature).visible),
    [getFeatureState],
  );
  const primarySuggestions = visibleSuggestions.filter((item) => item.primary);
  const secondarySuggestions = visibleSuggestions.filter((item) => !item.primary);

  const ask = (question: string) => {
    const text = question.trim();
    if (!text) return;
    const resolution = resolveMemberAssistantIntent(text);
    const stamp = Date.now();
    setMessages((current) => [
      ...current,
      { id: `member-${stamp}`, role: "member", text },
      { id: `assistant-${stamp}`, role: "assistant", text: resolution.message, resolution },
    ]);
    setDraft("");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const renderSuggestion = (item: (typeof suggestions)[number]) => {
    const Icon = item.icon;
    const content = <><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span><span className="min-w-0 text-left text-sm font-bold leading-5">{item.label}</span></>;
    const classes = "flex min-h-16 w-full items-center gap-3 rounded-2xl border border-border/70 bg-card px-3 py-2 shadow-sm transition-colors hover:bg-muted/50";
    return <AppLink key={item.id} to={item.to} className={classes}>{content}</AppLink>;
  };

  return (
    <div className="mx-auto flex min-h-[calc(100svh-8rem)] w-full max-w-3xl flex-col pb-20 lg:min-h-[calc(100svh-12rem)] lg:pb-0" data-testid="kanisa-member-assistant">
      <header className="flex items-center gap-3 border-b border-border/70 pb-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Church className="h-5 w-5" /></span>
        <div className="min-w-0"><h1 className="text-xl font-bold">Uliza Kanisa</h1><p className="break-words text-sm text-muted-foreground">Karibu, naweza kukusaidia nini?</p></div>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto py-5" aria-live="polite">
        {!messages.length ? (
          <>
            <section className="rounded-3xl bg-primary/5 p-5 sm:p-6">
              <p className="text-lg font-bold">Habari {firstName} 👋</p>
              <p className="mt-2 break-words text-base leading-7 text-muted-foreground">Niko hapa kukusaidia kupata huduma na taarifa za {churchName}. Unaweza kuchagua mojawapo hapa chini au kuandika swali lako.</p>
            </section>
            {!featuresLoading ? (
              <section aria-labelledby="quick-questions-title">
                <h2 id="quick-questions-title" className="text-lg font-bold">Unaweza kuniuliza</h2>
                <div className="mt-3 grid grid-cols-1 gap-3 min-[340px]:grid-cols-2">{primarySuggestions.map(renderSuggestion)}</div>
                {secondarySuggestions.length ? <><button type="button" onClick={() => setShowMore((value) => !value)} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold text-primary" aria-expanded={showMore}>Zaidi {showMore ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>{showMore ? <div className="grid grid-cols-1 gap-3 min-[340px]:grid-cols-2">{secondarySuggestions.map(renderSuggestion)}</div> : null}</> : null}
              </section>
            ) : <p className="text-sm text-muted-foreground">Tunatayarisha huduma zako...</p>}
          </>
        ) : (
          <>
            {messages.map((message) => (
              <article key={message.id} className={cn("flex", message.role === "member" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[88%] rounded-3xl px-4 py-3 text-base leading-6", message.role === "member" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted text-foreground")}>
                  <p className="whitespace-pre-line">{message.text}</p>
                  {message.role === "assistant" && message.resolution?.action ? <Button asChild className="mt-3 min-h-11 rounded-xl"><AppLink to={message.resolution.action.to}>{message.resolution.action.label}</AppLink></Button> : null}
                  {message.role === "assistant" && message.resolution?.intent === "unknown" ? <Button asChild variant="outline" className="mt-3 min-h-11 rounded-xl bg-background"><AppLink to="/portal/my-parish">Wasiliana na Parokia</AppLink></Button> : null}
                </div>
              </article>
            ))}
            {messages.at(-1)?.resolution?.intent === "unknown" ? <div className="grid grid-cols-1 gap-2 min-[340px]:grid-cols-2">{primarySuggestions.map(renderSuggestion)}</div> : null}
          </>
        )}
      </div>

      <form onSubmit={(event) => { event.preventDefault(); ask(draft); }} className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 mt-auto border-t border-border/70 bg-background/95 py-3 backdrop-blur lg:bottom-0">
        <label htmlFor="member-assistant-input" className="sr-only">Andika swali lako</label>
        <div className="flex items-center gap-2 rounded-3xl border border-border bg-card p-2 shadow-sm">
          <Input ref={inputRef} id="member-assistant-input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Andika swali lako..." className="h-12 min-w-0 flex-1 border-0 bg-transparent text-base shadow-none focus-visible:ring-0" autoComplete="off" />
          <Button type="submit" size="icon" disabled={!draft.trim()} className="h-12 w-12 shrink-0 rounded-full" aria-label="Tuma swali"><Send className="h-5 w-5" /></Button>
        </div>
      </form>
    </div>
  );
}
