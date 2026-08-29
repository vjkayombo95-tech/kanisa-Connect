import { QueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { submitPortalPrayerRequest } from "@/lib/prayer-requests";
import { submitCommunityHelpRequest, submitPortalMassIntention } from "@/lib/member-linked-requests";

const OFFLINE_SYNC_QUEUE_KEY = "offline-sync-queue";
const OFFLINE_SYNC_EVENT = "offline-sync-queue-changed";
export type OfflineSyncAction =
  | {
      id: string;
      type: "church_contribution_create";
      createdAt: string;
      payload: {
        churchId: string;
        amount: number;
        memberId: string | null;
        donorName: string | null;
        phone: string | null;
        paymentReference: string | null;
        categoryId: string | null;
        createdBy: string | null;
        notes: string | null;
      };
    }
  | {
      id: string;
      type: "prayer_request_create";
      createdAt: string;
      payload: {
        churchId: string;
        memberId: string;
        memberName: string;
        requestText: string;
        offeringAmount: number | null;
        privacy: "public_to_church" | "private_to_pastor_admin" | "anonymous_public";
      };
    }
  | {
      id: string;
      type: "mass_intention_create";
      createdAt: string;
      payload: {
        churchId: string;
        memberId: string;
        memberName: string;
        intentionType: string;
        message: string;
        offeringAmount: number;
        requestedMassDate?: string | null;
      };
    }
  | {
      id: string;
      type: "community_help_request_create";
      createdAt: string;
      payload: {
        churchId: string;
        memberId: string;
        category: string;
        description: string;
        targetAmount: number | null;
      };
    };

export type OfflineSyncActionType = OfflineSyncAction["type"];
export type OfflineSyncActionOfType<TType extends OfflineSyncActionType> = Extract<OfflineSyncAction, { type: TType }>;

export function isOfflineSyncActionType<TType extends OfflineSyncActionType>(
  action: OfflineSyncAction,
  type: TType,
): action is OfflineSyncActionOfType<TType> {
  return action.type === type;
}

function readQueue(): OfflineSyncAction[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(OFFLINE_SYNC_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: OfflineSyncAction[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OFFLINE_SYNC_QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent(OFFLINE_SYNC_EVENT));
}

export function enqueueOfflineSyncAction(action: Omit<OfflineSyncAction, "id" | "createdAt">) {
  const queue = readQueue();
  const createdAction = {
    ...action,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  } as OfflineSyncAction;
  queue.push(createdAction);
  writeQueue(queue);
  return createdAction;
}

export function getOfflineSyncQueueCount() {
  return readQueue().length;
}

export function getOfflineSyncQueue() {
  return readQueue();
}

export function getOfflineSyncEventName() {
  return OFFLINE_SYNC_EVENT;
}

export function removeOfflineSyncAction(actionId: string) {
  const queue = readQueue().filter((item) => item.id !== actionId);
  writeQueue(queue);
}

async function processAction(action: OfflineSyncAction) {
  if (action.type === "church_contribution_create") {
    const { data, error } = await supabase.rpc("record_contribution_with_key" as never, {
      p_church_id: action.payload.churchId,
      p_amount: action.payload.amount,
      p_idempotency_key: action.id,
      p_member_id: action.payload.memberId,
      p_donor_name: action.payload.donorName,
      p_phone: action.payload.phone,
      p_payment_reference: action.payload.paymentReference,
      p_category_id: action.payload.categoryId,
      p_notes: action.payload.notes,
    } as never);

    if (error) throw error;
    const result = data as { success?: boolean; error?: string } | null;
    if (!result?.success) {
      throw new Error(result?.error || "Contribution was not recorded.");
    }

    return ["contributions", "my-contributions-all", "simple-member-home"] as string[];
  }

  if (action.type === "prayer_request_create") {
    const net = action.payload.offeringAmount ?? 0;

    await submitPortalPrayerRequest({
      request_text: action.payload.requestText,
      member_id: action.payload.memberId,
      church_id: action.payload.churchId,
      offering_amount: net || null,
      privacy: action.payload.privacy,
      idempotency_key: action.id,
    });

    return ["portal-prayer-requests", "my-prayer-requests", "my-prayers", "my-contributions-all", "simple-member-home", "contributions"] as string[];
  }

  if (action.type === "mass_intention_create") {
    await submitPortalMassIntention({
      intention_type: action.payload.intentionType,
      message: action.payload.message,
      offering_amount: action.payload.offeringAmount,
      member_id: action.payload.memberId,
      church_id: action.payload.churchId,
      requested_mass_date: action.payload.requestedMassDate ?? "",
      idempotency_key: action.id,
    });

    return ["portal-mass-intentions", "my-mass-intentions", "my-mass-intentions-dashboard", "my-contributions-all", "simple-member-home", "contributions"] as string[];
  }

  const request = await submitCommunityHelpRequest({
    category: action.payload.category,
    description: action.payload.description,
    target_amount: action.payload.targetAmount,
    member_id: action.payload.memberId,
    church_id: action.payload.churchId,
  });

  return ["community-help", "portal-community-help-approved", "my-help-requests", "my-help-requests-dashboard", `community-help-request:${request.id}`] as string[];
}

function shouldPauseProcessing(error: unknown) {
  const message = String((error as { message?: string })?.message || "").toLowerCase();
  return (
    message.includes("auth") ||
    message.includes("jwt") ||
    message.includes("not logged in") ||
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("offline")
  );
}

export async function processOfflineSyncQueue(queryClient: QueryClient) {
  const queue = readQueue();
  if (queue.length === 0) {
    return { processedCount: 0, remainingCount: 0, error: null as Error | null };
  }

  const remaining: OfflineSyncAction[] = [];
  const invalidationKeys = new Set<string>();
  let processedCount = 0;
  let fatalError: Error | null = null;

  for (const action of queue) {
    try {
      const keys = await processAction(action);
      processedCount += 1;
      keys.forEach((key) => invalidationKeys.add(key));
    } catch (error) {
      remaining.push(action);
      fatalError = error as Error;
      if (shouldPauseProcessing(error)) {
        remaining.push(...queue.slice(queue.indexOf(action) + 1));
        break;
      }
    }
  }

  writeQueue(remaining);
  invalidationKeys.forEach((key) => {
    queryClient.invalidateQueries({ queryKey: [key] });
  });

  return {
    processedCount,
    remainingCount: remaining.length,
    error: fatalError,
  };
}
