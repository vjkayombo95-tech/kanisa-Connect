import { QueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { submitPrayerRequest } from "@/lib/prayer-requests";
import { submitCommunityHelpRequest, submitMassIntention } from "@/lib/member-linked-requests";

const OFFLINE_SYNC_QUEUE_KEY = "offline-sync-queue";
const OFFLINE_SYNC_EVENT = "offline-sync-queue-changed";
const PLATFORM_FEE_PERCENT = 1;

type OfflineSyncAction =
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

function roundCurrency(amount: number) {
  return Number(amount.toFixed(2));
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
    const { error } = await supabase.from("contributions").insert({
      church_id: action.payload.churchId,
      amount: action.payload.amount,
      member_id: action.payload.memberId,
      donor_name: action.payload.donorName,
      phone: action.payload.phone,
      payment_reference: action.payload.paymentReference,
      category_id: action.payload.categoryId,
      created_by: action.payload.createdBy,
      notes: action.payload.notes,
    });

    if (error) throw error;
    return ["contributions"] as string[];
  }

  if (action.type === "prayer_request_create") {
    const net = action.payload.offeringAmount ?? 0;
    const gross = net > 0 ? roundCurrency(net / (1 - PLATFORM_FEE_PERCENT / 100)) : 0;
    const fee = gross > 0 ? roundCurrency(gross - net) : 0;

    const prayerRequest = await submitPrayerRequest({
      request_text: action.payload.requestText,
      member_id: action.payload.memberId,
      church_id: action.payload.churchId,
      offering_amount: net || null,
    });

    if (gross > 0) {
      const { error: feeError } = await supabase.from("platform_fees").insert({
        church_id: action.payload.churchId,
        source_type: "prayer_request",
        source_id: prayerRequest.id,
        gross_amount: gross,
        fee_percentage: PLATFORM_FEE_PERCENT,
        fee_amount: fee,
        net_amount: net,
        member_id: action.payload.memberId,
      });
      if (feeError) throw feeError;

      const { error: contributionError } = await supabase.from("contributions").insert({
        church_id: action.payload.churchId,
        amount: net,
        donor_name: action.payload.memberName,
        member_id: action.payload.memberId,
        notes: `Prayer Request Offering - ${action.payload.requestText.trim().slice(0, 80)} (TZS ${fee.toLocaleString()} platform fee)`,
      });
      if (contributionError) throw contributionError;
    }

    return ["portal-prayer-requests", "my-prayer-requests", "my-prayers", "my-contributions-all", "contributions"] as string[];
  }

  if (action.type === "mass_intention_create") {
    const net = action.payload.offeringAmount;
    const gross = roundCurrency(net / (1 - PLATFORM_FEE_PERCENT / 100));
    const fee = roundCurrency(gross - net);

    const intention = await submitMassIntention({
      intention_type: action.payload.intentionType,
      message: action.payload.message,
      offering_amount: net,
      member_id: action.payload.memberId,
      church_id: action.payload.churchId,
    });

    const { error: feeError } = await supabase.from("platform_fees").insert({
      church_id: action.payload.churchId,
      source_type: "mass_intention",
      source_id: intention.id,
      gross_amount: gross,
      fee_percentage: PLATFORM_FEE_PERCENT,
      fee_amount: fee,
      net_amount: net,
      member_id: action.payload.memberId,
    });
    if (feeError) throw feeError;

    const { error: contributionError } = await supabase.from("contributions").insert({
      church_id: action.payload.churchId,
      amount: net,
      donor_name: action.payload.memberName,
      member_id: action.payload.memberId,
      notes: `Mass Intention: ${action.payload.intentionType || "thanksgiving"} - ${action.payload.message.trim().slice(0, 80)} (TZS ${fee.toLocaleString()} platform fee)`,
    });
    if (contributionError) throw contributionError;

    return ["portal-mass-intentions", "my-mass-intentions", "my-mass-intentions-dashboard", "my-contributions-all", "contributions"] as string[];
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
