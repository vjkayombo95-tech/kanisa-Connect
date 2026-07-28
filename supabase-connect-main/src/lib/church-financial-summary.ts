import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useChurchPermission } from "@/hooks/use-church-permission";

export type ChurchFinancialSummary = {
  totalReceived: number;
  thisMonthReceived: number;
  transactionCount: number;
  contributionTotal: number;
  pledgePaymentTotal: number;
  eventRegistrationTotal: number;
  thisMonthContributionTotal: number;
  thisMonthPledgePaymentTotal: number;
  thisMonthEventRegistrationTotal: number;
  contributionCount: number;
  pledgePaymentCount: number;
  eventRegistrationCount: number;
};

export const EMPTY_CHURCH_FINANCIAL_SUMMARY: ChurchFinancialSummary = {
  totalReceived: 0,
  thisMonthReceived: 0,
  transactionCount: 0,
  contributionTotal: 0,
  pledgePaymentTotal: 0,
  eventRegistrationTotal: 0,
  thisMonthContributionTotal: 0,
  thisMonthPledgePaymentTotal: 0,
  thisMonthEventRegistrationTotal: 0,
  contributionCount: 0,
  pledgePaymentCount: 0,
  eventRegistrationCount: 0,
};

function numberAt(record: Record<string, unknown>, key: string) {
  const value = Number(record[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export function normalizeChurchFinancialSummary(value: unknown): ChurchFinancialSummary {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    totalReceived: numberAt(record, "total_received"),
    thisMonthReceived: numberAt(record, "this_month_received"),
    transactionCount: numberAt(record, "transaction_count"),
    contributionTotal: numberAt(record, "contribution_total"),
    pledgePaymentTotal: numberAt(record, "pledge_payment_total"),
    eventRegistrationTotal: numberAt(record, "event_registration_total"),
    thisMonthContributionTotal: numberAt(record, "this_month_contribution_total"),
    thisMonthPledgePaymentTotal: numberAt(record, "this_month_pledge_payment_total"),
    thisMonthEventRegistrationTotal: numberAt(record, "this_month_event_registration_total"),
    contributionCount: numberAt(record, "contribution_count"),
    pledgePaymentCount: numberAt(record, "pledge_payment_count"),
    eventRegistrationCount: numberAt(record, "event_registration_count"),
  };
}

export function useChurchFinancialSummary() {
  const { churchId } = useAuth();
  const permission = useChurchPermission("reports", "view");
  const enabled = !!churchId && permission.allowed;

  return useQuery({
    queryKey: ["church-financial-summary", churchId],
    queryFn: async () => {
      if (!churchId) return EMPTY_CHURCH_FINANCIAL_SUMMARY;
      const { data, error } = await supabase.rpc("get_church_financial_summary" as never, {
        _church_id: churchId,
        _start_date: null,
        _end_date: null,
      } as never);
      if (error) throw error;
      return normalizeChurchFinancialSummary(data);
    },
    enabled,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
