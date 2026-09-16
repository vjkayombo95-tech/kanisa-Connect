import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  adminNotificationsKey,
  fetchScopedNotifications,
  markAllScopedNotificationsRead,
  markScopedNotificationRead,
  type MemberNotification,
} from "@/lib/member-notifications";

const ADMIN_NOTIFICATION_LIMIT = 50;

function NotificationCard({
  notification,
  onMarkRead,
  isPending,
}: {
  notification: MemberNotification;
  onMarkRead: (id: string) => void;
  isPending: boolean;
}) {
  const content = (
    <CardContent className="flex items-start gap-3 p-4 text-left">
      {!notification.is_read && <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium">{notification.title}</p>
        <p className="mt-1 break-words text-sm text-muted-foreground">{notification.message}</p>
        <p className="mt-1 text-xs text-muted-foreground/60">{new Date(notification.created_at).toLocaleString()}</p>
        {isPending ? (
          <span className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Updating
          </span>
        ) : null}
      </div>
    </CardContent>
  );

  if (notification.is_read) {
    return <Card className="glass-card">{content}</Card>;
  }

  return (
    <button
      type="button"
      className="block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60"
      onClick={() => onMarkRead(notification.id)}
      disabled={isPending}
      aria-label={`Mark notification ${notification.title} as read`}
    >
      <Card className="glass-card border-primary/30">{content}</Card>
    </button>
  );
}

export default function NotificationsPage() {
  const { user, churchId } = useAuth();
  const userId = user?.id ?? null;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const pendingIds = useRef(new Set<string>());
  const queryKey = adminNotificationsKey(userId, churchId);

  const notificationsQuery = useQuery({
    queryKey,
    queryFn: () => fetchScopedNotifications(userId!, churchId!, ADMIN_NOTIFICATION_LIMIT),
    enabled: !!userId && !!churchId,
  });

  const notifications = notificationsQuery.data ?? [];

  const markRead = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!userId || !churchId) throw new Error("Notification ownership is unavailable.");
      return markScopedNotificationRead(notificationId, userId, churchId);
    },
    onSuccess: (notificationId) => {
      queryClient.setQueryData<MemberNotification[]>(queryKey, (current = []) =>
        current.map((notification) => notification.id === notificationId ? { ...notification, is_read: true } : notification),
      );
    },
    onError: () => toast({ title: "Notification could not be updated", description: "Please try again.", variant: "destructive" }),
    onSettled: (_data, _error, notificationId) => {
      pendingIds.current.delete(notificationId);
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!userId || !churchId) throw new Error("Notification ownership is unavailable.");
      return markAllScopedNotificationsRead(userId, churchId);
    },
    onSuccess: () => {
      queryClient.setQueryData<MemberNotification[]>(queryKey, (current = []) =>
        current.map((notification) => ({ ...notification, is_read: true })),
      );
      toast({ title: "All notifications marked as read" });
    },
    onError: () => toast({ title: "Notifications could not be updated", description: "Please try again.", variant: "destructive" }),
  });

  const requestMarkRead = (notificationId: string) => {
    if (pendingIds.current.has(notificationId)) return;
    pendingIds.current.add(notificationId);
    markRead.mutate(notificationId);
  };

  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">{unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
            {markAllRead.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Mark All Read
          </Button>
        )}
      </div>

      {notificationsQuery.isLoading ? (
        <div className="flex justify-center py-16" aria-label="Notifications loading">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : notificationsQuery.isError ? (
        <Card className="glass-card border-destructive/30">
          <CardContent className="space-y-3 p-6 text-sm text-destructive" role="alert">
            <p>Notifications could not be loaded.</p>
            <Button type="button" variant="outline" onClick={() => void notificationsQuery.refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : notifications.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Bell className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
            <p>No notifications.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onMarkRead={requestMarkRead}
              isPending={markRead.isPending && markRead.variables === notification.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
