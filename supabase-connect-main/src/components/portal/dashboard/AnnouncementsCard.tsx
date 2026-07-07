import { Megaphone } from "lucide-react";

import { AppLink } from "@/components/AppLink";
import { ScriptureText } from "@/components/bible";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { MemberHomeData } from "./types";
import { formatDate } from "./utils";

type AnnouncementsCardProps = {
  latestAnnouncement: MemberHomeData["latestAnnouncement"];
  announcementsVisible: boolean;
  announcementsPath?: string;
};

export function AnnouncementsCard({
  latestAnnouncement,
  announcementsVisible,
  announcementsPath = "/portal/announcements",
}: AnnouncementsCardProps) {
  return (
    <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3 text-lg">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Megaphone className="h-5 w-5" />
          </span>
          Tangazo la Karibuni
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {latestAnnouncement ? (
          <div>
            <p className="text-xl font-bold text-foreground">{latestAnnouncement.title}</p>
            {latestAnnouncement.content ? (
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                <ScriptureText text={latestAnnouncement.content} />
              </p>
            ) : null}
            <p className="mt-3 text-xs text-muted-foreground">{formatDate(latestAnnouncement.date)}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Hakuna tangazo jipya kwa sasa.</p>
        )}
        {announcementsVisible ? (
          <Button asChild variant="outline" className="h-12 rounded-2xl px-5">
            <AppLink to={announcementsPath}>Fungua Matangazo</AppLink>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
