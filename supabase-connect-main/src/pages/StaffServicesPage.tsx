import { StaffMobileServices, type StaffMobileAccountAction } from "@/components/staff-mobile/StaffMobileExperience";
import type { StaffMobileConfig } from "@/lib/staff-mobile-registry";

export default function StaffServicesPage({ config, accountActions }: { config: StaffMobileConfig; accountActions?: StaffMobileAccountAction[] }) {
  return <StaffMobileServices config={config} accountActions={accountActions} />;
}
