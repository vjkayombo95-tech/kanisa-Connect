import { StaffMobileServices } from "@/components/staff-mobile/StaffMobileExperience";
import type { StaffMobileConfig } from "@/lib/staff-mobile-registry";

export default function StaffServicesPage({ config }: { config: StaffMobileConfig }) {
  return <StaffMobileServices config={config} />;
}
