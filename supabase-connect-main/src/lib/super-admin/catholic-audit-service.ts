import { supabase } from "@/integrations/supabase/client";
import { logWarning } from "@/lib/error-logger";

export type CatholicAuditAction =
  | "saint_created"
  | "saint_updated"
  | "saint_soft_deleted"
  | "saint_restored"
  | "workbook_imported";

type AuditPayload = {
  action: CatholicAuditAction;
  recordId?: string | null;
  entityType?: "saint" | "workbook";
  description: string;
  metadata?: Record<string, unknown>;
};

export async function recordCatholicAuditEvent({ action, recordId = null, entityType = "saint", description, metadata = {} }: AuditPayload) {
  try {
    const { error } = await supabase.rpc("create_audit_log" as never, {
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: recordId,
      p_description: description,
      p_metadata: metadata,
    } as never);

    if (error) throw error;
  } catch (error) {
    logWarning("[Catholic CMS] Audit logging skipped.", {
      function: "recordCatholicAuditEvent",
      metadata: { action, recordId, entityType, error },
    });
  }
}
