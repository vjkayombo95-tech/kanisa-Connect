import { isStaging } from "@/lib/environment";

export function StagingBanner() {
  if (!isStaging) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] bg-red-700 px-3 py-1.5 text-center text-xs font-bold tracking-[0.2em] text-white shadow-md">
      STAGING — TEST DATA ONLY
    </div>
  );
}
