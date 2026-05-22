import { Lock, Sparkles } from "lucide-react";

import { AppLink } from "@/components/AppLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LockedFeatureNotice({
  title,
  description,
  ctaLabel = "Upgrade to unlock",
  to = "/church-admin/billing",
}: {
  title: string;
  description: string;
  ctaLabel?: string;
  to?: string;
}) {
  return (
    <Card className="glass-card border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-sans">
          <Lock className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        <Button asChild>
          <AppLink to={to}>
            <Sparkles className="mr-2 h-4 w-4" />
            {ctaLabel}
          </AppLink>
        </Button>
      </CardContent>
    </Card>
  );
}
