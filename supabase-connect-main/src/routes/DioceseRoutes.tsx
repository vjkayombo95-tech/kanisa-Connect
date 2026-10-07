import { Route, Routes } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DioceseLayout } from "@/components/diocese/DioceseLayout";
import { DiocesePlaceholderPage } from "@/pages/diocese/DiocesePlaceholderPage";
import { DioceseParishesPage } from "@/pages/diocese/DioceseParishesPage";

export default function DioceseRoutes() {
  const { t } = useTranslation();

  return (
    <Routes>
      <Route element={<DioceseLayout />}>
        <Route
          index
          element={
            <DiocesePlaceholderPage
              title={t("diocese_workspace.pages.overview.title")}
              description={t("diocese_workspace.pages.overview.description")}
            />
          }
        />

        <Route
          path="parishes"
          element={<DioceseParishesPage />}
        />

        <Route
          path="announcements"
          element={
            <DiocesePlaceholderPage
              title={t("diocese_workspace.pages.announcements.title")}
              description={t("diocese_workspace.pages.announcements.description")}
            />
          }
        />

        <Route
          path="events"
          element={
            <DiocesePlaceholderPage
              title={t("diocese_workspace.pages.events.title")}
              description={t("diocese_workspace.pages.events.description")}
            />
          }
        />

        <Route
          path="reports"
          element={
            <DiocesePlaceholderPage
              title={t("diocese_workspace.pages.reports.title")}
              description={t("diocese_workspace.pages.reports.description")}
            />
          }
        />

        <Route
          path="more"
          element={
            <DiocesePlaceholderPage
              title={t("diocese_workspace.pages.more.title")}
              description={t("diocese_workspace.pages.more.description")}
            />
          }
        />
      </Route>
    </Routes>
  );
}
