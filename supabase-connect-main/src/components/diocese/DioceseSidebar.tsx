import {
  Building2,
  CalendarDays,
  FileBarChart,
  LayoutDashboard,
  Megaphone,
  MoreHorizontal,
  Landmark,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppLink } from "@/components/AppLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useDioceseWorkspace } from "@/components/diocese/DioceseWorkspaceContext";
import { cn } from "@/lib/utils";

export function DioceseSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { t } = useTranslation();
  const workspace = useDioceseWorkspace();
  const collapsed = state === "collapsed";
  const baseUrl = `/diocese/${workspace.diocese_id}`;

  const items = [
    { title: t("diocese_workspace.navigation.overview"), url: baseUrl, icon: LayoutDashboard },
    { title: t("diocese_workspace.navigation.parishes"), url: `${baseUrl}/parishes`, icon: Building2 },
    { title: t("diocese_workspace.navigation.announcements"), url: `${baseUrl}/announcements`, icon: Megaphone },
    { title: t("diocese_workspace.navigation.events"), url: `${baseUrl}/events`, icon: CalendarDays },
    { title: t("diocese_workspace.navigation.reports"), url: `${baseUrl}/reports`, icon: FileBarChart },
    { title: t("diocese_workspace.navigation.more"), url: `${baseUrl}/more`, icon: MoreHorizontal },
  ];

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <div className="flex items-center gap-3 border-b border-sidebar-border p-4">
        <div className="gradient-gold flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
          <Landmark className="h-4 w-4 text-primary-foreground" />
        </div>

        {!collapsed && (
          <div className="min-w-0 overflow-hidden">
            <h2 className="truncate text-sm font-bold text-sidebar-accent-foreground">
              {workspace.diocese_name}
            </h2>
            <p className="truncate text-xs text-muted-foreground">
              {t("diocese_workspace.workspace_label")}
            </p>
          </div>
        )}
      </div>

      <SidebarContent className="py-2">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/60">
              {t("diocese_workspace.diocese")}
            </SidebarGroupLabel>
          )}

          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isHome = item.url === baseUrl;
                const isActive = isHome
                  ? location.pathname === baseUrl ||
                    location.pathname === `${baseUrl}/`
                  : location.pathname === item.url ||
                    location.pathname.startsWith(`${item.url}/`);

                return (
                  <SidebarMenuItem key={item.title}>
                    <AppLink
                      to={item.url}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        isActive &&
                          "bg-sidebar-accent font-medium text-primary",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <span className="truncate">{item.title}</span>
                      )}
                    </AppLink>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
