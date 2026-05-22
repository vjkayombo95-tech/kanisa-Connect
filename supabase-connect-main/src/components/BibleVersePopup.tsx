"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Heart, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type UserRole = "admin" | "pastor" | "member";

type PopupUser = {
  name: string;
  role: UserRole;
};

type DashboardDataResponse = {
  church: {
    id: number;
    name: string;
    logo?: string;
  };
  verse: {
    text: string;
    reference: string;
  };
};

type BibleVersePopupProps = {
  user: PopupUser;
  endpoint?: string;
  storageKey?: string;
  onClose?: () => void;
};

const DEFAULT_ENDPOINT = "/api/dashboard-data";
const DEFAULT_STORAGE_KEY = "verseSeenToday";

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function getGreeting(role: UserRole) {
  switch (role) {
    case "admin":
      return "Welcome back, Admin. May wisdom guide every decision you make today.";
    case "pastor":
      return "Welcome back, Pastor. May grace and strength fill your ministry today.";
    case "member":
    default:
      return "Welcome back. May your day be rooted in peace and faith.";
  }
}

function getBlessing(role: UserRole) {
  switch (role) {
    case "admin":
      return "May the Lord bless your leadership and the work of your hands.";
    case "pastor":
      return "May the Lord renew your spirit and bless those you shepherd.";
    case "member":
    default:
      return "May the Lord bless you and keep you throughout this day.";
  }
}

function isValidPayload(value: unknown): value is DashboardDataResponse {
  if (!value || typeof value !== "object") return false;
  const data = value as DashboardDataResponse;
  return Boolean(
    data.church &&
      typeof data.church.id === "number" &&
      typeof data.church.name === "string" &&
      data.verse &&
      typeof data.verse.text === "string" &&
      typeof data.verse.reference === "string",
  );
}

export default function BibleVersePopup({
  user,
  endpoint = DEFAULT_ENDPOINT,
  storageKey = DEFAULT_STORAGE_KEY,
  onClose,
}: BibleVersePopupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<DashboardDataResponse | null>(null);

  const greeting = useMemo(() => getGreeting(user.role), [user.role]);
  const blessing = useMemo(() => getBlessing(user.role), [user.role]);

  const markSeenToday = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, getTodayKey());
  }, [storageKey]);

  const closePopup = useCallback(() => {
    markSeenToday();
    setIsOpen(false);
    onClose?.();
  }, [markSeenToday, onClose]);

  const fetchDashboardData = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal,
      });

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      const json = (await response.json()) as unknown;
      if (!isValidPayload(json)) {
        throw new Error("Dashboard data format is invalid.");
      }

      setPayload(json);
    } catch (fetchError) {
      if ((fetchError as Error)?.name === "AbortError") return;
      setError(fetchError instanceof Error ? fetchError.message : "Unable to load dashboard data.");
    } finally {
      setIsLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const seenOn = window.localStorage.getItem(storageKey);
    if (seenOn === getTodayKey()) return;

    setIsOpen(true);
    const controller = new AbortController();
    void fetchDashboardData(controller.signal);

    return () => controller.abort();
  }, [fetchDashboardData, storageKey]);

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePopup();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closePopup, isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 14 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-2xl rounded-3xl border border-white/15 bg-slate-900 text-white shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-label="Daily Bible verse popup"
        >
          <div className="space-y-5 p-6 sm:p-8">
            <div className="flex items-center gap-4">
              {payload?.church.logo ? (
                <img
                  src={payload.church.logo}
                  alt={`${payload.church.name} logo`}
                  className="h-14 w-14 rounded-xl border border-white/20 object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-lg font-semibold">
                  {payload?.church.name?.slice(0, 1).toUpperCase() || "C"}
                </div>
              )}
              <div>
                <p className="text-sm text-slate-300">Welcome, {user.name}</p>
                <h2 className="text-2xl font-semibold tracking-tight">{payload?.church.name || "Your Church"}</h2>
                <p className="mt-1 text-sm text-slate-300">{greeting}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-slate-200">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading today&apos;s verse...
                </div>
              ) : error ? (
                <div className="space-y-3 py-4 text-center">
                  <p className="text-sm text-rose-300">Could not load today&apos;s verse: {error}</p>
                  <button
                    type="button"
                    onClick={() => void fetchDashboardData()}
                    className="rounded-xl border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
                    Bible Verse of the Day
                  </p>
                  <blockquote className="mt-4 text-center text-lg italic leading-8 text-slate-50">
                    &quot;{payload?.verse.text}&quot;
                  </blockquote>
                  <p className="mt-4 text-center text-sm font-semibold uppercase tracking-[0.14em] text-amber-300">
                    {payload?.verse.reference}
                  </p>
                </>
              )}
            </div>

            <p className="text-center text-sm text-slate-300">{blessing}</p>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={closePopup}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-semibold text-slate-900 transition hover:bg-amber-300"
              >
                <Heart className="h-4 w-4 fill-current" />
                Amen ❤️
              </button>
              <button
                type="button"
                onClick={closePopup}
                className="h-11 rounded-xl border border-white/25 bg-transparent px-5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Continue →
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
