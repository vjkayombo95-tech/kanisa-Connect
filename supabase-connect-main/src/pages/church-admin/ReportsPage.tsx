import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { FileText, HandCoins, Building2 } from "lucide-react";
import { StatCard } from "@/components/church-admin/StatCard";
import { formatTZS } from "@/lib/currency";

function getDateRange(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const nextDay = new Date(endDate);
  nextDay.setDate(nextDay.getDate() + 1);

  return {
    startIso: start.toISOString(),
    endExclusiveIso: nextDay.toISOString(),
  };
}

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);

  const range = useMemo(() => getDateRange(dateFrom, dateTo), [dateFrom, dateTo]);

  const { data: contributions = [], isLoading } = useQuery({
    queryKey: ["report-contributions", dateFrom, dateTo],
    queryFn: async () => {
      console.log("START:", dateFrom);
      console.log("END:", dateTo);

      const { data, error } = await supabase
        .from("contributions")
        .select("*, contribution_categories!contributions_category_id_fkey(name), members!contributions_member_id_fkey(full_name)")
        .gte("created_at", range.startIso)
        .lt("created_at", range.endExclusiveIso)
        .order("created_at", { ascending: false });

      console.log("DATA:", data);
      console.log("REPORTS ERROR:", error);

      if (error) {
        return [];
      }

      return data ?? [];
    },
  });

  const { data: familyMembers = [] } = useQuery({
    queryKey: ["report-family-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, family_id, families(name)")
        .not("family_id", "is", null);

      if (error) {
        console.error("REPORT FAMILY ERROR:", error);
        return [];
      }

      return data ?? [];
    },
  });

  const total = contributions.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
  const transactionCount = contributions.length;
  const categoryIds = [...new Set(contributions.map((item: any) => item.category_id).filter(Boolean))];

  const byCategory: Record<string, number> = {};
  contributions.forEach((contribution: any) => {
    const categoryName = contribution.contribution_categories?.name || "Uncategorized";
    byCategory[categoryName] = (byCategory[categoryName] || 0) + Number(contribution.amount || 0);
  });

  const byMember: Record<string, { name: string; total: number; count: number }> = {};
  contributions.forEach((contribution: any) => {
    const key = contribution.member_id || "anonymous";
    const name = contribution.members?.full_name || contribution.donor_name || "Anonymous";

    if (!byMember[key]) {
      byMember[key] = { name, total: 0, count: 0 };
    }

    byMember[key].total += Number(contribution.amount || 0);
    byMember[key].count += 1;
  });

  const familyMap: Record<string, string> = {};
  familyMembers.forEach((familyMember: any) => {
    if (familyMember.families?.name) {
      familyMap[familyMember.id] = familyMember.families.name;
    }
  });

  const byFamily: Record<string, number> = {};
  contributions.forEach((contribution: any) => {
    const familyName = familyMap[contribution.member_id] || "No Family";
    byFamily[familyName] = (byFamily[familyName] || 0) + Number(contribution.amount || 0);
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-serif">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Contribution reports and summaries</p>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-auto" />
          <span className="text-muted-foreground">to</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-auto" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total in Period" value={formatTZS(total)} icon={HandCoins} />
        <StatCard title="Transactions" value={transactionCount} icon={FileText} />
        <StatCard title="Categories" value={categoryIds.length} icon={Building2} />
      </div>

      <Tabs defaultValue="category">
        <TabsList className="bg-secondary">
          <TabsTrigger value="category">By Category</TabsTrigger>
          <TabsTrigger value="member">By Member</TabsTrigger>
          <TabsTrigger value="family">By Family</TabsTrigger>
          <TabsTrigger value="detail">All Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="category" className="mt-4">
          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([category, amount]) => (
                    <TableRow key={category}>
                      <TableCell className="font-medium">{category}</TableCell>
                      <TableCell className="text-right text-primary font-medium">{formatTZS(amount)}</TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && contributions.length === 0 && (
                    <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground">No data</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="member" className="mt-4">
          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Transactions</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.values(byMember).sort((a, b) => b.total - a.total).map((member) => (
                    <TableRow key={member.name}>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell>{member.count}</TableCell>
                      <TableCell className="text-right text-primary font-medium">{formatTZS(member.total)}</TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && contributions.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No data</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="family" className="mt-4">
          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Family</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(byFamily).sort((a, b) => b[1] - a[1]).map(([family, amount]) => (
                    <TableRow key={family}>
                      <TableCell className="font-medium">{family}</TableCell>
                      <TableCell className="text-right text-primary font-medium">{formatTZS(amount)}</TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && contributions.length === 0 && (
                    <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground">No data</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detail" className="mt-4">
          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Donor</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contributions.map((contribution: any) => (
                    <TableRow key={contribution.id}>
                      <TableCell className="text-muted-foreground">{new Date(contribution.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{contribution.members?.full_name || contribution.donor_name || "Anonymous"}</TableCell>
                      <TableCell>{contribution.contribution_categories?.name || "—"}</TableCell>
                      <TableCell className="text-right text-primary font-medium">{formatTZS(Number(contribution.amount || 0))}</TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && contributions.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No data</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
