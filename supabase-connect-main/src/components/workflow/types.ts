import type { ReactNode } from "react";
import type { ButtonProps } from "@/components/ui/button";

export type WorkflowState =
  | "pending"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "scheduled"
  | "completed"
  | "cancelled";

export type WorkflowTimelineEventType =
  | "created"
  | "updated"
  | "assigned"
  | "approved"
  | "completed"
  | string;

export type WorkflowAction<TContext = unknown> = {
  id: string;
  label: string;
  ariaLabel?: string;
  icon?: ReactNode;
  variant?: ButtonProps["variant"];
  disabled?: boolean;
  loading?: boolean;
  visible?: boolean;
  onSelect?: (context: TContext) => void;
};

export type WorkflowSummaryField<TRecord = unknown> = {
  id: string;
  label: string;
  value: ReactNode | ((record: TRecord) => ReactNode);
  emptyValue?: ReactNode;
};

export type WorkflowTimelineEvent = {
  id: string;
  type: WorkflowTimelineEventType;
  date: string | Date | null;
  actor?: string | null;
  action?: string | null;
  description?: string | null;
};

export type WorkflowTimelineLabelConfig = Partial<Record<WorkflowTimelineEventType, string>>;

export type WorkflowConfig<TRecord = unknown, TContext = unknown> = {
  id: string;
  title: string;
  description?: string;
  states: WorkflowState[];
  actions: WorkflowAction<TContext>[];
  timelineLabels?: WorkflowTimelineLabelConfig;
  summaryFields: WorkflowSummaryField<TRecord>[];
};
