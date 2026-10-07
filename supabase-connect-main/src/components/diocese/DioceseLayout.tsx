import { Landmark } from "lucide-react";
import { Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DioceseSidebar } from "@/components/diocese/DioceseSidebar";
import { useDioceseWorkspace } from "@/components/diocese/DioceseWorkspaceContext";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export function DioceseLayout() {
  const location = useLocation();
  const workspace = useDioceseWorkspace();
  const { t } = useTranslation();

  const pageTitles = [
    {
      segment: "/parishes",
      title: t("diocese_workspace.pages.parishes.title"),
      description: t("diocese_workspace.pages.parishes.description"),
    },
    {
      segment: "/announcements",
      title: t("diocese_workspace.pages.announcements.title"),
      description: t("diocese_workspace.pages.announcements.description"),
    },
    {
      segment: "/events",
      title: t("diocese_workspace.pages.events.title"),
      description: t("diocese_workspace.pages.events.description"),
    },
    {
      segment: "/reports",
      title: t("diocese_workspace.pages.reports.title"),
      description: t("diocese_workspace.pages.reports.description"),
    },
    {
      segment: "/more",
      title: t("diocese_workspace.pages.more.title"),
      description: t("diocese_workspace.pages.more.description"),
    },
  ];

  const currentPage =
    pageTitles.find((page) => location.pathname.includes(page.segment)) ?? {
      title: t("diocese_workspace.pages.overview.title"),
      description: t("diocese_workspace.pages.overview.description"),
    };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <DioceseSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b border-border bg-card/70 backdrop-blur-xl">
            <div className="flex min-h-16 items-center gap-3 px-4 lg:px-6">
              <SidebarTrigger className="h-9 w-9 shrink-0 rounded-xl border border-border/60 text-muted-foreground hover:text-foreground" />

              <div className="gradient-gold flex h-9 w-9 shrink-0 items-center justify-center rounded-xl lg:hidden">
                <Landmark className="h-4 w-4 text-primary-foreground" />
              </div>

              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold text-foreground sm:text-base">
                  {currentPage.title}
                </h1>
                <p className="hidden truncate text-xs text-muted-foreground sm:block">
                  {currentPage.description}
                </p>
              </div>

              <div className="ml-auto min-w-0 text-right">
                <p className="max-w-48 truncate text-xs font-medium text-foreground sm:max-w-72">
                  {workspace.diocese_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("diocese_workspace.workspace_label")}
                </p>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 lg:p-6">
            <div className="mx-auto w-full max-w-7xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
