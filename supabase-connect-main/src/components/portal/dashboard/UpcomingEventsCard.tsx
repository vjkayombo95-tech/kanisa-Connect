import type { UseMutationResult } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import type { NextMassSummary } from "./types";
import { formatDate, formatMassTime } from "./utils";

type UpcomingEventsCardProps = {
  massSummary: NextMassSummary | undefined;
  submitMassResponse: UseMutationResult<NextMassSummary, Error, "yes" | "maybe" | "no", unknown>;
  rsvpDisabled: boolean;
  deadlinePassed: boolean;
};

export function UpcomingEventsCard({
  massSummary,
  submitMassResponse,
  rsvpDisabled,
  deadlinePassed,
}: UpcomingEventsCardProps) {
  const nextMass = massSummary?.mass ?? null;

  return (
    <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">Upcoming Mass</p>
            {nextMass ? (
              <>
                <h2 className="mt-1 text-2xl font-bold text-foreground">{nextMass.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDate(nextMass.mass_date)} Â· {formatMassTime(nextMass.start_time)}
                </p>
                {nextMass.response_deadline ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    RSVP deadline: {new Date(nextMass.response_deadline).toLocaleString("en-TZ")}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No upcoming Mass scheduled.</p>
            )}
          </div>

          {nextMass ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Will you attend?</p>
              <div className="flex flex-wrap gap-2">
                {(["yes", "maybe", "no"] as const).map((response) => (
                  <Button
                    key={response}
                    variant={nextMass.my_response === response ? "default" : "outline"}
                    className="min-w-24 capitalize"
                    disabled={rsvpDisabled}
                    onClick={() => submitMassResponse.mutate(response)}
                  >
                    {submitMassResponse.isPending && submitMassResponse.variables === response ? "Saving..." : response}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>Expected: {massSummary?.yes_count ?? 0}</span>
                <span>Maybe: {massSummary?.maybe_count ?? 0}</span>
                <span>Response rate: {Number(massSummary?.response_rate ?? 0).toFixed(0)}%</span>
              </div>
              {deadlinePassed ? <p className="text-xs text-muted-foreground">RSVP deadline has passed.</p> : null}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
