import { useQuery } from "@tanstack/react-query";
import { Church, Copy, Link2, Loader2, MessageCircle, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { buildMemberJoinUrl, buildMemberJoinWhatsAppMessage } from "@/lib/invite-flow";
import { openWhatsAppShare } from "@/lib/whatsapp-share";

export default function InviteMembersPage() {
  const { churchId } = useAuth();
  const { toast } = useToast();

  const { data: church, isLoading, isError } = useQuery({
    queryKey: ["church-member-invite", churchId],
    queryFn: async () => {
      if (!churchId) return null;

      const { data, error } = await supabase
        .from("churches")
        .select("name, slug")
        .eq("id", churchId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!churchId,
  });

  const joinLink = buildMemberJoinUrl(church?.slug) ?? "";

  const copyJoinLink = async () => {
    if (!joinLink) return;

    try {
      await navigator.clipboard.writeText(joinLink);
      toast({
        title: "Kiungo kimenakiliwa",
        description: "Sasa unaweza kukituma kwa wanachama.",
      });
    } catch {
      toast({
        title: "Imeshindikana kunakili kiungo",
        description: "Chagua kiungo na ukinakili mwenyewe.",
        variant: "destructive",
      });
    }
  };

  const shareOnWhatsApp = () => {
    if (!joinLink) return;

    openWhatsAppShare(buildMemberJoinWhatsAppMessage({ churchName: church?.name, joinUrl: joinLink }));
  };

  if (!churchId) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="rounded-3xl">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Kanisa halijapatikana kwenye akaunti hii. Chagua kanisa kisha ujaribu tena.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          Usajili wa Wanachama
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">Alika Wanachama</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Tuma kiungo au QR code ya kanisa lako. Mwanachama ataingia au kujisajili kabla ya
          kuunganishwa na kanisa.
        </p>
      </div>

      {isLoading ? (
        <Card className="rounded-3xl">
          <CardContent className="flex min-h-48 items-center justify-center p-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </CardContent>
        </Card>
      ) : isError ? (
        <Card className="rounded-3xl border-destructive/30">
          <CardContent className="p-6 text-sm text-destructive">
            Imeshindikana kupata taarifa za kanisa. Jaribu tena.
          </CardContent>
        </Card>
      ) : !joinLink ? (
        <Card className="rounded-3xl">
          <CardContent className="flex items-start gap-3 p-6">
            <Church className="mt-0.5 h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">
              Kiungo cha kujiunga hakipatikani kwa kanisa hili kwa sasa.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Card className="rounded-3xl">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-start gap-3">
                <Link2 className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <h2 className="font-semibold text-foreground">{church?.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Tumia kiungo hiki kuwaalika wanachama.
                  </p>
                </div>
              </div>

              <Input value={joinLink} readOnly aria-label="Kiungo cha kujiunga na kanisa" />

              <div className="grid gap-3 sm:grid-cols-2">
                <Button onClick={copyJoinLink}>
                  <Copy className="mr-2 h-4 w-4" />
                  Nakili Kiungo
                </Button>
                <Button variant="outline" onClick={shareOnWhatsApp}>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Tuma WhatsApp
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl">
            <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-6">
              <div className="rounded-2xl bg-white p-3">
                <QRCodeSVG
                  value={joinLink}
                  size={200}
                  level="H"
                  marginSize={2}
                  title={`${church?.name || "Kanisa"} - kiungo cha kujiunga`}
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <QrCode className="h-4 w-4" />
                Scan ili kujiunga
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
