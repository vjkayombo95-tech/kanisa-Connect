import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useMemberNotifications } from "@/hooks/use-member-notifications";
import { useToast } from "@/hooks/use-toast";
import {
  markMemberNotificationRead,
  memberNotificationsKey,
  type MemberNotification,
} from "@/lib/member-notifications";
import { cn } from "@/lib/utils";

function NotificationContent({ notification }: { notification: MemberNotification }) {
  return (
    <span className="flex min-w-0 flex-1 items-start gap-3 text-left">
      <span className={cn("mt-2 h-2.5 w-2.5 shrink-0 rounded-full", notification.is_read ? "bg-muted-foreground/30" : "bg-primary")} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0 break-words text-sm font-bold text-foreground">{notification.title}</span>
          {!notification.is_read ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">Mpya</span> : null}
        </span>
        <span className="mt-1 block min-w-0 break-words text-sm leading-6 text-muted-foreground">{notification.message}</span>
        <time className="mt-2 block text-xs text-muted-foreground/75" dateTime={notification.created_at}>
          {new Date(notification.created_at).toLocaleString("sw-TZ", { dateStyle: "medium", timeStyle: "short" })}
        </time>
      </span>
      {!notification.is_read ? <Check className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> : null}
    </span>
  );
}

export default function MemberNotificationsPage() {
  const { user, churchId } = useAuth();
  const featureAccess = useFeatureAccess();
  const featureState = featureAccess.getFeatureState("notifications");
  const notifications = useMemberNotifications(
    featureAccess.isResolved && featureState.exists && featureState.visible,
  );
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const pendingIds = useRef(new Set<string>());
  const userId = user?.id ?? null;

  const markRead = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!userId || !churchId) throw new Error("Utambulisho wa arifa haujapatikana.");
      return markMemberNotificationRead(notificationId, userId, churchId);
    },
    onSuccess: (notificationId) => {
      queryClient.setQueryData<MemberNotification[]>(memberNotificationsKey(userId, churchId), (current = []) =>
        current.map((notification) => notification.id === notificationId ? { ...notification, is_read: true } : notification),
      );
    },
    onError: () => toast({ title: "Arifa haikuweza kusasishwa", description: "Jaribu tena.", variant: "destructive" }),
    onSettled: (_data, _error, notificationId) => { pendingIds.current.delete(notificationId); },
  });

  const requestMarkRead = (notificationId: string) => {
    if (pendingIds.current.has(notificationId)) return;
    pendingIds.current.add(notificationId);
    markRead.mutate(notificationId);
  };

  return (
    <main className="mx-auto min-w-0 max-w-3xl space-y-5 overflow-x-hidden px-4 py-6 pb-36 lg:px-8 lg:pb-12" data-testid="member-notifications-page">
      <header className="rounded-[28px] border border-primary/20 bg-card/90 p-5 shadow-sm sm:p-7">
        <p className="flex items-center gap-2 text-sm font-bold text-primary"><Bell className="h-4 w-4" />Arifa</p>
        <h1 className="mt-2 break-words text-3xl font-bold tracking-tight">Arifa</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Taarifa na vikumbusho vyako vya Kanisa.</p>
      </header>

      {notifications.isLoading ? (
        <div className="space-y-3" aria-label="Arifa zinapakiwa"><Skeleton className="h-28 rounded-[24px]" /><Skeleton className="h-28 rounded-[24px]" /></div>
      ) : notifications.isError ? (
        <Card className="border-destructive/30"><CardContent className="space-y-3 p-5" role="alert"><p className="text-sm text-destructive">Imeshindikana kupakia arifa.</p><Button type="button" variant="outline" onClick={() => void notifications.refetch()}>Jaribu tena</Button></CardContent></Card>
      ) : !notifications.data?.length ? (
        <Card><CardContent className="flex min-h-40 flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground"><Bell className="h-9 w-9 opacity-40" /><p>Huna arifa kwa sasa.</p></CardContent></Card>
      ) : (
        <section className="space-y-3" aria-label="Orodha ya arifa">
          {notifications.data.map((notification) => notification.is_read ? (
            <Card key={notification.id} className="min-w-0 border-border/60 bg-card/65"><CardContent className="min-w-0 p-4"><NotificationContent notification={notification} /></CardContent></Card>
          ) : (
            <button
              key={notification.id}
              type="button"
              className="block min-h-24 w-full min-w-0 rounded-[24px] border border-primary/30 bg-card/95 p-4 shadow-sm transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60"
              onClick={() => requestMarkRead(notification.id)}
              disabled={markRead.isPending && markRead.variables === notification.id}
              aria-label={`Weka arifa ${notification.title} kuwa imesomwa`}
            >
              <NotificationContent notification={notification} />
              {markRead.isPending && markRead.variables === notification.id ? <span className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Inasasisha</span> : null}
            </button>
          ))}
        </section>
      )}
    </main>
  );
}
