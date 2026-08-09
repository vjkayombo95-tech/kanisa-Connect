import { isStaging } from "@/lib/environment";

export function StagingBanner() {
  if (!isStaging) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex h-[var(--staging-banner-height)] select-none items-center justify-center bg-red-700 px-3 pt-[env(safe-area-inset-top,0px)] text-center text-xs font-bold tracking-[0.2em] text-white shadow-md"
      data-testid="staging-environment-banner"
    >
      STAGING — TEST DATA ONLY
    </div>
  );
}
