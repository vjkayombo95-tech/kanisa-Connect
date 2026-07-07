import { Bell, CheckCircle2, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { AppLink } from "@/components/AppLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EMPTY_CHURCH_ADMIN_PENDING_COUNTS,
  getActionRequiredItems,
  useChurchAdminNotificationItems,
  type ChurchAdminPendingCounts,
} from "@/lib/church-admin-notifications";
import { cn } from "@/lib/utils";

function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[11px] font-bold leading-none text-destructive-foreground",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function ChurchAdminSidebarBadge({ count }: { count: number }) {
  return <CountBadge count={count} className="ml-auto shrink-0" />;
}

export function ChurchAdminNotificationBell({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { counts, items, isLoading, isError } = useChurchAdminNotificationItems();
  const total = counts.total;
  const pendingItems = items.filter((item) => item.count > 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn("relative h-9 w-9 rounded-xl", className)}
          aria-label={total > 0 ? `${total} pending approvals` : "No pending approvals"}
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          <CountBadge count={total} className="absolute -right-1 -top-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between gap-3">
          <span>Action Required</span>
          <Badge variant={total > 0 ? "destructive" : "secondary"}>{total}</Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading ? (
          <div className="space-y-2 p-2">
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
          </div>
        ) : isError ? (
          <div className="p-3 text-sm text-destructive">Unable to load pending approvals.</div>
        ) : pendingItems.length === 0 ? (
          <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            All approval queues are clear.
          </div>
        ) : (
          pendingItems.map((item) => {
            const Icon = item.icon;
            return (
              <DropdownMenuItem
                key={item.key}
                className="cursor-pointer gap-3"
                onSelect={() => navigate(item.route)}
              >
                <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                </span>
                <CountBadge count={item.count} />
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ChurchAdminActionRequiredCard({
  counts = EMPTY_CHURCH_ADMIN_PENDING_COUNTS,
  isLoading,
  isError,
}: {
  counts?: ChurchAdminPendingCounts;
  isLoading?: boolean;
  isError?: boolean;
}) {
  const items = getActionRequiredItems(counts);

  return (
    <Card className="rounded-[28px] border-destructive/20 bg-card/90 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3 text-lg">
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Bell className="h-5 w-5" aria-hidden="true" />}
            </span>
            <span>Action Required</span>
          </span>
          <CountBadge count={counts.total} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isError ? (
          <p className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            Pending approvals could not be loaded.
          </p>
        ) : isLoading ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/50 p-4 text-sm text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" aria-hidden="true" />
            No pending approvals right now.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <AppLink
                  key={item.key}
                  to={item.route}
                  className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/50 p-4 transition-colors hover:border-destructive/40 hover:bg-destructive/5"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{item.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                  </span>
                  <CountBadge count={item.count} />
                </AppLink>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
