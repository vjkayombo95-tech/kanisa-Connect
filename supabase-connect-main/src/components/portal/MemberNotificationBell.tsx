import { Bell } from "lucide-react";

import { AppLink } from "@/components/AppLink";
import { boundedUnreadLabel, type MemberNotification } from "@/lib/member-notifications";
import { cn } from "@/lib/utils";

export function MemberNotificationBell({ notifications }: { notifications: readonly MemberNotification[] }) {
  const badge = boundedUnreadLabel(notifications);
  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  return (
    <AppLink
      to="/portal/notifications"
      aria-label={unreadCount ? `Arifa, ${unreadCount > 9 ? "zaidi ya 9" : unreadCount} hazijasomwa` : "Arifa"}
      className={cn(
        "relative inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors",
        "hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
      data-testid="member-notification-bell"
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      {badge ? (
        <span
          className="absolute right-0.5 top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground"
          aria-hidden="true"
          data-testid="member-notification-badge"
        >
          {badge}
        </span>
      ) : null}
    </AppLink>
  );
}
