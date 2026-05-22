import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { AppLink } from "@/components/AppLink";
import { cn } from "@/lib/utils";
import {
  getAnalyticsAssistantPresence,
  setAnalyticsAssistantPresence,
  subscribeToAnalyticsAssistantPresence,
  type AnalyticsAssistantPresenceState,
} from "@/lib/analytics-assistant-presence";

type AIAnalyticsSidebarItemProps = {
  href: string;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  delay?: number;
};

const itemSpring = {
  type: "spring",
  stiffness: 220,
  damping: 24,
  mass: 0.92,
};

function AIOrb({ state, active }: { state: AnalyticsAssistantPresenceState; active: boolean }) {
  const isThinking = state === "thinking";
  const isSuccess = state === "success";

  return (
    <div className="relative flex h-11 w-11 items-center justify-center">
      <motion.div
        className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(251,191,36,0.32)_0%,rgba(245,158,11,0.14)_42%,transparent_78%)]"
        animate={
          isThinking
            ? { scale: [0.98, 1.14, 1.02], opacity: [0.4, 0.92, 0.55], rotate: [0, 8, -6, 0] }
            : isSuccess
              ? { scale: [1, 1.34, 1.08], opacity: [0.6, 1, 0.3] }
              : { scale: [1, 1.05, 1], opacity: active ? [0.36, 0.64, 0.36] : [0.2, 0.4, 0.2] }
        }
        transition={{
          duration: isSuccess ? 0.9 : 4.2,
          repeat: isSuccess ? 0 : Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="absolute inset-[3px] rounded-full border border-[#d4af37]/25 bg-[linear-gradient(145deg,rgba(251,191,36,0.22),rgba(245,158,11,0.06),rgba(10,10,10,0.18))] shadow-[0_0_20px_rgba(212,175,55,0.3)]"
        animate={
          isThinking
            ? { scale: [1, 1.08, 1], rotate: [0, 6, -4, 0], boxShadow: ["0 0 18px rgba(212,175,55,0.28)", "0 0 28px rgba(212,175,55,0.48)", "0 0 18px rgba(212,175,55,0.32)"] }
            : isSuccess
              ? { scale: [1, 1.12, 1], boxShadow: ["0 0 20px rgba(212,175,55,0.32)", "0 0 34px rgba(251,191,36,0.62)", "0 0 20px rgba(212,175,55,0.3)"] }
              : { scale: [1, 1.03, 1], boxShadow: active ? ["0 0 20px rgba(212,175,55,0.32)", "0 0 26px rgba(212,175,55,0.44)", "0 0 20px rgba(212,175,55,0.32)"] : ["0 0 14px rgba(212,175,55,0.2)", "0 0 20px rgba(212,175,55,0.3)", "0 0 14px rgba(212,175,55,0.2)"] }
        }
        transition={{
          duration: isSuccess ? 0.86 : 3.8,
          repeat: isSuccess ? 0 : Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="absolute inset-[8px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,248,220,0.92),rgba(251,191,36,0.9)_28%,rgba(245,158,11,0.5)_56%,rgba(15,23,42,0.18)_100%)]"
        animate={
          isThinking
            ? { scale: [1, 1.06, 0.98, 1], opacity: [0.88, 1, 0.92, 0.88] }
            : isSuccess
              ? { scale: [1, 1.18, 1], opacity: [0.96, 1, 0.92] }
              : { scale: [1, 1.04, 1], opacity: [0.82, 0.96, 0.82] }
        }
        transition={{
          duration: isSuccess ? 0.72 : 3.4,
          repeat: isSuccess ? 0 : Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="absolute inset-0 rounded-full bg-[linear-gradient(120deg,transparent_10%,rgba(255,255,255,0.3)_40%,transparent_70%)]"
        animate={
          isThinking
            ? { x: ["-130%", "130%"], opacity: [0, 0.48, 0] }
            : isSuccess
              ? { x: ["-100%", "120%"], opacity: [0, 0.4, 0] }
              : { x: ["-120%", "120%"], opacity: [0, 0.16, 0] }
        }
        transition={{
          duration: isThinking ? 1.8 : 4.8,
          repeat: isSuccess ? 0 : Number.POSITIVE_INFINITY,
          ease: "easeInOut",
          repeatDelay: isThinking ? 0 : 0.4,
        }}
      />

      <motion.div
        className="relative z-10 flex h-6 w-6 items-center justify-center"
        animate={isThinking ? { rotate: [0, 10, -8, 0], scale: [1, 1.04, 1] } : { rotate: 0, scale: 1 }}
        transition={{ duration: 3.2, repeat: isThinking ? Number.POSITIVE_INFINITY : 0, ease: "easeInOut" }}
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-[#f8d774]">
          <motion.path
            d="M12 5.2v2.1M8.1 7.8l-1.3-1.3M15.9 7.8l1.3-1.3M8.2 10.3h7.6M9.4 14.3h5.2M8.1 18.1l1.4-2.1h5l1.4 2.1"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ opacity: active || isThinking || isSuccess ? 1 : 0.88, pathLength: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
      </motion.div>
    </div>
  );
}

export function AIAnalyticsSidebarItem({
  href,
  label,
  active = false,
  collapsed = false,
  delay = 0,
}: AIAnalyticsSidebarItemProps) {
  const [presenceState, setPresenceState] = useState<AnalyticsAssistantPresenceState>(() => getAnalyticsAssistantPresence());

  useEffect(() => subscribeToAnalyticsAssistantPresence(setPresenceState), []);

  useEffect(() => {
    if (presenceState !== "success") return;

    const timeoutId = window.setTimeout(() => {
      setAnalyticsAssistantPresence("idle");
    }, 1800);

    return () => window.clearTimeout(timeoutId);
  }, [presenceState]);

  const badgeTone = useMemo(() => {
    if (presenceState === "thinking") return "bg-amber-400/16 text-amber-100 border-amber-300/28";
    if (presenceState === "success") return "bg-emerald-400/14 text-emerald-100 border-emerald-300/24";
    return "bg-white/[0.06] text-primary/90 border-primary/20";
  }, [presenceState]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.985 }}
      className="relative"
    >
      <AppLink
        to={href}
        onClick={() => setAnalyticsAssistantPresence("thinking")}
        className={cn(
          "group relative block overflow-hidden rounded-2xl border px-3 py-2.5 backdrop-blur-xl transition-all duration-300",
          "border-[#d4af37]/15 bg-[linear-gradient(145deg,rgba(12,16,24,0.94),rgba(24,20,12,0.9)_55%,rgba(12,16,24,0.96))]",
          "shadow-[0_0_20px_rgba(212,175,55,0.3),inset_0_1px_0_rgba(255,255,255,0.06)]",
          active && "border-[#f2d06b]/28 shadow-[0_0_24px_rgba(212,175,55,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]",
          collapsed && "px-2.5",
        )}
      >
        <motion.div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.05)_0%,transparent_28%,rgba(212,175,55,0.1)_58%,transparent_100%)]"
          animate={{ x: ["-8%", "8%", "-8%"], opacity: active ? [0.48, 0.78, 0.48] : [0.26, 0.46, 0.26] }}
          transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        />
        <motion.div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.1),transparent_34%)]"
          animate={{ scale: [1, 1.05, 1], opacity: active ? [0.72, 0.92, 0.72] : [0.44, 0.6, 0.44] }}
          transition={{ duration: 6.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        />
        <motion.div
          className="pointer-events-none absolute -inset-y-2 left-[-40%] w-[44%] rotate-12 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)]"
          animate={presenceState === "thinking" ? { x: ["0%", "260%"] } : { x: ["0%", "220%"] }}
          transition={{
            duration: presenceState === "thinking" ? 1.7 : 6.4,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
            repeatDelay: presenceState === "thinking" ? 0.1 : 1.2,
          }}
        />

        <div className={cn("relative z-10 flex min-w-0 items-center gap-3", collapsed && "justify-center")}>
          <div
            className={cn(
              "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#d4af37]/18 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(212,175,55,0.08))]",
              "shadow-[0_0_20px_rgba(212,175,55,0.22)]",
            )}
          >
            <AIOrb state={presenceState} active={active} />
          </div>

          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                key="ai-label"
                initial={{ opacity: 0, x: -10, width: 0 }}
                animate={{ opacity: 1, x: 0, width: "auto" }}
                exit={{ opacity: 0, x: -8, width: 0 }}
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                className="min-w-0 flex-1 overflow-hidden"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold tracking-[0.01em] text-foreground">{label}</p>
                    <p className="truncate text-[11px] tracking-[0.14em] text-primary/75 uppercase">
                      {presenceState === "thinking"
                        ? "Analyzing"
                        : presenceState === "success"
                          ? "Ready"
                          : "Intelligence"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.24em]",
                      badgeTone,
                    )}
                  >
                    AI
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </AppLink>
    </motion.div>
  );
}
