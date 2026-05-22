import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpCircle, CheckCircle2, XCircle } from "lucide-react";
import { formatTZS } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { COMMUNITY_HELP_SELECT, enrichCommunityHelpRequests, type CommunityHelpRequestWithMember } from "@/lib/member-linked-requests";

export default function CommunityHelpPage() {
  const { churchId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("pending");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["community-help", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from("community_help_requests")
        .select(COMMUNITY_HELP_SELECT)
        .eq("church_id", churchId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return enrichCommunityHelpRequests((data ?? []) as any[]);
    },
    enabled: !!churchId,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { data, error } = await supabase
        .from("community_help_requests")
        .update({ status })
        .eq("id", id)
        .select("id, status");

      if (error) throw error;
      if (!data?.length) throw new Error("Help request update was blocked or the row was not found.");
      if (data.length > 1) throw new Error("Help request update returned multiple rows unexpectedly.");
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["community-help"] });
      queryClient.invalidateQueries({ queryKey: ["portal-community-help-approved"] });
      queryClient.invalidateQueries({ queryKey: ["my-help-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-help-requests-dashboard"] });
      toast({ title: `Request ${status}` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const statusColor = (status: string) => {
    if (status === "approved") return "bg-success/20 text-success border-success/30";
    if (status === "pending") return "bg-primary/20 text-primary border-primary/30";
    return "bg-destructive/10 text-destructive border-destructive/20";
  };

  const pending = requests.filter((request) => request.status === "pending");
  const reviewed = requests.filter((request) => request.status === "approved" || request.status === "rejected");

  const RequestCard = ({ request, showActions }: { request: CommunityHelpRequestWithMember; showActions?: boolean }) => {
    const progress = request.target_amount ? Math.min(100, (((request.current_amount || 0) / request.target_amount) * 100)) : 0;
    return (
      <Card className="glass-card hover:gold-glow transition-shadow">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium">{request.member_name}</p>
              <p className="text-xs text-primary">{request.category}</p>
            </div>
            <Badge variant="outline" className={statusColor(request.status)}>{request.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{request.description}</p>
          {request.target_amount && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatTZS(request.current_amount || 0)} raised</span>
                <span>{formatTZS(request.target_amount)} goal</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
          <p className="text-xs text-muted-foreground/60">{new Date(request.created_at).toLocaleDateString()}</p>
          {showActions && request.status === "pending" && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" className="flex-1" onClick={() => updateStatus.mutate({ id: request.id, status: "approved" })} disabled={updateStatus.isPending}>
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve
              </Button>
              <Button size="sm" variant="destructive" className="flex-1" onClick={() => updateStatus.mutate({ id: request.id, status: "rejected" })} disabled={updateStatus.isPending}>
                <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-serif">Community Help</h1>
        <p className="text-sm text-muted-foreground mt-1">Review and manage help requests from members.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-secondary">
          <TabsTrigger value="pending">
            Pending Review {pending.length > 0 && <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-xs">{pending.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="reviewed">Reviewed ({reviewed.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {isLoading ? <p className="text-muted-foreground">Loading...</p> : pending.length === 0 ? (
            <Card className="glass-card"><CardContent className="py-16 text-center text-muted-foreground">
              <HelpCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <p>No pending requests to review.</p>
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {pending.map((request) => <RequestCard key={request.id} request={request} showActions />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reviewed" className="mt-4">
          {reviewed.length === 0 ? (
            <Card className="glass-card"><CardContent className="py-16 text-center text-muted-foreground">
              <HelpCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <p>No reviewed requests.</p>
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {reviewed.map((request) => <RequestCard key={request.id} request={request} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
