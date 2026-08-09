import type { ReactNode } from "react";

import { toast } from "@/hooks/use-toast";

type ToastIntent =
  | "success"
  | "error"
  | "offline"
  | "permission"
  | "network"
  | "saved"
  | "created"
  | "updated"
  | "deleted";

const friendlyDescriptions: Record<ToastIntent, string> = {
  success: "Done. The page has been updated.",
  error: "Please try again. If it keeps happening, contact support.",
  offline: "You appear to be offline. Changes that support offline mode will sync later.",
  permission: "Your current role does not have access to complete this action.",
  network: "Kanisa Connect could not reach the server. Check your connection and retry.",
  saved: "Your changes have been saved.",
  created: "The new record is ready.",
  updated: "The record has been updated.",
  deleted: "The record has been removed.",
};

export function getFriendlyErrorMessage(error: unknown, fallback = friendlyDescriptions.error) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return friendlyDescriptions.offline;

  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const normalized = message.toLowerCase();

  if (normalized.includes("permission") || normalized.includes("not authorized") || normalized.includes("rls")) {
    return friendlyDescriptions.permission;
  }
  if (normalized.includes("timeout") || normalized.includes("timed out")) {
    return "The request took too long. Please retry in a moment.";
  }
  if (normalized.includes("network") || normalized.includes("failed to fetch")) {
    return friendlyDescriptions.network;
  }

  return fallback;
}

export function pilotToast({
  title,
  description,
  intent = "success",
}: {
  title: ReactNode;
  description?: ReactNode;
  intent?: ToastIntent;
}) {
  toast({
    title,
    description: description ?? friendlyDescriptions[intent],
    variant: intent === "error" || intent === "permission" || intent === "network" ? "destructive" : "default",
  });
}
