import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { HandCoins, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { CommunityOutletContext } from "@/components/community-leader/CommunityLeaderLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatTZS } from "@/lib/currency";
import {
  getCommunityContributionDate,
  useCommunityContributionRecords,
  useCommunityMembers,
} from "@/hooks/use-community-leader";

export default function CommunityContributionsPage() {
  const { communityId, community, churchId } = useOutletContext<CommunityOutletContext>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [visibleCount, setVisibleCount] = useState(50);

  const { data: members = [] } = useCommunityMembers(communityId, open);
  const { data: contributions = [], isLoading } = useCommunityContributionRecords(communityId, visibleCount);

  const { data: categories = [] } = useQuery({
    queryKey: ["contribution-categories", churchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contribution_categories")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!churchId && open,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((communityMember: any) => {
      const name = (communityMember.members as any)?.full_name;
      if (communityMember.member_id && name) {
        map.set(communityMember.member_id, name);
      }
    });
    return map;
  }, [members]);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((category: any) => {
      if (category.id && category.name) {
        map.set(category.id, category.name);
      }
    });
    return map;
  }, [categories]);

  const record = useMutation({
    mutationFn: async () => {
      const memberName = memberNameById.get(memberId) || "";

      const { error } = await supabase.from("contributions").insert({
        church_id: churchId,
        community_id: communityId,
        member_id: memberId || null,
        category_id: categoryId || null,
        amount: parseFloat(amount),
        date,
        notes: notes.trim() || null,
        donor_name: memberName || null,
        created_by: user?.id || null,
        currency: "TZS",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-contribution-records", communityId] });
      queryClient.invalidateQueries({ queryKey: ["community-contribution-records", communityId, visibleCount] });
      queryClient.invalidateQueries({ queryKey: ["community-contribution-summary", communityId] });
      queryClient.invalidateQueries({ queryKey: ["recent-community-contributions", communityId, 5] });
      toast.success("Contribution recorded successfully");
      setOpen(false);
      setMemberId("");
      setCategoryId("");
      setAmount("");
      setNotes("");
      setDate(format(new Date(), "yyyy-MM-dd"));
    },
    onError: (error: any) => toast.error(error.message),
  });

  const totalAmount = contributions.reduce((sum, contribution: any) => sum + Number(contribution.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif">Contributions</h1>
          <p className="text-sm text-muted-foreground">
            {community?.name} · {formatTZS(totalAmount)} total
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Record Contribution
            </Button>
          </DialogTrigger>
            <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Record Contribution</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Member</Label>
                <Select value={memberId} onValueChange={setMemberId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((communityMember: any) => (
                      <SelectItem key={communityMember.member_id} value={communityMember.member_id}>
                        {memberNameById.get(communityMember.member_id) || "-"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category: any) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount (TZS)</Label>
                  <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={() => record.mutate()}
                disabled={!memberId || !amount || parseFloat(amount) <= 0 || record.isPending}
              >
                {record.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Save Contribution
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : contributions.length === 0 ? (
            <div className="text-center py-12">
              <HandCoins className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No contributions recorded yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contributions.map((contribution: any) => (
                  <TableRow key={contribution.id}>
                    <TableCell className="font-medium">
                      {memberNameById.get(contribution.member_id) || contribution.donor_name || "-"}
                    </TableCell>
                    <TableCell>{categoryNameById.get(contribution.category_id) || "-"}</TableCell>
                    <TableCell>
                      {getCommunityContributionDate(contribution)
                        ? format(new Date(getCommunityContributionDate(contribution)), "dd MMM yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {contribution.notes || "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatTZS(Number(contribution.amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {!isLoading && contributions.length === visibleCount && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={() => setVisibleCount((current) => current + 50)}>
                Load More
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
