import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Clock, CreditCard, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/church-admin/StatCard";
import { BILLING_PLANS, getPlanDefinition } from "@/lib/billing";
import { formatTZS } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";

const EXTENSION_OPTIONS = ["3", "7", "14"];

export default function SubscriptionsPage() {
  const [extensionDays, setExtensionDays] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const { data: subscriptions = [] } = useQuery({
    queryKey: ["sa-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, churches(name)")
        .order("started_at", { ascending: false });

      if (error) {
        throw error;
      }

      return data ?? [];
    },
  });

  const extendTrialMutation = useMutation({
    mutationFn: async ({ churchId, days }: { churchId: string; days: number }) => {
      if (days <= 0) {
        throw new Error("Days must be greater than zero.");
      }

      const { error } = await supabase.rpc("extend_trial", {
        _church_id: churchId,
        _days: days,
      });

      if (error) {
        throw error;
      }
    },
    onSuccess: async (_, variables) => {
      toast.success(`Trial extended by ${variables.days} day(s).`);
      await queryClient.invalidateQueries({ queryKey: ["sa-subscriptions"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Unable to extend trial.");
    },
  });

  const activeSubs = subscriptions.filter((subscription: any) => subscription.status === "active").length;
  const trialSubs = subscriptions.filter((subscription: any) => subscription.status === "trial").length;

  const statusColor = (status: string) => {
    if (status === "active") return "bg-success/20 text-success border-success/30";
    if (status === "trial") return "bg-primary/20 text-primary border-primary/30";
    if (status === "expired") return "bg-destructive/20 text-destructive border-destructive/30";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold font-serif">Subscriptions</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="Total Subscriptions" value={subscriptions.length} icon={CreditCard} />
        <StatCard title="Active" value={activeSubs} icon={TrendingUp} />
        <StatCard title="Trials" value={trialSubs} icon={Clock} />
        <StatCard title="Plan Catalog" value={BILLING_PLANS.length} icon={Users} />
      </div>

      <Tabs defaultValue="subscriptions">
        <TabsList className="bg-secondary">
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="plans">Plan Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions" className="mt-4">
          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Church</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Extend Trial</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                        No subscriptions yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    subscriptions.map((subscription: any) => {
                      const selectedDays = extensionDays[subscription.church_id] ?? "7";
                      const isExtending =
                        extendTrialMutation.isPending &&
                        extendTrialMutation.variables?.churchId === subscription.church_id;

                      return (
                        <TableRow key={subscription.id} className="border-border">
                          <TableCell className="font-medium">
                            {subscription.churches?.name || subscription.church_id?.slice(0, 8) || "-"}
                          </TableCell>
                          <TableCell>{getPlanDefinition(subscription.plan).name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusColor(subscription.status)}>
                              {subscription.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {subscription.started_at ? new Date(subscription.started_at).toLocaleDateString() : "-"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {subscription.expires_at ? new Date(subscription.expires_at).toLocaleDateString() : "No expiry"}
                          </TableCell>
                          <TableCell>
                            <div className="flex min-w-[200px] items-center gap-2">
                              <Select
                                value={selectedDays}
                                onValueChange={(value) =>
                                  setExtensionDays((current) => ({
                                    ...current,
                                    [subscription.church_id]: value,
                                  }))
                                }
                              >
                                <SelectTrigger className="h-8 w-24">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {EXTENSION_OPTIONS.map((option) => (
                                    <SelectItem key={option} value={option}>
                                      {option} days
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  extendTrialMutation.mutate({
                                    churchId: subscription.church_id,
                                    days: Number(selectedDays),
                                  })
                                }
                                disabled={isExtending}
                              >
                                {isExtending ? "Extending..." : "Extend Trial"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {BILLING_PLANS.map((plan) => (
              <Card key={plan.id} className="glass-card hover:gold-glow transition-shadow">
                <CardContent className="p-6">
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  <p className="mt-2 text-2xl font-bold text-primary">
                    {formatTZS(plan.price)}
                    <span className="text-sm font-normal text-muted-foreground">/month</span>
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
