import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ContributionCategorySelector } from "@/components/ui/ContributionCategorySelector";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HandCoins, Heart, Loader2, CheckCircle2, User } from "lucide-react";
import { formatTZS } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

function useMemberRecord() {
  const { user, churchId } = useAuth();
  return useQuery({
    queryKey: ["my-member-record", user?.id, user?.email, churchId],
    queryFn: async () => {
      if (!user || !churchId) return null;

      const { data: linkedMember, error: linkedMemberError } = await supabase
        .from("members")
        .select("id, full_name, phone, email")
        .eq("user_id", user.id)
        .eq("church_id", churchId)
        .maybeSingle();

      if (linkedMemberError) throw linkedMemberError;
      if (linkedMember) return linkedMember;

      const normalizedEmail = user.email?.trim().toLowerCase();
      if (!normalizedEmail) return null;

      const { data: emailMember, error: emailMemberError } = await supabase
        .from("members")
        .select("id, full_name, phone, email")
        .ilike("email", normalizedEmail)
        .eq("church_id", churchId)
        .maybeSingle();

      if (emailMemberError) throw emailMemberError;
      return emailMember;
    },
    enabled: !!user && !!churchId,
  });
}

export default function PortalGive() {
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { churchId, user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const presetAmounts = [5000, 10000, 20000, 50000, 100000];

  const { data: member } = useMemberRecord();

  // Auto-fill phone from member record
  useEffect(() => {
    if (member?.phone && !phone) setPhone(member.phone);
  }, [member]);

  const { data: categories = [] } = useQuery({
    queryKey: ["portal-categories", churchId],
    queryFn: async () => {
      const { data } = await supabase.from("contribution_categories").select("*").order("name");
      return data ?? [];
    },
    enabled: true,
  });

  const give = useMutation({
    mutationFn: async () => {
      if (!churchId) throw new Error("No church context");
      const { error } = await supabase.from("contributions").insert({
        church_id: churchId,
        amount: parseFloat(amount),
        donor_name: member?.full_name || "Member",
        member_id: member?.id || null,
        phone: phone || null,
        payment_reference: paymentRef || null,
        category_id: categoryId || null,
        created_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contributions"] });
      queryClient.invalidateQueries({ queryKey: ["my-contributions-all"] });
      queryClient.invalidateQueries({ queryKey: ["member-dashboard-simple"] });
      queryClient.invalidateQueries({ queryKey: ["my-member-record"] });
      queryClient.invalidateQueries({ queryKey: ["portal-dashboard-church"] });
      setSubmitted(true);
      toast({ title: "Thank you!", description: `Your gift of ${formatTZS(parseFloat(amount))} has been recorded.` });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (submitted) {
    return (
      <div className="container mx-auto px-4 py-10 animate-fade-in">
        <div className="max-w-xl mx-auto text-center">
          <CheckCircle2 className="h-16 w-16 text-success mx-auto mb-4" />
          <h2 className="text-2xl font-bold font-serif mb-2">Thank You for Your Gift!</h2>
          <p className="text-muted-foreground mb-6">Your contribution of {formatTZS(parseFloat(amount || "0"))} has been recorded successfully.</p>
          <Button onClick={() => { setSubmitted(false); setAmount(""); setPhone(member?.phone || ""); setPaymentRef(""); setCategoryId(""); }}>
            Give Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 animate-fade-in">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <div className="h-14 w-14 rounded-xl gradient-gold flex items-center justify-center mx-auto mb-4">
            <Heart className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold font-serif">Give to Your Church</h1>
          <p className="text-muted-foreground mt-2">Your generosity makes a difference.</p>
        </div>

        <Card className="glass-card gold-glow">
          <CardContent className="p-6 space-y-6">
            {/* Member identity - read only */}
            {member && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <User className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium">{member.full_name}</p>
                  <p className="text-xs text-muted-foreground">Giving as registered member</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>{t("contributions.category")} *</Label>
              <ContributionCategorySelector categories={categories} value={categoryId} onValueChange={setCategoryId} />
            </div>

            <div className="space-y-2">
              <Label>Amount (TZS) *</Label>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {presetAmounts.map((a) => (
                  <Button key={a} variant={amount === String(a) ? "default" : "outline"} size="sm" className="text-xs" onClick={() => setAmount(String(a))}>
                    {formatTZS(a)}
                  </Button>
                ))}
              </div>
              <Input type="number" placeholder="Enter custom amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-lg font-semibold" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Phone</Label><Input placeholder="+255..." value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              <div className="space-y-2"><Label>Payment Reference</Label><Input placeholder="M-Pesa ref, receipt #" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} /></div>
            </div>

            <Button className="w-full" size="lg" disabled={give.isPending || !amount} onClick={() => give.mutate()}>
              {give.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <HandCoins className="mr-2 h-5 w-5" />}
              {amount ? `Give ${formatTZS(Number(amount))}` : "Give"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
