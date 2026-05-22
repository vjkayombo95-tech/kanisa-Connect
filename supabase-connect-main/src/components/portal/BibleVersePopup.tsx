import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Church, Heart, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type PopupRole = "admin" | "pastor" | "member";

type BibleVersePopupProps = {
  userName: string;
  userRole: string | null;
};

type PopupPayload = {
  churchName: string;
  churchLogoUrl: string | null;
  verseText: string;
  verseReference: string;
};

type BibleVerseRecord = {
  id?: string;
  text?: string | null;
  verse_text?: string | null;
  reference?: string | null;
  is_active?: boolean | null;
  church_id?: string | null;
  created_at?: string | null;
};

const STORAGE_KEY = "verseSeenToday";

function getTodayStorageValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeRole(role: string | null): PopupRole {
  if (role === "pastor") return "pastor";
  if (role === "church_admin" || role === "secretary" || role === "treasurer") return "admin";
  return "member";
}

export function getGreeting(role: PopupRole) {
  switch (role) {
    case "admin":
      return "May wisdom guide your leadership and every decision you make today.";
    case "pastor":
      return "May grace and strength cover you as you shepherd the church today.";
    case "member":
    default:
      return "May peace fill your heart as you begin your day in faith.";
  }
}

function getBlessing(role: PopupRole) {
  switch (role) {
    case "admin":
      return "May God bless the work of your hands and the church you serve.";
    case "pastor":
      return "May the Lord renew your spirit and pour fresh favor on your ministry.";
    case "member":
    default:
      return "May God bless your journey today and keep your home in peace.";
  }
}

function toVerseText(record: BibleVerseRecord | null | undefined) {
  return (record?.text || record?.verse_text || "").trim();
}

function pickBestVerse(records: BibleVerseRecord[]) {
  const withText = records.filter((record) => Boolean(toVerseText(record)));
  if (withText.length === 0) return null;

  const active = withText.find((record) => record.is_active !== false);
  return active ?? withText[0];
}

