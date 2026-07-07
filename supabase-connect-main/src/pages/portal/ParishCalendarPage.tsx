import { ParishCalendar, type ParishCalendarWorkspace } from "@/components/calendar";
import { PageToolbar, getWorkspacePageActions, useWorkspaceContext, useWorkspacePage } from "@/components/workspace";
import { useAuth } from "@/contexts/AuthContext";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

type ParishCalendarPageProps = {
  workspace?: ParishCalendarWorkspace;
};

export default function ParishCalendarPage({ workspace }: ParishCalendarPageProps) {
  const { t } = useTranslation();
  const { churchId } = useAuth();
  const page = useWorkspacePage();
  const workspaceContext = useWorkspaceContext();
  const resolvedWorkspace = workspace ?? (workspaceContext?.workspace.id as ParishCalendarWorkspace | undefined) ?? "member";
  const toolbarActions = useMemo(() => getWorkspacePageActions("calendar", page), [page]);

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <PageToolbar
        title={t("member_portal.parish_life.parish_calendar")}
        description={t("member_portal.parish_life.calendar_page_description")}
        actions={toolbarActions}
      />
      <ParishCalendar
        churchId={churchId}
        workspace={resolvedWorkspace}
        title={t("member_portal.parish_life.parish_calendar")}
        description={t("member_portal.parish_life.calendar_description")}
      />
    </div>
  );
}
