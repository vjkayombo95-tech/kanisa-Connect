import { AnimatePresence, motion, type Transition } from "framer-motion";
import type { ReactNode } from "react";

import { AppLink } from "@/components/AppLink";
import { cn } from "@/lib/utils";

type SidebarItemProps = {
  icon: ReactNode;
  label: string;
  href?: string;
  active?: boolean;
  collapsed?: boolean;
  locked?: boolean;
  badge?: ReactNode;
  delay?: number;
  onClick?: () => void;
};

const itemSpring: Transition = {
  type: "spring",
  stiffness: 280,
  damping: 24,
  mass: 0.9,
};

export function SidebarItem({
  icon,
  label,
  href = "#",
  active = false,
  collapsed = false,
  locked = false,
  badge,
  delay = 0,
  onClick,
}: SidebarItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      whileHover="hover"
      whileTap={{ scale: 0.97 }}
      className="relative"
    >
      <AppLink
        to={href}
        onClick={onClick}
        className={cn(
          "group relative flex items-center overflow-hidden rounded-xl px-2.5 py-2 text-sm transition-colors",
          "border border-transparent",
          active
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
          locked && "text-primary/90",
        )}
      >
        {active && (
          <>
            <motion.div
              layoutId="church-admin-sidebar-active"
              className="absolute inset-0 rounded-xl border border-primary/18 bg-primary/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              transition={itemSpring}
            />
            <motion.div
              layoutId="church-admin-sidebar-indicator"
              className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-primary shadow-[0_0_18px_rgba(250,204,21,0.65)]"
              transition={itemSpring}
            />
          </>
        )}

        <div className="relative z-10 flex min-w-0 items-center gap-3">
          <motion.div
            variants={{
              hover: { scale: 1.1 },
            }}
            transition={itemSpring}
            className={cn(
              "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border backdrop-blur-xl",
              active
                ? "border-primary/20 bg-primary/10 text-primary"
                : "border-white/8 bg-white/[0.03] text-muted-foreground group-hover:border-primary/10 group-hover:bg-white/[0.05] group-hover:text-foreground",
            )}
          >
            <motion.div
              className="absolute inset-1 rounded-lg bg-[radial-gradient(circle_at_center,rgba(250,204,21,0.22),transparent_72%)]"
              initial={false}
              animate={{ opacity: active ? 0.75 : 0 }}
              variants={{ hover: { opacity: 0.45 } }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            />
            <div className="relative z-10 h-5 w-5">{icon}</div>
          </motion.div>

          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                key="label"
                initial={{ opacity: 0, x: -10, width: 0 }}
                animate={{ opacity: 1, x: 0, width: "auto" }}
                exit={{ opacity: 0, x: -8, width: 0 }}
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                className="min-w-0 overflow-hidden"
              >
                <motion.div
                  variants={{
                    hover: { x: 4 },
                  }}
                  transition={itemSpring}
                  className="flex min-w-0 items-center gap-2"
                >
                  <span className="truncate font-medium tracking-[0.01em]">{label}</span>
                  {locked && (
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/90">
                      Lock
                    </span>
                  )}
                  {badge}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.div
          className="absolute inset-0 rounded-xl bg-[linear-gradient(125deg,rgba(255,255,255,0.05),transparent_45%,rgba(250,204,21,0.06)_100%)]"
          initial={false}
          animate={{ opacity: active ? 0.32 : 0 }}
          variants={{ hover: { opacity: active ? 0.32 : 0.18 } }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        />
      </AppLink>
    </motion.div>
  );
}
