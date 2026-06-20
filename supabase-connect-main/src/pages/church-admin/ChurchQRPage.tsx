import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, QrCode } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { ChurchQRCode } from "@/components/payments/ChurchQRCode";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { buildChurchGivingUrl } from "@/lib/qr-payments";

export default function ChurchQRPage() {
  const { churchId } = useAuth();
  const safeChurchId = churchId ?? "abc123";
  const { data: church } = useQuery({
    queryKey: ["church-giving-qr", churchId],
    queryFn: async () => {
      if (!churchId) return null;
      const { data, error } = await supabase
        .from("churches")
        .select("id, name, slug, logo_url")
        .eq("id", churchId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!churchId,
  });
  const givingLink = buildChurchGivingUrl(safeChurchId, church?.slug);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-primary/80">QR Payments</p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">Church giving QR</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Share this QR code on screens, posters, or printed materials so members can scan and give instantly.
          </p>
        </div>

        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.99 }}>
          <Button asChild className="rounded-xl">
            <Link to="/scan-qr">
              Test scan flow
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </motion.div>
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="overflow-hidden rounded-[28px] border-white/8 bg-card/90 shadow-[0_28px_70px_-42px_rgba(0,0,0,0.8)]">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <QrCode className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">How to use it</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Display this code during services or on printed materials. When scanned, it opens the public payment page with your church already selected.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-background/50 p-4">
              <p className="text-sm font-medium text-foreground">QR giving link</p>
              <pre className="mt-3 overflow-x-auto rounded-xl bg-black/30 p-3 text-xs text-primary/90">{givingLink}</pre>
            </div>
          </CardContent>
        </Card>

        <ChurchQRCode
          churchId={safeChurchId}
          churchName={church?.name ?? undefined}
          churchSlug={church?.slug}
          churchLogo={church?.logo_url}
        />
      </div>
    </div>
  );
}
