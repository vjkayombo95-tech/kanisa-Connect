import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, Bell, History, Play, Workflow } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { getWorkspaceIdForRole } from "@/components/workspace";
import {
  createAutomationEvent,
  evaluateAutomationEvent,
  getAutomationAssistantEvents,
  getAutomationHistory,
  getAutomationRules,
  getQueuedReminders,
  type AutomationEventType,
} from "@/lib/automation";

const sampleEvents: Array<{ type: AutomationEventType; label: string; payload?: Record<string, unknown> }> = [
  { type: "MASS_TOMORROW", label: "Mass tomorrow" },
  { type: "PRAYER_REQUEST_APPROVED", label: "Prayer approved", payload: { status: "approved" } },
  { type: "CONTRIBUTION_RECORDED", label: "Contribution recorded", payload: { amount: 1250000 } },
  { type: "PLEDGE_DUE", label: "Pledge due", payload: { status: "due" } },
  { type: "PRAYER_REQUEST_PENDING", label: "Prayer waiting 48h", payload: { createdAt: new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString() } },
  { type: "MASS_INTENTION_CREATED", label: "Mass intention created" },
  { type: "ANNOUNCEMENT_EXPIRING", label: "Announcement expiring" },
  { type: "INVITATION_PENDING", label: "Invitation pending", payload: { status: "pending" } },
  { type: "PLATFORM_HEALTH_WARNING", label: "Platform warning", payload: { priority: "critical" } },
];

export default function AutomationPlayground() {
  const { churchId, isSuperAdmin, userRole } = useAuth();
  const queryClient = useQueryClient();
  const workspace = getWorkspaceIdForRole(userRole, isSuperAdmin);
  const [eventType, setEventType] = useState<AutomationEventType>("MASS_TOMORROW");
  const [result, setResult] = useState<ReturnType<typeof evaluateAutomationEvent> | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const selected = useMemo(() => sampleEvents.find((item) => item.type === eventType) ?? sampleEvents[0], [eventType]);
  const rules = useMemo(() => getAutomationRules(), [refreshKey]);
  const history = useMemo(() => getAutomationHistory(), [refreshKey]);
  const assistantEvents = useMemo(() => getAutomationAssistantEvents(), [refreshKey]);
  const queued = useMemo(() => getQueuedReminders(), [refreshKey]);

  const runEvent = () => {
    const event = createAutomationEvent({
      type: selected.type,
      workspace,
      role: isSuperAdmin ? "super_admin" : userRole,
      churchId,
      route: "/dev/automation",
      payload: {
        ...selected.payload,
        queryCacheSize: queryClient.getQueryCache().findAll().length,
      },
    });
    setResult(evaluateAutomationEvent(event));
    setRefreshKey((key) => key + 1);
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-primary">
                <Workflow className="h-4 w-4" />
                Development only
              </p>
              <h1 className="mt-2 font-serif text-2xl font-bold">Kanisa Automation Engine Playground</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Simulate business events, inspect matched rules, and see in-memory actions.
              </p>
            </div>
            <Badge variant="outline" className="rounded-full">
              {workspace}
            </Badge>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Select value={eventType} onValueChange={(value) => setEventType(value as AutomationEventType)}>
              <SelectTrigger className="sm:w-80">
                <SelectValue placeholder="Choose event" />
              </SelectTrigger>
              <SelectContent>
                {sampleEvents.map((event) => (
                  <SelectItem key={event.type} value={event.type}>
                    {event.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={runEvent} className="gap-2">
              <Play className="h-4 w-4" />
              Run event
            </Button>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="space-y-2 p-5">
              <Activity className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">Incoming event</p>
              <p className="break-words font-mono text-xs font-semibold">{eventType}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-5">
              <Workflow className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">Registered rules</p>
              <p className="font-mono text-sm font-semibold">{rules.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-5">
              <Bell className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">Assistant events</p>
              <p className="font-mono text-sm font-semibold">{assistantEvents.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-5">
              <History className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">History</p>
              <p className="font-mono text-sm font-semibold">{history.length}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="space-y-4 p-5">
            <p className="text-sm font-medium">Matched rules and actions</p>
            <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-4 text-xs">
              {JSON.stringify(result ?? { message: "Run an event to see matches." }, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="text-sm font-medium">Automation history</p>
              <pre className="max-h-80 overflow-auto rounded-lg bg-muted p-4 text-xs">{JSON.stringify(history, null, 2)}</pre>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="text-sm font-medium">Assistant events</p>
              <pre className="max-h-80 overflow-auto rounded-lg bg-muted p-4 text-xs">{JSON.stringify(assistantEvents, null, 2)}</pre>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="text-sm font-medium">Queued reminders</p>
              <pre className="max-h-80 overflow-auto rounded-lg bg-muted p-4 text-xs">{JSON.stringify(queued, null, 2)}</pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

