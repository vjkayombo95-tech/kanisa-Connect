import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { fetchMemberNotifications, memberNotificationsKey } from "@/lib/member-notifications";

export function useMemberNotifications(enabled = true) {
  const { user, churchId } = useAuth();
  const userId = user?.id ?? null;

  return useQuery({
    queryKey: memberNotificationsKey(userId, churchId),
    queryFn: () => fetchMemberNotifications(userId!, churchId!),
    enabled: enabled && !!userId && !!churchId,
    staleTime: 60_000,
  });
}
