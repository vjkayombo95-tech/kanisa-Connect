import { AlertCircle, CheckCircle2, ChevronRight, CircleDollarSign, ClipboardCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { Skeleton } from "@/components/ui/skeleton";
import { useChurchDashboardIntelligence } from "@/hooks/use-church-dashboard-intelligence";
import {
  EMPTY_FINANCIAL_SUMMARY,
  EMPTY_PENDING_COUNTS,
  visiblePendingActions,
} from "@/lib/church-dashboard-intelligence";
import { formatTZS } from "@/lib/currency";

export function ChurchDashboardIntelligence({ compact = false }: { compact?: boolean }) {
  const { financial, financialEnabled, pending, pendingEnabled, staffWorkspace } = useChurchDashboardIntelligence();
  const counts = pending.data ?? EMPTY_PENDING_COUNTS;
  const summary = financial.data ?? EMPTY_FINANCIAL_SUMMARY;
  const actions = visiblePendingActions(counts, staffWorkspace);

  if (!pendingEnabled && !financialEnabled) return null;

  return (
    <section className={compact ? "space-y-3" : "grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]"} aria-label="Dashboard intelligence">
      {pendingEnabled ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><ClipboardCheck className="h-5 w-5" /></span>
              <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/80">Needs Attention</p><h2 className="mt-1 font-semibold text-white">Pending work</h2></div>
            </div>
            {!pending.isLoading && !pending.isError ? <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">{actions.reduce((sum, item) => sum + item.count, 0)}</span> : null}
          </div>
          {pending.isLoading ? <div className="mt-4 grid gap-3 sm:grid-cols-2"><Skeleton className="h-16 rounded-xl" /><Skeleton className="h-16 rounded-xl" /></div>
            : pending.isError ? <StateMessage icon={AlertCircle} text="Pending work could not be loaded. The rest of the dashboard remains available." error />
            : actions.length === 0 ? <StateMessage icon={CheckCircle2} text="No pending work is available for your current role." />
            : <div className="mt-4 grid gap-2 sm:grid-cols-2">{actions.map((item) => <Link key={item.key} to={item.route} className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-black/15 px-3.5 py-3 transition hover:border-primary/25 hover:bg-primary/[0.04]"><span className="text-sm font-medium text-white">{item.label}</span><span className="flex items-center gap-2 text-primary"><strong>{item.count}</strong><ChevronRight className="h-4 w-4" /></span></Link>)}</div>}
        </div>
      ) : null}
      {financialEnabled ? (
        <div className="rounded-2xl border border-primary/15 bg-primary/[0.045] p-4 sm:p-5">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><CircleDollarSign className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/80">Financial summary</p><h2 className="mt-1 font-semibold text-white">Verified receipts</h2></div></div>
          {financial.isLoading ? <Skeleton className="mt-4 h-28 rounded-xl" />
            : financial.isError ? <StateMessage icon={AlertCircle} text="Financial summary is temporarily unavailable." error />
            : <div className="mt-4 grid grid-cols-2 gap-3"><Metric label="This month" value={formatTZS(summary.thisMonthReceived)} /><Metric label="All received" value={formatTZS(summary.totalReceived)} /><Metric label="Transactions" value={String(summary.transactionCount)} /><Metric label="Contributions" value={formatTZS(summary.contributionTotal)} /></div>}
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/[0.08] bg-black/15 p-3"><p className="text-xs text-white/55">{label}</p><p className="mt-1 truncate text-sm font-semibold text-white">{value}</p></div>;
}

function StateMessage({ icon: Icon, text, error = false }: { icon: typeof CheckCircle2; text: string; error?: boolean }) {
  return <div className={`mt-4 flex items-start gap-3 rounded-xl border p-3 text-sm ${error ? "border-destructive/20 bg-destructive/5 text-destructive" : "border-white/[0.08] bg-black/15 text-white/60"}`}><Icon className="mt-0.5 h-4 w-4 shrink-0" /><span>{text}</span></div>;
}
