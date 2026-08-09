import type { WorkflowState, WorkflowTimelineLabelConfig } from "./types";

export const workflowStates: WorkflowState[] = [
  "pending",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "scheduled",
  "completed",
  "cancelled",
];

export const workflowStateLabels: Record<WorkflowState, string> = {
  pending: "Pending",
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const defaultWorkflowTimelineLabels: WorkflowTimelineLabelConfig = {
  created: "Created",
  updated: "Updated",
  assigned: "Assigned",
  approved: "Approved",
  completed: "Completed",
};

export function normalizeWorkflowState(state: string): WorkflowState | string {
  return state.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function formatWorkflowLabel(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}
