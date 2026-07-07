import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  CalendarDays,
  ClipboardList,
  CreditCard,
  HeartHandshake,
  Users,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type ChurchAdminPendingCounts = {
  events: number;
  sacraments: number;
  massIntentions: number;
  payments: number;
  memberships: number;
  volunteers: number;
  total: number;
};

export type ChurchAdminNotificationKey = Exclude<keyof ChurchAdminPendingCounts, "total">;

export type ChurchAdminNotificationItem = {
  key: ChurchAdminNotificationKey;
  label: string;
  description: string;
  count: number;
  route: string;
  icon: LucideIcon;
};

export const EMPTY_CHURCH_ADMIN_PENDING_COUNTS: ChurchAdminPendingCounts = {
  events: 0,
  sacraments: 0,
  massIntentions: 0,
  payments: 0,
  memberships: 0,
  volunteers: 0,
  total: 0,
};

export const CHURCH_ADMIN_NOTIFICATION_REFRESH_MS = 60_000;

const itemDefinitions: Array<Omit<ChurchAdminNotificationItem, "count">> = [
  {
    key: "events",
    label: "Event approvals",
    description: "Member event requests waiting for admin review.",
    route: "/church-admin/event-requests",
    icon: CalendarDays,
  },
  {
    key: "sacraments",
    label: "Sacrament requests",
    description: "Sacramental records still in planning or preparation.",
    route: "/church-admin/sacraments",
    icon: Award,
  },
  {
    key: "massIntentions",
    label: "Mass intentions",
    description: "Intentions waiting for approval, scheduling, or payment review.",
    route: "/church-admin/mass-intentions",
    icon: ClipboardList,
  },
  {
    key: "payments",
    label: "Payment proofs",
    description: "Submitted payment proofs awaiting verification.",
    route: "/church-admin/events",
    icon: CreditCard,
  },
  {
    key: "memberships",
    label: "Community join requests",
    description: "Community membership requests awaiting review.",
    route: "/church-admin/communities",
    icon: Users,
  },
  {
    key: "volunteers",
    label: "Volunteer requests",
    description: "Ministry volunteer requests awaiting review.",
    route: "/church-admin/ministries",
    icon: HeartHandshake,
  },
];

const sidebarBadgeMap: Record<string, ChurchAdminNotificationKey> = {
  "event-requests": "events",
  sacraments: "sacraments",
  "mass-intentions": "massIntentions",
  events: "payments",
  "qr-payments": "payments",
  communities: "memberships",
  ministries: "volunteers",
};

function readNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function normalizeChurchAdminPendingCounts(value: unknown): ChurchAdminPendingCounts {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const counts = {
    events: readNumber(record.events),
    sacraments: readNumber(record.sacraments),
    massIntentions: readNumber(record.massIntentions),
    payments: readNumber(record.payments),
    memberships: readNumber(record.memberships),
    volunteers: readNumber(record.volunteers),
  };

  return {
    ...counts,
    total:
      readNumber(record.total) ||
      counts.events + counts.sacraments + counts.massIntentions + counts.payments + counts.memberships + counts.volunteers,
  };
}

export function getChurchAdminNotificationItems(counts: ChurchAdminPendingCounts) {
  return itemDefinitions.map((item) => ({ ...item, count: counts[item.key] }));
}

export function getActionRequiredItems(counts: ChurchAdminPendingCounts) {
  return getChurchAdminNotificationItems(counts).filter((item) => item.count > 0);
}

export function getChurchAdminSidebarBadge(itemId: string, counts: ChurchAdminPendingCounts) {
  const key = sidebarBadgeMap[itemId];
  return key ? counts[key] : 0;
}

export function useChurchAdminPendingCounts() {
  const { churchId, userRole, isSuperAdmin } = useAuth();
  const enabled = !!churchId && (isSuperAdmin || ["church_admin", "pastor", "secretary", "treasurer"].includes(userRole ?? ""));

  return useQuery({
    queryKey: ["church-admin-pending-counts", churchId],
    queryFn: async () => {
      if (!churchId) return EMPTY_CHURCH_ADMIN_PENDING_COUNTS;
      const { data, error } = await supabase.rpc("get_church_admin_pending_counts" as never, { _church_id: churchId } as never);
      if (error) throw error;
      return normalizeChurchAdminPendingCounts(data);
    },
    enabled,
    staleTime: 30_000,
    refetchInterval: enabled ? CHURCH_ADMIN_NOTIFICATION_REFRESH_MS : false,
    refetchOnWindowFocus: true,
  });
}

export function useChurchAdminNotificationItems() {
  const query = useChurchAdminPendingCounts();
  const counts = query.data ?? EMPTY_CHURCH_ADMIN_PENDING_COUNTS;
  const items = useMemo(() => getChurchAdminNotificationItems(counts), [counts]);
  const actionItems = useMemo(() => items.filter((item) => item.count > 0), [items]);

  return {
    ...query,
    counts,
    items,
    actionItems,
  };
}
