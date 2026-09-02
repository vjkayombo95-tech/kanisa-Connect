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

function createSubmissionKey() {
  return crypto.randomUUID();
}

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
  const [idempotencyKey, setIdempotencyKey] = useState(createSubmissionKey);
  const [submitted, setSubmitted] = useState(false);
  const { churchId, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const presetAmounts = [5000, 10000, 20000, 50000, 100000];

  const { data: member } = useMemberRecord();

  // Auto-fill phone from member record
  useEffect(() => {
    if (member?.phone && !phone) setPhone(member.phone);
  }, [member?.phone, phone]);

  useEffect(() => {
    setIdempotencyKey(createSubmissionKey());
  }, [amount, phone, paymentRef, categoryId]);

  const { data: categories = [] } = useQuery({
    queryKey: ["portal-categories", churchId],
    queryFn: async () => {
      if (!churchId) return [];

      const { data } = await supabase
        .from("contribution_categories")
        .select("*")
        .eq("church_id", churchId)
        .order("name");
      return data ?? [];
    },
    enabled: !!churchId,
  });

  const give = useMutation({
    mutationFn: async () => {
      if (!churchId) throw new Error("No church context");
      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Enter a valid amount");
      }

      const { data, error } = await supabase.rpc("record_contribution_with_key" as never, {
        p_church_id: churchId,
        p_amount: parsedAmount,
        p_idempotency_key: idempotencyKey,
        p_member_id: member?.id || null,
        p_donor_name: member?.full_name || user?.email || "Member",
        p_phone: phone || null,
        p_payment_reference: paymentRef || null,
        p_category_id: categoryId || null,
        p_notes: null,
      } as never);

      if (error) throw error;
      const result = data as { success?: boolean; error?: string } | null;
      if (!result?.success) {
        throw new Error(result?.error || "Contribution was not recorded.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contributions"] });
      queryClient.invalidateQueries({ queryKey: ["my-contributions-all"] });
      queryClient.invalidateQueries({ queryKey: ["simple-member-home"] });
      queryClient.invalidateQueries({ queryKey: ["my-member-record"] });
      queryClient.invalidateQueries({ queryKey: ["portal-dashboard-church"] });
      setSubmitted(true);
      toast({ title: "Mchango umerekodiwa", description: `Tumerekodi mchango wako wa ${formatTZS(parseFloat(amount))}.` });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (submitted) {
    return (
      <div className="container mx-auto px-4 pb-28 pt-6 animate-fade-in lg:px-8 lg:py-10">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl bg-card p-6 text-center shadow-sm ring-1 ring-border/60 sm:p-10">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-success/10">
              <CheckCircle2 className="h-9 w-9 text-success" />
            </div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Michango</p>
            <h2 className="mt-2 text-2xl font-bold font-serif text-foreground sm:text-3xl">Mchango umerekodiwa</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground sm:text-base">
              Tumerekodi mchango wako wa {formatTZS(parseFloat(amount || "0"))}. Taarifa hii itaonekana kwenye historia yako baada ya kusawazishwa.
            </p>
            <Button className="mt-7 min-h-12 px-6" onClick={() => { setSubmitted(false); setAmount(""); setPhone(member?.phone || ""); setPaymentRef(""); setCategoryId(""); setIdempotencyKey(createSubmissionKey()); }}>
              Rekodi Mchango Mwingine
          </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pb-28 pt-6 animate-fade-in lg:px-8 lg:py-10">
      <div className="mx-auto max-w-5xl min-w-0">
        <div className="mb-7 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Heart className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Kanisa Connect</p>
            <h1 className="mt-1 text-3xl font-bold font-serif tracking-normal text-foreground sm:text-4xl">Michango</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">Rekodi mchango wako kwa parokia.</p>
          </div>
          <div className="w-fit max-w-full rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            Taarifa ya kumbukumbu
          </div>
        </div>

        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <Card className="min-w-0 rounded-2xl border-border/70 shadow-sm">
            <CardContent className="min-w-0 space-y-7 p-5 sm:p-7">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-sm font-semibold">Kiasi cha mchango</Label>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">TZS</span>
                </div>
                <Input type="number" placeholder="Weka kiasi" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-16 w-full min-w-0 text-2xl font-bold sm:text-3xl" />
                <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-5">
                  {presetAmounts.map((a) => (
                    <Button key={a} variant={amount === String(a) ? "default" : "outline"} size="sm" className="min-h-11 min-w-0 whitespace-normal px-2 text-xs leading-tight sm:text-sm" onClick={() => setAmount(String(a))}>
                      {formatTZS(a)}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>Aina ya mchango</Label>
                  <span className="text-xs font-medium text-muted-foreground">Si lazima</span>
                </div>
                <ContributionCategorySelector categories={categories} value={categoryId} onValueChange={setCategoryId} placeholderKey="Chagua aina ya mchango" />
              </div>

              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <div className="min-w-0 space-y-2">
                  <Label>Namba ya simu</Label>
                  <Input className="min-h-12 w-full min-w-0" placeholder="+255..." value={phone} onChange={(e) => setPhone(e.target.value)} />
                  <p className="text-xs leading-5 text-muted-foreground">Unaweza kutumia namba iliyohifadhiwa kwenye akaunti yako.</p>
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>Kumbukumbu ya malipo</Label>
                  <Input className="min-h-12 w-full min-w-0" placeholder="Mfano: M-Pesa au benki" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} />
                  <p className="text-xs leading-5 text-muted-foreground">Kama tayari umelipa kupitia M-Pesa, benki au njia nyingine, weka namba ya kumbukumbu hapa.</p>
                </div>
              </div>

              <Button className="min-h-12 w-full text-base font-semibold" size="lg" disabled={give.isPending || !amount} onClick={() => give.mutate()}>
                {give.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <HandCoins className="mr-2 h-5 w-5" />}
                {give.isPending ? "Inarekodi..." : amount ? `Rekodi ${formatTZS(Number(amount))}` : "Rekodi Mchango"}
              </Button>
            </CardContent>
          </Card>

          <aside className="min-w-0 space-y-4">
            {member && (
              <div className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border/60">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{member.full_name}</p>
                    <p className="text-xs text-muted-foreground">Unarekodi kama mwanachama aliyesajiliwa</p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl bg-muted/50 p-5">
              <h2 className="text-sm font-semibold text-foreground">Baada ya kutuma</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Kanisa Connect itahifadhi taarifa ya mchango wako kwa ajili ya kumbukumbu za parokia. Hii si uthibitisho wa malipo ya kielektroniki.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
