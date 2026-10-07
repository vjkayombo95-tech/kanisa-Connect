import { useTranslation } from "react-i18next";
import { useDioceseWorkspace } from "@/components/diocese/DioceseWorkspaceContext";

interface DiocesePlaceholderPageProps {
  title: string;
  description: string;
}

export function DiocesePlaceholderPage({
  title,
  description,
}: DiocesePlaceholderPageProps) {
  const workspace = useDioceseWorkspace();
  const { t } = useTranslation();

  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm font-medium text-primary">
          {workspace.diocese_name}
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {description}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          {t("diocese_workspace.placeholder")}
        </p>
      </div>
    </section>
  );
}
