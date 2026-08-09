import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";

import { Card, CardContent } from "@/components/ui/card";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { createPersonalAssistantModel } from "@/lib/assistant";
import { cn } from "@/lib/utils";
import type { WorkspaceId } from "@/components/workspace";

import { AssistantBriefing } from "./AssistantBriefing";
import { AssistantEvents } from "./AssistantEvents";
import { AssistantGreeting } from "./AssistantGreeting";
import { AssistantSection } from "./AssistantSection";
import { AssistantSuggestions } from "./AssistantSuggestions";
import { AssistantTaskCard } from "./AssistantTaskCard";

type PersonalAssistantCardProps = {
  workspace: WorkspaceId;
  role?: string | null;
  churchName?: string | null;
  displayName?: string | null;
  liturgicalSeason?: string | null;
  dashboardContext?: unknown;
  className?: string;
};

export function PersonalAssistantCard({
  workspace,
  role = null,
  churchName = null,
  displayName = null,
  liturgicalSeason = null,
  dashboardContext,
  className,
}: PersonalAssistantCardProps) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const featureAccess = useFeatureAccess();

  const model = useMemo(
    () =>
      createPersonalAssistantModel({
        workspace,
        role,
        churchName,
        displayName,
        liturgicalSeason,
        route: location.pathname,
        today: new Date(),
        dashboardContext,
        queryClient,
        featureFlags: {
          isFeatureEnabled: featureAccess.isFeatureEnabled,
          isFeatureVisible: featureAccess.isFeatureVisible,
        },
      }),
    [
      churchName,
      dashboardContext,
      displayName,
      featureAccess.isFeatureEnabled,
      featureAccess.isFeatureVisible,
      liturgicalSeason,
      location.pathname,
      queryClient,
      role,
      workspace,
    ],
  );

  return (
    <Card className={cn("overflow-hidden border-primary/20 bg-card/90 shadow-sm", className)}>
      <CardContent className="space-y-5 p-4 sm:p-5">
        <AssistantGreeting greeting={model.greeting} />
        <AssistantSection title="Event intelligence">
          <AssistantEvents events={model.events} />
        </AssistantSection>
        <AssistantSection title="Daily briefing">
          <AssistantBriefing items={model.briefing} />
        </AssistantSection>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
          <AssistantSection title="Suggested actions">
            <AssistantSuggestions suggestions={model.suggestions} />
          </AssistantSection>
          <AssistantSection title="Priority tasks">
            <div className="grid gap-2">
              {model.tasks.map((task) => (
                <AssistantTaskCard key={task.id} task={task} />
              ))}
            </div>
          </AssistantSection>
        </div>
      </CardContent>
    </Card>
  );
}
