import type { WorkspaceId } from "@/components/workspace";
import type { AssistantEvent, AssistantEventCategory, AssistantEventPriority } from "@/lib/assistant/events";

export type AutomationEventType =
  | "PRAYER_REQUEST_SUBMITTED"
  | "PRAYER_REQUEST_APPROVED"
  | "PRAYER_REQUEST_PENDING"
  | "MASS_INTENTION_CREATED"
  | "MASS_SCHEDULED"
  | "SACRAMENT_SCHEDULED"
  | "SACRAMENT_PREPARATION_DUE"
  | "SACRAMENT_CERTIFICATE_READY"
  | "CONTRIBUTION_RECORDED"
  | "PLEDGE_DUE"
  | "MEMBER_REGISTERED"
  | "INVITATION_SENT"
  | "INVITATION_PENDING"
  | "ANNOUNCEMENT_PUBLISHED"
  | "ANNOUNCEMENT_EXPIRING"
  | "CALENDAR_EVENT_TOMORROW"
  | "MASS_TOMORROW"
  | "BIRTHDAY_TODAY"
  | "WEDDING_ANNIVERSARY"
  | "DAILY_READINGS_PUBLISHED"
  | "CHURCH_HEALTH_CHANGED"
  | "PLATFORM_HEALTH_WARNING";

export type AutomationActionType =
  | "NAVIGATE"
  | "CREATE_NOTIFICATION"
  | "CREATE_ASSISTANT_EVENT"
  | "SHOW_REMINDER"
  | "QUEUE_FUTURE_REMINDER"
  | "LOG_AUTOMATION"
  | "EMAIL"
  | "SMS"
  | "WHATSAPP"
  | "PUSH";

export type AutomationStatus = "matched" | "skipped" | "executed" | "failed" | "queued";

export type AutomationEvent = {
  id: string;
  type: AutomationEventType;
  workspace: WorkspaceId;
  role?: string | null;
  churchId?: string | null;
  route?: string;
  occurredAt: string;
  payload?: Record<string, unknown>;
};

export type AutomationCondition =
  | { kind: "waiting_time"; field?: string; gteHours: number }
  | { kind: "priority"; equals: AssistantEventPriority }
  | { kind: "role"; oneOf: string[] }
  | { kind: "workspace"; oneOf: WorkspaceId[] }
  | { kind: "church"; churchId: string }
  | { kind: "feature_enabled"; key: string }
  | { kind: "liturgical_season"; oneOf: string[] }
  | { kind: "contribution_amount"; gte: number }
  | { kind: "event_status"; equals: string };

export type AutomationAction = {
  id: string;
  type: AutomationActionType;
  label: string;
  to?: string;
  delayUntil?: string;
  notification?: {
    title: string;
    body: string;
  };
  assistantEvent?: {
    title: string;
    detail: string;
    priority: AssistantEventPriority;
    category: AssistantEventCategory;
    to?: string;
    actionLabel?: string;
    expiresAt?: string | null;
  };
};

export type AutomationRule = {
  id: string;
  title: string;
  description?: string;
  eventTypes: AutomationEventType[];
  workspaces: WorkspaceId[];
  conditions?: AutomationCondition[];
  actions: AutomationAction[];
  enabled?: boolean;
};

export type AutomationContext = {
  now: Date;
  features?: {
    isFeatureEnabled?: (key: string) => boolean;
  };
  dashboardCache?: unknown;
};

export type AutomationActionResult = {
  action: AutomationAction;
  status: AutomationStatus;
  message: string;
  assistantEvent?: AssistantEvent;
};

export type AutomationRuleResult = {
  rule: AutomationRule;
  matched: boolean;
  reason?: string;
  actions: AutomationActionResult[];
};

export type AutomationRunResult = {
  event: AutomationEvent;
  matchedRules: AutomationRuleResult[];
};

export type AutomationHistoryEntry = {
  id: string;
  ruleId: string;
  trigger: AutomationEventType;
  time: string;
  action: AutomationActionType;
  status: AutomationStatus;
  message: string;
};
