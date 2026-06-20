import {
  LayoutDashboard, Building2, CreditCard, Receipt, ToggleRight,
  TrendingUp, FileText, Activity, Settings, Shield, Archive,
} from "lucide-react";
import { AppLink } from "@/components/AppLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useUnresolvedSystemLogCount } from "@/hooks/use-system-log-alert";

const items = [
  { title: "Platform Dashboard", url: "/super-admin", icon: LayoutDashboard },
  { title: "Church Management", url: "/super-admin/churches", icon: Building2 },
  { title: "Subscriptions", url: "/super-admin/subscriptions", icon: CreditCard },
  { title: "Billing Verification", url: "/super-admin/billing-verification", icon: Receipt },
  { title: "Record Preservation", url: "/super-admin/record-preservation", icon: Archive },
  { title: "Feature Management", url: "/super-admin/features", icon: ToggleRight },
  { title: "Revenue Analytics", url: "/super-admin/revenue", icon: TrendingUp },
  { title: "Platform Activity", url: "/super-admin/logs", icon: Activity },
  { title: "System Logs", url: "/super-admin/system-logs", icon: FileText },
  { title: "User Activity", url: "/super-admin/activity", icon: Activity },
  { title: "Platform Settings", url: "/super-admin/settings", icon: Settings },
];

export function SuperAdminSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { data: unresolvedSystemLogCount = 0 } = useUnresolvedSystemLogCount();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
        <div className="h-8 w-8 rounded-lg gradient-gold flex items-center justify-center shrink-0">
          <Shield className="h-4 w-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h2 className="text-sm font-bold text-sidebar-accent-foreground truncate">Kanisa Connect</h2>
            <p className="text-xs text-muted-foreground truncate">Super Admin</p>
          </div>
        )}
      </div>
      <SidebarContent className="py-2">
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/60">Platform Monitoring</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive =
                  item.url === "/super-admin"
                    ? location.pathname === item.url
                    : location.pathname === item.url || location.pathname.startsWith(`${item.url}/`);
                const showSystemLogDot = item.url === "/super-admin/system-logs" && unresolvedSystemLogCount > 0;

                return (
                  <SidebarMenuItem key={item.title}>
                    <AppLink
                      to={item.url}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        isActive && "bg-sidebar-accent font-medium text-primary",
                      )}
                    >
                      <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                        <item.icon className="h-4 w-4" />
                        {showSystemLogDot && (
                          <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-sidebar" />
                        )}
                      </span>
                      {!collapsed && (
                        <span className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="truncate">{item.title}</span>
                          {showSystemLogDot && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-destructive" aria-label="Unresolved system logs" />
                          )}
                        </span>
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
