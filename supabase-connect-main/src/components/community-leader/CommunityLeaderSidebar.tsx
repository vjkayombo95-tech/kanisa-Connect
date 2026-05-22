import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Sidebar, SidebarContent, useSidebar } from "@/components/ui/sidebar";
import { SidebarItem } from "@/components/church-admin/SidebarItem";
import { cn } from "@/lib/utils";

import {
  CommunityBuildingIcon,
  CommunityChannelsIcon,
  CommunityContributionsIcon,
  CommunityDashboardIcon,
  CommunityHomeIcon,
  CommunityLeadershipIcon,
  CommunityMembersIcon,
  CommunityPledgesIcon,
  CommunityReportsIcon,
} from "./sidebar-icons";

interface Props {
  communityId: string;
  communityName: string;
  leadershipRole: string;
}

type IconComponent = (props: { active?: boolean; className?: string }) => React.ReactNode;

export function CommunityLeaderSidebar({ communityId, communityName, leadershipRole }: Props) {
  const { state } = useSidebar();
  const location = useLocation();
  const collapsed = state === "collapsed";

  const base = `/community/${communityId}`;
  const navItems: Array<{ title: string; url: string; icon: IconComponent }> = [
    { title: "Dashboard", url: base, icon: CommunityDashboardIcon },
    { title: "Members", url: `${base}/members`, icon: CommunityMembersIcon },
    { title: "Contributions", url: `${base}/contributions`, icon: CommunityContributionsIcon },
    { title: "Pledges", url: `${base}/pledges`, icon: CommunityPledgesIcon },
    { title: "Reports", url: `${base}/reports`, icon: CommunityReportsIcon },
    { title: "Channels", url: `${base}/channels`, icon: CommunityChannelsIcon },
    { title: "Leadership", url: `${base}/leadership`, icon: CommunityLeadershipIcon },
  ];

  const isItemActive = (url: string) =>
    url === base ? location.pathname === url : location.pathname === url || location.pathname.startsWith(`${url}/`);

  return (
    <Sidebar
      collapsible="icon"
      className={cn(
        "border-r border-white/6 bg-[#0b0f14]/92 p-3 text-sidebar-foreground backdrop-blur-2xl",
        "before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.12),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.05),transparent_28%)] before:content-['']",
      )}
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-[28px] border border-white/8 bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_28px_80px_-42px_rgba(0,0,0,0.88)] backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_24%,transparent_76%,rgba(250,204,21,0.05))]" />

        <motion.div className="relative z-10 flex items-center gap-3 border-b border-white/8 px-3 py-4">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-primary/20 bg-[linear-gradient(145deg,rgba(250,204,21,0.24),rgba(250,204,21,0.08))] shadow-[0_18px_34px_-24px_rgba(250,204,21,0.55)]">
            <CommunityBuildingIcon active className="h-5 w-5 text-primary" />
          </div>

          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="min-w-0"
              >
                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80">
                  Community
                </p>
                <h2 className="truncate text-sm font-semibold text-foreground">{communityName}</h2>
                <Badge variant="secondary" className="mt-1 h-5 rounded-full border border-white/8 bg-white/[0.05] px-2 text-[10px] text-muted-foreground">
                  {leadershipRole}
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <SidebarContent className="premium-scrollbar relative z-10 flex-1 overflow-y-auto px-2 py-3 pr-1 scrollbar-gutter-stable">
          <section className="space-y-2">
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="px-3"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.26em] text-muted-foreground/55">
                    Community
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1.5">
              {navItems.map((item, index) => {
                const active = isItemActive(item.url);
                const Icon = item.icon;

                return (
                  <SidebarItem
                    key={item.title}
                    href={item.url}
                    icon={<Icon active={active} className="h-5 w-5" />}
                    label={item.title}
                    active={active}
                    collapsed={collapsed}
                    delay={index * 0.035}
                  />
                );
              })}
            </div>
          </section>
        </SidebarContent>

        <div className="relative z-10 border-t border-white/8 p-2">
          <SidebarItem
            href="/portal"
            icon={<CommunityHomeIcon active={location.pathname.startsWith("/portal")} className="h-5 w-5" />}
            label="Back to Portal"
            active={location.pathname.startsWith("/portal")}
            collapsed={collapsed}
            delay={0.2}
          />
        </div>
      </div>
    </Sidebar>
  );
}
