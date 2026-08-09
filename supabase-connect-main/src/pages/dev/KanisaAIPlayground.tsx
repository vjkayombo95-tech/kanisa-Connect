import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, Route, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import {
  createKanisaAIContext,
  decideKanisaAIRoute,
  routeKanisaAIRequest,
  supportedKanisaIntents,
} from "@/lib/ai";

export default function KanisaAIPlayground() {
  const [input, setInput] = useState("Today's Gospel");
  const { churchId, isSuperAdmin, userRole } = useAuth();
  const queryClient = useQueryClient();

  const context = useMemo(
    () =>
      createKanisaAIContext({
        role: userRole,
        isSuperAdmin,
        church: { id: churchId },
        tenant: { id: churchId },
        route: typeof window === "undefined" ? "/" : window.location.pathname,
        page: "kanisa-ai-playground",
        language: "en",
        queryClient,
      }),
    [churchId, isSuperAdmin, queryClient, userRole],
  );

  const request = useMemo(() => ({ input, context }), [context, input]);
  const decision = useMemo(() => decideKanisaAIRoute(request), [request]);
  const response = useMemo(() => routeKanisaAIRequest(request), [request]);

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-primary">
                <Bot className="h-4 w-4" />
                Development only
              </p>
              <h1 className="mt-2 font-serif text-2xl font-bold">Kanisa AI Orchestrator Playground</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Test intent routing without sending anything to an AI provider.
              </p>
            </div>
            <Badge variant="outline" className="rounded-full">
              {context.workspace}
            </Badge>
          </div>
          <label htmlFor="kanisa-ai-input" className="mt-5 block text-sm font-medium">
            Request
          </label>
          <Input
            id="kanisa-ai-input"
            className="mt-2"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Try: Today's Gospel, Explain today's Gospel, My Mass Intentions"
          />
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="space-y-2 p-5">
              <Route className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">Intent</p>
              <p className="break-words font-mono text-sm font-semibold">{decision.intent}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-5">
              <Bot className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">AI</p>
              <p className="font-mono text-sm font-semibold">{String(decision.requiresAI)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-5">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">Handler</p>
              <p className="break-words font-mono text-sm font-semibold">{decision.handler}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Allowed:</span>{" "}
                <span className="font-mono">{String(decision.allowed)}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Target:</span>{" "}
                <span className="font-mono">{decision.targetRoute ?? "-"}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Action:</span>{" "}
                <span className="font-mono">{decision.action?.id ?? "-"}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Permission:</span>{" "}
                <span className="font-mono">{decision.action?.permission ?? "-"}</span>
              </p>
            </div>
            {decision.reason ? <p className="text-sm text-destructive">{decision.reason}</p> : null}
            <pre className="max-h-80 overflow-auto rounded-lg bg-muted p-4 text-xs">
              {JSON.stringify(response, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="mb-3 text-sm font-medium">Supported intents</p>
            <div className="flex flex-wrap gap-2">
              {supportedKanisaIntents.map((intent) => (
                <Badge key={intent} variant="secondary" className="rounded-full font-mono">
                  {intent}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
