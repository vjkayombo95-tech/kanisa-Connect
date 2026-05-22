import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/church-admin/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, HandCoins, CreditCard, TrendingUp, Activity, Clock } from "lucide-react";
import { formatTZS } from "@/lib/currency";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function PlatformDashboard() {
  const { data: churchCount } = useQuery({
    queryKey: ["sa-churches-count"],
    queryFn: async () => {
      const { count } = await supabase.from("churches").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: memberCount } = useQuery({
    queryKey: ["sa-members-count"],
    queryFn: async () => {
      const { count } = await supabase.from("members").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: contributionsTotal } = useQuery({
    queryKey: ["sa-contributions-total"],
    queryFn: async () => {
      const { data } = await supabase.from("contributions").select("amount");
      return data?.reduce((s: number, c: any) => s + (c.amount || 0), 0) ?? 0;
    },
  });

  const { data: subCount } = useQuery({
    queryKey: ["sa-subscriptions-count"],
    queryFn: async () => {
      const { count } = await supabase.from("church_subscriptions").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: recentChurches = [] } = useQuery({
    queryKey: ["sa-recent-churches"],
    queryFn: async () => {
      const { data } = await supabase.from("churches").select("*").order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  const { data: recentLogs = [] } = useQuery({
    queryKey: ["sa-recent-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(6);
      return data ?? [];
    },
  });

  // Real revenue chart from contributions
  const { data: revenueData = [] } = useQuery({
    queryKey: ["sa-revenue-chart"],
    queryFn: async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const { data } = await supabase.from("contributions").select("amount, created_at").gte("created_at", sixMonthsAgo.toISOString());
      if (!data || data.length === 0) return [];
      const months: Record<string, number> = {};
      data.forEach((c: any) => {
        const d = new Date(c.created_at);
        const key = d.toLocaleDateString("en-US", { month: "short" });
        months[key] = (months[key] || 0) + (c.amount || 0);
      });
      return Object.entries(months).map(([month, revenue]) => ({ month, revenue }));
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-serif">Platform Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of the Kanisa Connect platform</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Churches" value={churchCount ?? 0} icon={Building2} />
        <StatCard title="Total Members" value={memberCount ?? 0} icon={Users} />
        <StatCard title="Total Contributions" value={formatTZS(contributionsTotal ?? 0)} icon={HandCoins} />
        <StatCard title="Subscriptions" value={subCount ?? 0} icon={CreditCard} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="glass-card lg:col-span-2">
          <CardHeader><CardTitle className="text-base font-sans flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Monthly Revenue</CardTitle></CardHeader>
          <CardContent>
            {revenueData.length === 0 ? (
              <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">No revenue data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="goldGradSA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(40, 92%, 56%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(40, 92%, 56%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" stroke="hsl(220, 10%, 50%)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(220, 10%, 50%)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                  <Tooltip contentStyle={{ background: "hsl(224, 18%, 10%)", border: "1px solid hsl(224, 15%, 14%)", borderRadius: "8px", color: "hsl(45, 10%, 93%)" }} formatter={(v: number) => [formatTZS(v), "Revenue"]} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(40, 92%, 56%)" fill="url(#goldGradSA)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base font-sans flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Recent Activity</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {recentLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No recent activity.</p>
            ) : recentLogs.map((l: any) => (
              <div key={l.id} className="flex gap-3 items-start">
                <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{l.action}</p>
                  <p className="text-xs text-muted-foreground">{l.detail || l.entity_type}</p>
                  <p className="text-xs text-muted-foreground/60">{new Date(l.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base font-sans flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Recent Church Registrations</CardTitle></CardHeader>
        <CardContent>
          {recentChurches.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No churches registered yet.</p>
          ) : (
            <div className="space-y-3">
              {recentChurches.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.code} • {c.email}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