export function BibleVersePopup({ userName, userRole }: BibleVersePopupProps) {
  const { churchId, user, isLoading: authLoading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const popupRole = useMemo(() => normalizeRole(userRole), [userRole]);

  const { data: resolvedChurchId, isLoading: resolvingChurchId } = useQuery({
    queryKey: ["member-dashboard-verse-popup-church", churchId, user?.id, user?.email],
    queryFn: async () => {
      if (churchId) return churchId;
      if (!user) return null;

      const normalizedEmail = user.email?.trim().toLowerCase() ?? null;

      const { data: linkedMember, error: linkedMemberError } = await supabase
        .from("members")
        .select("church_id")
        .eq("user_id", user.id)
        .not("church_id", "is", null)
        .limit(1)
        .maybeSingle();

      if (linkedMemberError) throw linkedMemberError;
      if (linkedMember?.church_id) return linkedMember.church_id;

      if (normalizedEmail) {
        const { data: emailMember, error: emailMemberError } = await supabase
          .from("members")
          .select("church_id")
          .ilike("email", normalizedEmail)
          .not("church_id", "is", null)
          .limit(1)
          .maybeSingle();

        if (emailMemberError) throw emailMemberError;
        if (emailMember?.church_id) return emailMember.church_id;
      }

      return null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["member-dashboard-verse-popup", resolvedChurchId],
    queryFn: async (): Promise<PopupPayload | null> => {
      if (!resolvedChurchId) return null;

      const [{ data: church, error: churchError }, { data: primaryVerses, error: primaryVersesError }] = await Promise.all([
        supabase
          .from("churches")
          .select("name, logo_url")
          .eq("id", resolvedChurchId)
          .maybeSingle(),
        supabase
          .from("bible_verses")
          .select("*")
          .eq("church_id", resolvedChurchId)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (churchError) {
        console.warn("Bible verse popup church lookup failed", churchError);
      }

      if (primaryVersesError) throw primaryVersesError;

      let candidateVerses = ((primaryVerses ?? []) as BibleVerseRecord[]);

      if (candidateVerses.length === 0) {
        const { data: fallbackVerses, error: fallbackVersesError } = await supabase
          .from("bible_verses")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10);

        if (fallbackVersesError) throw fallbackVersesError;
        candidateVerses = ((fallbackVerses ?? []) as BibleVerseRecord[]).filter((record) => {
          if (!record.church_id) return true;
          return record.church_id === resolvedChurchId;
        });
      }

      const verse = pickBestVerse(candidateVerses);
      const verseText = toVerseText(verse);

      if (!verseText) return null;

      return {
        churchName: church?.name || "Your Church",
        churchLogoUrl: church?.logo_url ?? null,
        verseText,
        verseReference: verse?.reference?.trim() || "Daily Verse",
      };
    },
    enabled: !!resolvedChurchId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (authLoading || resolvingChurchId || isLoading || !data?.verseText || !resolvedChurchId) return;

    const today = getTodayStorageValue();
    const verseSignature = `${today}:${resolvedChurchId}:${data.verseReference}`;
    const seenValue = window.localStorage.getItem(STORAGE_KEY);

    if (seenValue === verseSignature) return;

    setIsOpen(true);
  }, [authLoading, data?.verseReference, data?.verseText, isLoading, resolvedChurchId, resolvingChurchId]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        window.localStorage.setItem(STORAGE_KEY, `${getTodayStorageValue()}:${resolvedChurchId ?? "unknown"}:${data?.verseReference ?? "verse"}`);
        setIsOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const handleClose = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, `${getTodayStorageValue()}:${resolvedChurchId ?? "unknown"}:${data?.verseReference ?? "verse"}`);
    }
    setIsOpen(false);
  };

  if (authLoading || resolvingChurchId) {
    return null;
  }

  if (isLoading || isError || !data?.verseText) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 18 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-2xl overflow-hidden rounded-[32px] border border-primary/20 bg-[linear-gradient(180deg,rgba(10,14,21,0.98),rgba(14,20,30,0.95))] shadow-[0_30px_90px_-38px_rgba(0,0,0,0.95)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.08),transparent_28%)]" />
            <div className="pointer-events-none absolute inset-x-10 top-0 h-24 rounded-full bg-primary/10 blur-3xl" />
            <div className="pointer-events-none absolute right-0 top-6 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />

            <div className="relative p-6 sm:p-8">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[22px] border border-primary/20 bg-primary/10 text-primary shadow-[0_16px_40px_-26px_rgba(245,158,11,0.7)]">
                  {data.churchLogoUrl ? (
                    <img
                      src={data.churchLogoUrl}
                      alt={`${data.churchName} logo`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Church className="h-7 w-7" />
                  )}
                </div>

                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    Daily Blessing
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Welcome, {userName}</p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                      {data.churchName}
                    </h2>
                    <p className="mt-2 max-w-xl text-sm text-muted-foreground">{getGreeting(popupRole)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-primary/15 bg-white/[0.03] p-4 sm:p-5">
                <div className="rounded-[24px] border border-primary/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(245,158,11,0.05))] px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:px-7 sm:py-8">
                  <p className="text-center text-xs font-semibold uppercase tracking-[0.28em] text-primary/85">
                    Bible Verse of the Day
                  </p>
                  <blockquote className="mx-auto mt-5 max-w-2xl text-center text-lg italic leading-8 text-foreground sm:text-[1.7rem] sm:leading-[2.7rem]">
                    "{data.verseText}"
                  </blockquote>
                  <p className="mt-5 text-center text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
                    {data.verseReference}
                  </p>
                </div>

                <p className="mt-5 text-center text-sm text-muted-foreground">
                  {getBlessing(popupRole)}
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button
                  type="button"
                  onClick={handleClose}
                  className="h-11 rounded-2xl px-6 shadow-[0_16px_42px_-24px_rgba(245,158,11,0.75)]"
                >
                  <Heart className="h-4 w-4 fill-current" />
                  Amen
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  className="h-11 rounded-2xl border-primary/20 bg-white/[0.03] px-6 text-foreground hover:border-primary/30 hover:bg-white/[0.06] hover:text-foreground"
                >
                  Continue
                  <span aria-hidden="true">-&gt;</span>
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
