import { Component, ReactNode } from "react";

import { Button } from "@/components/ui/button";

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
      errorMessage: error instanceof Error ? error.message : "An unexpected error occurred.",
    };
  }

  componentDidCatch(error: unknown) {
    console.error("AppErrorBoundary caught an error:", error);
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
        <div className="min-h-screen bg-background px-4 py-16">
          <div className="mx-auto max-w-2xl rounded-2xl border border-destructive/30 bg-card p-8 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-destructive">
              Application Error
            </p>
            <h1 className="mt-3 text-2xl font-bold font-serif">This page ran into an error.</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {this.state.errorMessage || "Something went wrong while rendering this page."}
            </p>
            <div className="mt-6">
              <div className="flex flex-wrap gap-3">
                <Button onClick={this.handleReload}>Reload App</Button>
                <Button variant="outline" onClick={this.handleReturnHome}>Return Home</Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
