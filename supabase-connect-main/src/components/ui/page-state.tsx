import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, CloudOff, Lock, RefreshCw, SearchX, WifiOff } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <Card className={cn("glass-card", className)}>
      <CardContent className="flex flex-col items-center justify-center gap-3 px-4 py-14 text-center sm:px-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon ?? <SearchX className="h-6 w-6" aria-hidden="true" />}
        </div>
        <div className="max-w-md space-y-1">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {action ? <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div> : null}
      </CardContent>
    </Card>
  );
}

type ErrorKind = "network" | "permission" | "timeout" | "offline" | "unexpected";

const errorCopy: Record<ErrorKind, { title: string; description: string; icon: ReactNode }> = {
  network: {
    title: "We could not reach Kanisa Connect.",
    description: "Please check your connection and try again.",
    icon: <CloudOff className="h-4 w-4" aria-hidden="true" />,
  },
  permission: {
    title: "This area is not available to your role.",
    description: "If you expected access, ask your church administrator to review your workspace role.",
    icon: <Lock className="h-4 w-4" aria-hidden="true" />,
  },
  timeout: {
    title: "This is taking longer than expected.",
    description: "The request may still complete. You can retry now or come back in a moment.",
    icon: <RefreshCw className="h-4 w-4" aria-hidden="true" />,
  },
  offline: {
    title: "You are offline.",
    description: "Saved data may still be visible. New changes will work again when internet returns.",
    icon: <WifiOff className="h-4 w-4" aria-hidden="true" />,
  },
  unexpected: {
    title: "Something did not load correctly.",
    description: "Please retry. If it keeps happening, contact support with the page you were viewing.",
    icon: <AlertCircle className="h-4 w-4" aria-hidden="true" />,
  },
};

type ErrorStateProps = {
  kind?: ErrorKind;
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorState({ kind = "unexpected", title, description, onRetry, className }: ErrorStateProps) {
  const copy = errorCopy[kind];

  return (
    <Alert variant="destructive" className={cn("border-destructive/30 bg-destructive/10", className)}>
      {copy.icon}
      <AlertTitle>{title ?? copy.title}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{description ?? copy.description}</p>
        {onRetry ? (
          <Button type="button" size="sm" variant="outline" onClick={onRetry} className="border-destructive/30">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

type LoadingStateProps = {
  title?: string;
  rows?: number;
  variant?: "cards" | "table" | "dashboard" | "page";
  className?: string;
};

export function LoadingState({ title = "Loading this page", rows = 3, variant = "cards", className }: LoadingStateProps) {
  if (variant === "table") {
    return (
      <div className={cn("space-y-3", className)} aria-label={title} role="status">
        <span className="sr-only">{title}</span>
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="grid gap-3 rounded-lg border border-border/60 p-3 sm:grid-cols-4">
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "dashboard") {
    return (
      <div className={cn("space-y-4", className)} aria-label={title} role="status">
        <span className="sr-only">{title}</span>
        <Skeleton className="h-28 rounded-lg" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "page") {
    return (
      <div className={cn("space-y-5", className)} aria-label={title} role="status">
        <span className="sr-only">{title}</span>
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)} aria-label={title} role="status">
      <span className="sr-only">{title}</span>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-28 rounded-lg" />
      ))}
    </div>
  );
}

export function SuccessInline({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 rounded-lg border border-success/25 bg-success/10 p-3 text-sm text-success", className)}>
      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
