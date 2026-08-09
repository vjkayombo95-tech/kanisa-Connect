import { BookOpen, CalendarDays, HandCoins, HeartHandshake, MessageCircle } from "lucide-react";

import { AppLink } from "@/components/AppLink";
import { cn } from "@/lib/utils";

function BigAction({
  icon: Icon,
  label,
  hint,
  to,
  primary,
}: {
  icon: typeof HandCoins;
  label: string;
  hint: string;
  to: string;
  primary?: boolean;
}) {
  return (
    <AppLink
      to={to}
      className={cn(
        "flex min-h-24 items-center gap-4 rounded-[28px] border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        primary
          ? "border-primary/25 bg-primary text-primary-foreground"
          : "border-border/70 bg-card/85 text-foreground hover:border-primary/30",
      )}
    >
      <span
        className={cn(
          "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
          primary ? "bg-primary-foreground/15" : "bg-primary/10 text-primary",
        )}
      >
        <Icon className="h-7 w-7" />
      </span>
      <span className="min-w-0">
        <span className="block text-xl font-bold leading-tight">{label}</span>
        <span className={cn("mt-1 block text-sm", primary ? "text-primary-foreground/80" : "text-muted-foreground")}>
          {hint}
        </span>
      </span>
    </AppLink>
  );
}

type QuickActionsCardProps = {
  giveVisible: boolean;
  massVisible: boolean;
  prayerRequestsVisible: boolean;
};

export function QuickActionsCard({ giveVisible, massVisible, prayerRequestsVisible }: QuickActionsCardProps) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {giveVisible ? (
        <BigAction icon={HandCoins} label="Give" hint="Support your parish" to="/portal/give" primary />
      ) : null}
      {massVisible ? (
        <BigAction icon={HeartHandshake} label="Request Mass" hint="Submit an intention" to="/portal/mass-intentions" />
      ) : null}
      {prayerRequestsVisible ? (
        <BigAction icon={MessageCircle} label="Prayer Request" hint="Ask for prayer" to="/portal/prayer-requests" />
      ) : null}
      <BigAction icon={CalendarDays} label="Calendar" hint="See parish schedule" to="/portal/calendar" />
      <BigAction icon={BookOpen} label="Bible" hint="Read Scripture" to="/portal/bible" />
    </section>
  );
}
