import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  fetchStations: vi.fn(),
  feature: { key: "radio", exists: true, enabled: false, visible: false, locked: false },
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ churchId: "church-a", user: { id: "user-a" } }) }));
vi.mock("@/hooks/use-feature-access", () => ({
  useFeatureAccess: () => ({ isLoading: false, getFeatureState: () => mocks.feature }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("@/lib/church-radio", () => ({ fetchMemberRadioStations: mocks.fetchStations }));

import { useChurchRadioStations } from "@/hooks/use-church-radio";

function Harness({ onResult }: { onResult: (value: ReturnType<typeof useChurchRadioStations>) => void }) {
  const result = useChurchRadioStations();
  useEffect(() => onResult(result), [onResult, result]);
  return null;
}

describe("Wave 5A disabled Radio data boundary", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.fetchStations.mockReset();
    mocks.feature = { key: "radio", exists: true, enabled: false, visible: false, locked: false };
  });

  it("does not request permission or stations when effective Radio is disabled", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    let result: ReturnType<typeof useChurchRadioStations> | undefined;

    await act(async () => root.render(<QueryClientProvider client={client}><Harness onResult={(value) => { result = value; }} /></QueryClientProvider>));
    expect(result?.featureLoading).toBe(false);
    expect(result?.featureEnabled).toBe(false);
    expect(result?.data).toEqual([]);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.fetchStations).not.toHaveBeenCalled();
    act(() => root.unmount());
    host.remove();
  });
});
