import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, BrainCircuit, MessageSquareText, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  getAnalyticsAssistantPresence,
  setAnalyticsAssistantPresence,
  subscribeToAnalyticsAssistantPresence,
  type AnalyticsAssistantPresenceState,
} from "@/lib/analytics-assistant-presence";
import { cn } from "@/lib/utils";

const QUICK_PROMPTS = [
  "Show top contributors",
  "Generate monthly report",
  "Show category breakdown for offerings",
];

function FloatingOrb({ state, panelOpen }: { state: AnalyticsAssistantPresenceState; panelOpen: boolean }) {
  const isThinking = state === "thinking";
  const isSuccess = state === "success";

  return (
    <div className="relative flex h-14 w-14 items-center justify-center">
      <motion.div
        className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(250,204,21,0.38)_0%,rgba(245,158,11,0.2)_42%,transparent_76%)]"
        animate={
          isThinking
            ? { scale: [1, 1.15, 1.02], opacity: [0.45, 0.98, 0.56] }
            : isSuccess
              ? { scale: [1, 1.28, 1.04], opacity: [0.58, 1, 0.36] }
              : { scale: [1, 1.05, 1], opacity: panelOpen ? [0.34, 0.64, 0.34] : [0.24, 0.48, 0.24] }
        }
        transition={{
          duration: isSuccess ? 0.9 : 4,
          repeat: isSuccess ? 0 : Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="absolute inset-[4px] rounded-full border border-[#d4af37]/30 bg-[linear-gradient(150deg,rgba(255,255,255,0.14),rgba(251,191,36,0.28),rgba(245,158,11,0.7))] shadow-[0_0_22px_rgba(212,175,55,0.34)] backdrop-blur-xl"
        animate={
          isThinking
            ? {
                scale: [1, 1.08, 1],
                rotate: [0, 5, -4, 0],
                boxShadow: [
                  "0 0 20px rgba(212,175,55,0.34)",
                  "0 0 34px rgba(251,191,36,0.56)",
                  "0 0 22px rgba(212,175,55,0.36)",
                ],
              }
            : isSuccess
              ? {
                  scale: [1, 1.12, 1],
                  boxShadow: [
                    "0 0 20px rgba(212,175,55,0.34)",
                    "0 0 38px rgba(251,191,36,0.7)",
                    "0 0 22px rgba(212,175,55,0.36)",
                  ],
                }
              : {
                  scale: [1, 1.03, 1],
                  boxShadow: panelOpen
                    ? [
                        "0 0 22px rgba(212,175,55,0.36)",
                        "0 0 30px rgba(212,175,55,0.52)",
                        "0 0 22px rgba(212,175,55,0.36)",
                      ]
                    : [
                        "0 0 16px rgba(212,175,55,0.24)",
                        "0 0 24px rgba(212,175,55,0.38)",
                        "0 0 16px rgba(212,175,55,0.24)",
                      ],
                }
        }
        transition={{
          duration: isSuccess ? 0.84 : 3.8,
          repeat: isSuccess ? 0 : Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="absolute inset-0 rounded-full bg-[linear-gradient(120deg,transparent_15%,rgba(255,255,255,0.28)_45%,transparent_76%)]"
        animate={
          isThinking
            ? { x: ["-130%", "130%"], opacity: [0, 0.42, 0] }
            : { x: ["-120%", "120%"], opacity: [0, 0.2, 0] }
        }
        transition={{
          duration: isThinking ? 1.8 : 4.8,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
          repeatDelay: isThinking ? 0.08 : 0.8,
        }}
      />

      <motion.div
        className="relative z-10"
        animate={isThinking ? { rotate: [0, 8, -7, 0], scale: [1, 1.05, 1] } : { rotate: 0, scale: 1 }}
        transition={{ duration: 3, repeat: isThinking ? Number.POSITIVE_INFINITY : 0, ease: "easeInOut" }}
      >
        <BrainCircuit className="h-6 w-6 text-[#1f1300]" />
      </motion.div>
    </div>
  );
}

export function FloatingAIAssistant() {
  const navigate = useNavigate();
  const [panelOpen, setPanelOpen] = useState(false);
  const [draftQuery, setDraftQuery] = useState("");
  const [presenceState, setPresenceState] = useState<AnalyticsAssistantPresenceState>(() => getAnalyticsAssistantPresence());
  const [clickedAt, setClickedAt] = useState<number | null>(null);

  useEffect(() => subscribeToAnalyticsAssistantPresence(setPresenceState), []);

  useEffect(() => {
    if (presenceState !== "success") return;

    const timeoutId = window.setTimeout(() => {
      setAnalyticsAssistantPresence("idle");
    }, 1700);

    return () => window.clearTimeout(timeoutId);
  }, [presenceState]);

  const badgeText = useMemo(() => {
    if (presenceState === "thinking") return "Thinking";
    if (presenceState === "success") return "Ready";
    return "AI";
  }, [presenceState]);

  const openFullAI = (prompt?: string) => {
    const search = prompt?.trim() ? `?q=${encodeURIComponent(prompt.trim())}` : "";
    setPanelOpen(false);
    navigate(`/church-admin/analytics-assistant${search}`);
  };

  const handleFabClick = () => {
    setClickedAt(Date.now());
    setPanelOpen((current) => !current);
  };

  return (
    <div className="pointer-events-none fixed bottom-5 right-4 z-40 sm:bottom-6 sm:right-6">
      <AnimatePresence>
        {panelOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto mb-4 w-[min(88vw,22rem)] rounded-[28px] border border-[#d4af37]/18 bg-[linear-gradient(165deg,rgba(9,12,19,0.96),rgba(18,15,10,0.94)_60%,rgba(9,12,19,0.98))] p-4 shadow-[0_24px_90px_-42px_rgba(0,0,0,0.88),0_0_28px_rgba(212,175,55,0.18)] backdrop-blur-2xl"
          >
            <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.12),transparent_34%)]" />
            <div className="relative z-10 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/80">Ask AI</p>
                  <h3 className="mt-1 text-lg font-semibold text-foreground">Analytics Copilot</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ask about giving, contributors, or category trends.
                  </p>
                </div>
                <span className="rounded-full border border-primary/20 bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/90">
                  {badgeText}
                </span>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2">
                <Input
                  value={draftQuery}
                  onChange={(event) => setDraftQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && draftQuery.trim()) {
                      event.preventDefault();
                      openFullAI(draftQuery);
                    }
                  }}
                  placeholder="Ask anything..."
                  className="h-11 border-white/10 bg-background/60"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <motion.button
                    key={prompt}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => openFullAI(prompt)}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                  >
                    {prompt}
                  </motion.button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Always one click away
                </div>
                <Button className="rounded-2xl" onClick={() => openFullAI(draftQuery)}>
                  <MessageSquareText className="h-4 w-4" />
                  Open full AI
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <TooltipProvider delayDuration={120}>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button
              type="button"
              onClick={handleFabClick}
              animate={{
                y: [-2, 2, -2],
                scale: presenceState === "thinking" ? [1, 1.07, 1] : [1, 1.03, 1],
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.96 }}
              transition={{
                y: { duration: 5.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" },
                scale: {
                  duration: presenceState === "thinking" ? 1.4 : 4.2,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                },
              }}
              className={cn(
                "pointer-events-auto relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-[#d4af37]/28",
                "bg-[linear-gradient(150deg,rgba(255,255,255,0.18),rgba(250,204,21,0.95)_18%,rgba(245,158,11,0.92)_70%,rgba(150,88,10,0.9))] backdrop-blur-xl",
                "shadow-[0_0_26px_rgba(212,175,55,0.36),0_18px_44px_-22px_rgba(0,0,0,0.7)]",
              )}
            >
              <motion.div
                className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.45),transparent_34%),radial-gradient(circle_at_70%_75%,rgba(120,64,0,0.28),transparent_38%)]"
                animate={{ opacity: panelOpen ? [0.84, 1, 0.84] : [0.7, 0.92, 0.7] }}
                transition={{ duration: 3.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute -inset-2 rounded-full border border-white/18"
                animate={
                  clickedAt
                    ? { scale: [0.9, 1.35], opacity: [0.46, 0] }
                    : { scale: 1, opacity: 0 }
                }
                transition={{ duration: 0.7, ease: "easeOut" }}
                onAnimationComplete={() => setClickedAt(null)}
              />
              <FloatingOrb state={presenceState} panelOpen={panelOpen} />
            </motion.button>
          </TooltipTrigger>
          <TooltipContent side="left" className="border-white/10 bg-[#0d1118]/95 text-foreground backdrop-blur-xl">
            Ask AI
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
