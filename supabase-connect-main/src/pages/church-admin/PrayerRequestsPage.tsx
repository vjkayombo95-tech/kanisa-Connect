import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Star } from "lucide-react";
import { formatTZS } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { PRAYER_REQUEST_SELECT, mapPrayerRequestRecord, type PrayerRequestWithMember } from "@/lib/prayer-requests";

export default function PrayerRequestsPage() {
  const { churchId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["prayer-requests", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from("prayer_requests")
        .select(PRAYER_REQUEST_SELECT)
        .eq("church_id", churchId)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []).map((row: any) => mapPrayerRequestRecord(row as PrayerRequestWithMember));
    },
    enabled: !!churchId,
  });

  const rejectRequest = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("prayer_requests")
        .update({ status: "rejected" })
        .eq("id", id)
        .select("id, status");

      if (error) throw error;
      if (!data?.length) throw new Error("Prayer request update was blocked or the row was not found.");
      if (data.length > 1) throw new Error("Prayer request update returned multiple rows unexpectedly.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prayer-requests"] });
      queryClient.invalidateQueries({ queryKey: ["portal-prayer-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-prayer-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-prayers"] });
      toast({ title: "Prayer request rejected" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const approveRequest = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("prayer_requests")
        .update({ status: "approved" })
        .eq("id", id)
        .select("id, status");

      if (error) throw error;
      if (!data?.length) throw new Error("Prayer request update was blocked or the row was not found.");
      if (data.length > 1) throw new Error("Prayer request update returned multiple rows unexpectedly.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prayer-requests"] });
      queryClient.invalidateQueries({ queryKey: ["portal-prayer-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-prayer-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-prayers"] });
      toast({ title: "Marked as approved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const pendingRequests = requests
    .filter((request) => request.status === "pending")
    .sort((a, b) => {
      const aOff = Number(a.offering_amount) || 0;
      const bOff = Number(b.offering_amount) || 0;
      if (aOff !== bOff) return bOff - aOff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const reviewedRequests = requests.filter((request) => request.status === "approved" || request.status === "rejected");

  const statusColor = (status: string) => {
    if (status === "approved") return "bg-success/20 text-success border-success/30";
    if (status === "pending") return "bg-primary/20 text-primary border-primary/30";
    return "bg-destructive/10 text-destructive border-destructive/20";
  };

  const renderList = (items: PrayerRequestWithMember[]) =>
    items.length === 0 ? (
      <Card className="glass-card">
        <CardContent className="py-12 text-center text-muted-foreground">
          <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          No prayer requests in this category.
        </CardContent>
      </Card>
    ) : (
      <div className="space-y-3">
        {items.map((request) => (
          <Card key={request.id} className="glass-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{request.member_name}</p>
                    <Badge variant="outline" className={statusColor(request.status)}>
                      {request.status}
                    </Badge>
                    {Number(request.offering_amount) > 0 && (
                      <Badge variant="outline" className="border-primary/20 bg-primary/10 text-xs text-primary">
                        <Star className="mr-1 h-3 w-3" />
                        Priority - {formatTZS(request.offering_amount)}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{request.request_text}</p>
                  <p className="mt-2 text-xs text-muted-foreground/60">
                    {new Date(request.created_at).toLocaleDateString()}
                  </p>
                </div>

                {request.status === "pending" && (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => approveRequest.mutate(request.id)}
                      disabled={approveRequest.isPending}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => rejectRequest.mutate(request.id)}
                      disabled={rejectRequest.isPending}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-serif text-2xl font-bold">Prayer Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View and manage prayer requests. Paid requests appear first with higher priority.
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <Tabs defaultValue="pending">
          <TabsList className="bg-secondary">
            <TabsTrigger value="pending">Pending ({pendingRequests.length})</TabsTrigger>
            <TabsTrigger value="reviewed">Reviewed ({reviewedRequests.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="mt-4">
            {renderList(pendingRequests)}
          </TabsContent>
          <TabsContent value="reviewed" className="mt-4">
            {renderList(reviewedRequests)}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
