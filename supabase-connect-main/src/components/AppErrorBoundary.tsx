import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { captureException } from "@/lib/error-logger";
import { Translation } from "react-i18next";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: "",
    };
  }

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : "",
    };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    captureException(error, {
      component: "AppErrorBoundary",
      page: "Application",
      function: "componentDidCatch",
      metadata: {
        componentStack: errorInfo.componentStack,
      },
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReturnHome = () => {
    window.location.assign("/");
  };

  render() {
    if (this.state.hasError) {
      return (
        <Translation>
          {(t) => (
            <div className="min-h-screen bg-background px-4 py-16">
              <div className="mx-auto max-w-2xl rounded-2xl border border-destructive/30 bg-card p-8 shadow-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-destructive">
                  {t("shared.errors.application_label")}
                </p>
                <h1 className="mt-3 text-2xl font-bold font-serif">{t("shared.errors.page_crashed_title")}</h1>
                <p className="mt-3 text-sm text-muted-foreground">
                  {this.state.errorMessage || t("shared.errors.render_failed")}
                </p>
                <div className="mt-6">
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={this.handleReload}>{t("shared.actions.reload_app")}</Button>
                    <Button variant="outline" onClick={this.handleReturnHome}>{t("shared.actions.return_home")}</Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Translation>
      );
    }

    return this.props.children;
  }
}
