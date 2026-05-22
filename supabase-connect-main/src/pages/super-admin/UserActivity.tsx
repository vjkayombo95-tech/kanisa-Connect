import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/church-admin/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Users, Building2, HandCoins } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const mockActivityTrend = [
  { day: "Mon", actions: 45 }, { day: "Tue", actions: 62 },
  { day: "Wed", actions: 38 }, { day: "Thu", actions: 71 },
  { day: "Fri", actions: 55 }, { day: "Sat", actions: 28 },
  { day: "Sun", actions: 89 },
];

export default function UserActivityPage() {
  const { data: memberCount } = useQuery({
    queryKey: ["sa-ua-members"],
    queryFn: async () => {
      const { count } = await supabase.from("members").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: churchCount } = useQuery({
    queryKey: ["sa-ua-churches"],
    queryFn: async () => {
      const { count } = await supabase.from("churches").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: txCount } = useQuery({
    queryKey: ["sa-ua-contributions"],
    queryFn: async () => {
      const { count } = await supabase.from("contributions").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-serif">User Activity</h1>
        <p className="text-sm text-muted-foreground mt-1">Platform-wide user engagement metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Transactions" value={txCount ?? 0} icon={HandCoins} />
        <StatCard title="Total Members" value={memberCount ?? 0} icon={Users} />
        <StatCard title="Active Churches" value={churchCount ?? 0} icon={Building2} />
      </div>

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base font-sans flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Activity Trends (This Week)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={mockActivityTrend}>
              <XAxis dataKey="day" stroke="hsl(220, 10%, 50%)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(220, 10%, 50%)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "hsl(224, 18%, 10%)", border: "1px solid hsl(224, 15%, 14%)", borderRadius: "8px", color: "hsl(45, 10%, 93%)" }} />
              <Bar dataKey="actions" fill="hsl(40, 92%, 56%)" radius={[4, 4, 0, 0]} name="Actions" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
