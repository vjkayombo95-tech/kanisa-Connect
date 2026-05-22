import { useOutletContext } from "react-router-dom";
import { AppLink } from "@/components/AppLink";
import { CommunityOutletContext } from "@/components/community-leader/CommunityLeaderLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, HandCoins, TrendingUp, Plus, Eye, Shield, Target } from "lucide-react";
import {
  getCommunityContributionDate,
  useCommunityContributionSummary,
  useCommunityMemberCount,
  useCommunityPledgeSummary,
  useRecentCommunityContributions,
} from "@/hooks/use-community-leader";
import { formatTZS } from "@/lib/currency";
import { format, startOfMonth, isAfter } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function CommunityDashboard() {
  const { communityId, community, leadershipRole } = useOutletContext<CommunityOutletContext>();

  const { data: memberCount = 0 } = useCommunityMemberCount(communityId);
  const { data: contributionSummary = [] } = useCommunityContributionSummary(communityId);
  const { data: recentContributions = [] } = useRecentCommunityContributions(communityId, 5);
  const { data: totalPledged = 0 } = useCommunityPledgeSummary(communityId);

  const monthStart = startOfMonth(new Date());
  const totalContributions = contributionSummary.reduce((sum, contribution) => sum + contribution.amount, 0);
  const monthContributions = contributionSummary
    .filter((c) => {
      return c.date ? isAfter(new Date(c.date), monthStart) : false;
    })
    .reduce((sum, contribution) => sum + contribution.amount, 0);
  const base = `/community/${communityId}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif">{community?.name || "Community"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Community Dashboard &middot;{" "}
            <Badge variant="outline" className="text-xs border-primary/30 text-primary">
              {leadershipRole}
            </Badge>
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{memberCount}</p>
                <p className="text-xs text-muted-foreground">Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <HandCoins className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatTZS(totalContributions)}</p>
                <p className="text-xs text-muted-foreground">Total Contributions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatTZS(monthContributions)}</p>
                <p className="text-xs text-muted-foreground">This Month</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatTZS(totalPledged)}</p>
                <p className="text-xs text-muted-foreground">Total Pledged</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="sm"><AppLink to={`${base}/members`}><Plus className="h-4 w-4 mr-1.5" />Add Member</AppLink></Button>
            <Button asChild size="sm" variant="outline"><AppLink to={`${base}/contributions`}><HandCoins className="h-4 w-4 mr-1.5" />Record Contribution</AppLink></Button>
            <Button asChild size="sm" variant="outline"><AppLink to={`${base}/pledges`}><Target className="h-4 w-4 mr-1.5" />Pledges</AppLink></Button>
            <Button asChild size="sm" variant="outline"><AppLink to={`${base}/members`}><Eye className="h-4 w-4 mr-1.5" />View Members</AppLink></Button>
            <Button asChild size="sm" variant="outline"><AppLink to={`${base}/reports`}><TrendingUp className="h-4 w-4 mr-1.5" />Reports</AppLink></Button>
            <Button asChild size="sm" variant="outline"><AppLink to={`${base}/leadership`}><Shield className="h-4 w-4 mr-1.5" />Leadership</AppLink></Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Contributions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Contributions</CardTitle>
          <Button asChild variant="ghost" size="sm"><AppLink to={`${base}/contributions`}>View All</AppLink></Button>
        </CardHeader>
        <CardContent>
          {recentContributions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No contributions recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentContributions.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{(c.members as any)?.full_name || c.donor_name || "—"}</TableCell>
                    <TableCell>{(c.contribution_categories as any)?.name || "—"}</TableCell>
                    <TableCell>{getCommunityContributionDate(c) ? format(new Date(getCommunityContributionDate(c)), "dd MMM yyyy") : "—"}</TableCell>
                    <TableCell className="text-right font-medium">{formatTZS(Number(c.amount))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
