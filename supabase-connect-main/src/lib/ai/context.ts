import type { WorkspaceId } from "@/components/workspace";
import { getWorkspaceIdForRole } from "@/components/workspace";
import type { AppRole } from "@/lib/role-utils";

import type { KanisaAIContext } from "./types";

type CreateKanisaAIContextInput = Partial<KanisaAIContext> & {
  role?: AppRole | null;
  isSuperAdmin?: boolean;
};

export function createKanisaAIContext(input: CreateKanisaAIContextInput = {}): KanisaAIContext {
  const workspace = input.workspace ?? getWorkspaceIdForRole(input.role, input.isSuperAdmin) as WorkspaceId;

  return {
    workspace,
    role: input.role ?? null,
    church: {
      id: input.church?.id ?? null,
      name: input.church?.name ?? null,
    },
    tenant: {
      id: input.tenant?.id ?? input.church?.id ?? null,
      slug: input.tenant?.slug ?? null,
    },
    route: input.route ?? (typeof window === "undefined" ? "/" : window.location.pathname),
    page: input.page ?? null,
    selectedItem: input.selectedItem ?? null,
    language: input.language ?? "en",
    queryClient: input.queryClient,
    user: input.user ?? null,
  };
}
