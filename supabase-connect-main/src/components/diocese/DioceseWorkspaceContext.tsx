import { createContext, useContext, type ReactNode } from "react";
import type { DioceseWorkspace } from "@/lib/diocese-workspace";

const DioceseWorkspaceContext = createContext<DioceseWorkspace | null>(null);

interface DioceseWorkspaceProviderProps {
  workspace: DioceseWorkspace;
  children: ReactNode;
}

export function DioceseWorkspaceProvider({
  workspace,
  children,
}: DioceseWorkspaceProviderProps) {
  return (
    <DioceseWorkspaceContext.Provider value={workspace}>
      {children}
    </DioceseWorkspaceContext.Provider>
  );
}

export function useDioceseWorkspace() {
  const workspace = useContext(DioceseWorkspaceContext);

  if (!workspace) {
    throw new Error(
      "useDioceseWorkspace must be used within DioceseWorkspaceProvider",
    );
  }

  return workspace;
}
