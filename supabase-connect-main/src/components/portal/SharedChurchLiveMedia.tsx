import { LiveMassCard } from "@/components/portal/LiveMassCard";
import { RadioLiveCard } from "@/components/portal/RadioLiveCard";

export function SharedChurchLiveMedia({ churchName }: { churchName?: string | null }) {
  return <section className="space-y-4" aria-label="Matangazo ya moja kwa moja" data-testid="shared-church-live-media">
    <LiveMassCard churchName={churchName} viewerBasePath="/church-live" />
    <RadioLiveCard playInline />
  </section>;
}
