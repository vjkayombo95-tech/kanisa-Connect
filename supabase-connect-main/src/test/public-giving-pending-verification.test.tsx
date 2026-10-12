import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot, type Root } from "react-dom/client";
import fs from "node:fs";
import path from "node:path";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  churchId: "church-a",
  userId: "treasurer-a" as string | null,
  isOnline: true,
  offlineQueue: [] as unknown[],
  toast: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    churchId: mocks.churchId,
    user: mocks.userId ? { id: mocks.userId, email: `${mocks.userId}@example.test` } : null,
  }),
}));

vi.mock("@/hooks/useNetworkStatus", () => ({
  useNetworkStatus: () => ({ isOnline: mocks.isOnline }),
}));

vi.mock("@/hooks/useOfflineSyncQueue", () => ({
  useOfflineSyncQueue: () => mocks.offlineQueue,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/lib/offline-sync", () => ({
  enqueueOfflineSyncAction: vi.fn(),
  isOfflineSyncActionType: vi.fn(() => false),
  processOfflineSyncQueue: vi.fn(),
  removeOfflineSyncAction: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mocks.rpc,
    from: mocks.from,
  },
}));

type TableResult = {
  data: unknown[];
  count?: number;
  error: Error | null;
};

function tableResult(table: string): TableResult {
  if (table === "contributions") return { data: [], count: 0, error: null };
  if (table === "pledge_payments") return { data: [], count: 0, error: null };
  if (table === "platform_fees") return { data: [], error: null };
  if (table === "contribution_categories") return { data: [], error: null };
  return { data: [], count: 0, error: null };
}

function makeQueryBuilder(result: TableResult) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => builder),
    then: (resolve: (value: TableResult) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

const pendingRows = [
  {
    submission_id: "submission-1",
    church_id: "church-a",
    contribution_type: "Sadaka",
    amount: 5000,
    currency: "TZS",
    donor_name: "Public Donor",
    phone: "+255700000000",
    payment_reference: "TXN-12345",
    notes: "Thanksgiving",
    created_at: "2026-10-12T09:00:00Z",
  },
];

const churchBPendingRows = [
  {
    submission_id: "submission-2",
    church_id: "church-b",
    contribution_type: "Zaka",
    amount: 7000,
    currency: "TZS",
    donor_name: "Second Donor",
    phone: "+255711111111",
    payment_reference: "TXN-67890",
    notes: "Tithe",
    created_at: "2026-10-12T10:00:00Z",
  },
];

import ContributionsPage from "@/pages/church-admin/ContributionsPage";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root | null = null;
let client: QueryClient | null = null;

function renderPage() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  rerenderPage();
}

function rerenderPage() {
  if (!root || !client) throw new Error("React root not initialized");
  act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ContributionsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
}

async function waitForText(text: string) {
  if (!host) throw new Error("Test host not initialized");
  await vi.waitFor(() => expect(host.textContent).toContain(text), { timeout: 5000 });
}

async function waitForTextToDisappear(text: string) {
  if (!host) throw new Error("Test host not initialized");
  await vi.waitFor(() => expect(host.textContent).not.toContain(text), { timeout: 5000 });
}

function buttonByText(text: string, position: "first" | "last" = "first") {
  if (!host) throw new Error("Test host not initialized");
  const buttons = Array.from(host.querySelectorAll("button")).filter((candidate) =>
    candidate.textContent?.trim().includes(text),
  );
  const button = position === "last" ? buttons.at(-1) : buttons[0];
  if (!button) throw new Error(`Button not found: ${text}`);
  return button as HTMLButtonElement;
}

function dispatchClick(element: HTMLElement) {
  act(() => {
    element.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function clickButton(text: string, position: "first" | "last" = "first") {
  const button = buttonByText(text, position);
  dispatchClick(button);
  return button;
}

function clickCheckbox() {
  if (!host) throw new Error("Test host not initialized");
  const checkbox = host.querySelector('[role="checkbox"]');
  if (!checkbox) throw new Error("Checkbox not found");
  dispatchClick(checkbox as HTMLElement);
}

function setTextareaValue(value: string) {
  if (!host) throw new Error("Test host not initialized");
  const textarea = host.querySelector("textarea");
  if (!textarea) throw new Error("Textarea not found");
  const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
  act(() => {
    valueSetter?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("Public Giving pending verification frontend", () => {
  beforeEach(() => {
    mocks.churchId = "church-a";
    mocks.userId = "treasurer-a";
    mocks.isOnline = true;
    mocks.toast.mockReset();
    mocks.rpc.mockReset();
    mocks.from.mockReset();
    mocks.from.mockImplementation((table: string) => makeQueryBuilder(tableResult(table)));
    mocks.rpc.mockImplementation(async (name: string, args?: Record<string, unknown>) => {
      if (name === "list_pending_public_giving_submissions") {
        return { data: args?.p_church_id === "church-b" ? churchBPendingRows : pendingRows, error: null };
      }
      if (name === "approve_public_giving_submission") {
        return { data: { success: true, submission_id: "submission-1", status: "approved" }, error: null };
      }
      if (name === "reject_public_giving_submission") {
        return { data: { success: true, submission_id: "submission-1", status: "rejected" }, error: null };
      }
      return { data: null, error: null };
    });
  });

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (host) host.remove();
    root = null;
    host = null;
    client = null;
  });

  it("loads pending submissions for the active parish and renders empty/error/retry states", async () => {
    renderPage();
    clickButton("Pending Verification");

    await waitForText("Public Donor");
    expect(mocks.rpc).toHaveBeenCalledWith("list_pending_public_giving_submissions", { p_church_id: "church-a" });
    if (!host) throw new Error("Test host not initialized");
    expect(host.textContent).toContain("Sadaka");
    expect(host.textContent).toContain("TXN-12345");

    if (!root) throw new Error("React root not initialized");
    act(() => root.unmount());
    host.remove();
    root = null;
    host = null;
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "list_pending_public_giving_submissions") return { data: [], error: null };
      return { data: null, error: null };
    });
    renderPage();
    clickButton("Pending Verification");
    await waitForText("No pending public giving submissions for this parish.");

    if (!root || !host) throw new Error("React root not initialized");
    act(() => root.unmount());
    host.remove();
    root = null;
    host = null;
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "list_pending_public_giving_submissions") return { data: null, error: new Error("Permission denied") };
      return { data: null, error: null };
    });
    renderPage();
    clickButton("Pending Verification");
    await waitForText("Pending submissions could not be loaded.");
    const callsBeforeRetry = mocks.rpc.mock.calls.length;
    clickButton("Retry");
    await vi.waitFor(() => expect(mocks.rpc.mock.calls.length).toBeGreaterThan(callsBeforeRetry));
  });

  it("requires independent verification before approving and calls the approval RPC", async () => {
    renderPage();
    clickButton("Pending Verification");
    await waitForText("Public Donor");

    clickButton("Review");
    await waitForText("Approve public giving submission?");
    const approveButton = buttonByText("Approve");
    expect(approveButton.disabled).toBe(true);

    clickCheckbox();
    await vi.waitFor(() => expect(buttonByText("Approve", "last").disabled).toBe(false));
    clickButton("Approve", "last");

    await vi.waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith("approve_public_giving_submission", {
        p_submission_id: "submission-1",
        p_payment_verified: true,
      }),
    );
    expect(mocks.from).not.toHaveBeenCalledWith("public_giving_submissions");
  });

  it("requires a rejection reason and calls the rejection RPC", async () => {
    renderPage();
    clickButton("Pending Verification");
    await waitForText("Public Donor");

    clickButton("Reject");
    await waitForText("Reject public giving submission?");
    const rejectButton = buttonByText("Reject", "last");
    expect(rejectButton.disabled).toBe(true);

    setTextareaValue("Duplicate payment reference");
    await vi.waitFor(() => expect(buttonByText("Reject", "last").disabled).toBe(false));
    clickButton("Reject", "last");

    await vi.waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith("reject_public_giving_submission", {
        p_submission_id: "submission-1",
        p_reason: "Duplicate payment reference",
      }),
    );
  });

  it("isolates pending query data by authenticated user and hides rows when auth is missing", async () => {
    const secondUserRows = [{ ...pendingRows[0], submission_id: "submission-user-2", donor_name: "Second User Donor" }];
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "list_pending_public_giving_submissions") {
        return { data: mocks.userId === "treasurer-b" ? secondUserRows : pendingRows, error: null };
      }
      return { data: { success: true, submission_id: "submission-1", status: "approved" }, error: null };
    });

    renderPage();
    clickButton("Pending Verification");
    await waitForText("Public Donor");

    mocks.userId = "treasurer-b";
    rerenderPage();
    await waitForTextToDisappear("Public Donor");
    await waitForText("Second User Donor");

    mocks.userId = null;
    rerenderPage();
    await waitForTextToDisappear("Second User Donor");
    expect(mocks.rpc.mock.calls.filter(([name]) => name === "list_pending_public_giving_submissions")).toHaveLength(2);
  });

  it("closes stale review dialogs and reloads data when the active parish changes", async () => {
    renderPage();
    clickButton("Pending Verification");
    await waitForText("Public Donor");

    clickButton("Review");
    await waitForText("Approve public giving submission?");

    mocks.churchId = "church-b";
    rerenderPage();

    await waitForTextToDisappear("Approve public giving submission?");
    await waitForTextToDisappear("Public Donor");
    await waitForText("Second Donor");
    expect(mocks.rpc).toHaveBeenCalledWith("list_pending_public_giving_submissions", { p_church_id: "church-b" });
  });

  it("does not display stale in-flight parish results after a parish switch", async () => {
    const churchAList = deferred<{ data: typeof pendingRows; error: null }>();
    mocks.rpc.mockImplementation(async (name: string, args?: Record<string, unknown>) => {
      if (name === "list_pending_public_giving_submissions" && args?.p_church_id === "church-a") {
        return churchAList.promise;
      }
      if (name === "list_pending_public_giving_submissions" && args?.p_church_id === "church-b") {
        return { data: churchBPendingRows, error: null };
      }
      return { data: { success: true, submission_id: "submission-1", status: "approved" }, error: null };
    });

    renderPage();
    clickButton("Pending Verification");
    await waitForText("Loading pending submissions...");

    mocks.churchId = "church-b";
    rerenderPage();
    churchAList.resolve({ data: pendingRows, error: null });

    await waitForText("Second Donor");
    expect(host?.textContent).not.toContain("Public Donor");
  });

  it("prevents stale-parish approval actions before calling the backend RPC", async () => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "list_pending_public_giving_submissions") return { data: churchBPendingRows, error: null };
      return { data: { success: true, submission_id: "submission-1", status: "approved" }, error: null };
    });

    renderPage();
    clickButton("Pending Verification");
    await waitForText("Second Donor");

    clickButton("Review");
    await waitForText("Approve public giving submission?");
    clickCheckbox();
    await vi.waitFor(() => expect(buttonByText("Approve", "last").disabled).toBe(false));

    clickButton("Approve", "last");

    await vi.waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Approval failed",
      variant: "destructive",
    })));
    expect(mocks.rpc).not.toHaveBeenCalledWith("approve_public_giving_submission", expect.anything());
  });

  it("prevents duplicate approval submissions during an in-flight request", async () => {
    const approveResponse = deferred<{ data: { success: true; status: "approved"; submission_id: string }; error: null }>();
    mocks.rpc.mockImplementation(async (name: string, args?: Record<string, unknown>) => {
      if (name === "list_pending_public_giving_submissions") return { data: pendingRows, error: null };
      if (name === "approve_public_giving_submission") return approveResponse.promise;
      return { data: { success: true, submission_id: "submission-1", status: "rejected" }, error: null };
    });

    renderPage();
    clickButton("Pending Verification");
    await waitForText("Public Donor");
    clickButton("Review");
    await waitForText("Approve public giving submission?");
    clickCheckbox();
    await vi.waitFor(() => expect(buttonByText("Approve", "last").disabled).toBe(false));

    clickButton("Approve", "last");
    clickButton("Approve", "last");

    await vi.waitFor(() =>
      expect(mocks.rpc.mock.calls.filter(([name]) => name === "approve_public_giving_submission")).toHaveLength(1),
    );
    approveResponse.resolve({ data: { success: true, status: "approved", submission_id: "submission-1" }, error: null });
    await waitForTextToDisappear("Approve public giving submission?");
  });

  it("refreshes pending submissions without success toast when approval finds an already-reviewed submission", async () => {
    let listCalls = 0;
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "list_pending_public_giving_submissions") {
        listCalls += 1;
        return { data: listCalls > 1 ? [] : pendingRows, error: null };
      }
      if (name === "approve_public_giving_submission") {
        return { data: null, error: new Error("Submission has already been reviewed") };
      }
      return { data: { success: true, submission_id: "submission-1", status: "rejected" }, error: null };
    });

    renderPage();
    clickButton("Pending Verification");
    await waitForText("Public Donor");
    clickButton("Review");
    await waitForText("Approve public giving submission?");
    clickCheckbox();
    await vi.waitFor(() => expect(buttonByText("Approve", "last").disabled).toBe(false));
    clickButton("Approve", "last");

    await vi.waitFor(() => expect(listCalls).toBeGreaterThan(1));
    await waitForText("No pending public giving submissions for this parish.");
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Approval failed",
      description: "Submission has already been reviewed",
      variant: "destructive",
    }));
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Public giving approved" }));
  });

  it("refreshes pending submissions and confirmed contributions after a successful approval", async () => {
    renderPage();
    clickButton("Pending Verification");
    await waitForText("Public Donor");

    const contributionFetchesBefore = mocks.from.mock.calls.filter(([table]) => table === "contributions").length;
    const pendingFetchesBefore = mocks.rpc.mock.calls.filter(([name]) => name === "list_pending_public_giving_submissions").length;

    clickButton("Review");
    await waitForText("Approve public giving submission?");
    clickCheckbox();
    await vi.waitFor(() => expect(buttonByText("Approve", "last").disabled).toBe(false));
    clickButton("Approve", "last");

    await vi.waitFor(() =>
      expect(mocks.rpc.mock.calls.filter(([name]) => name === "list_pending_public_giving_submissions").length)
        .toBeGreaterThan(pendingFetchesBefore),
    );
    expect(mocks.from.mock.calls.filter(([table]) => table === "contributions").length)
      .toBeGreaterThan(contributionFetchesBefore);
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Public giving approved" }));
  });

  it("keeps the existing manual contribution entry available in the recorded tab", async () => {
    renderPage();

    await waitForText("Recorded Contributions");
    expect(buttonByText("Record Contribution")).toBeTruthy();
    await waitForText("No contributions recorded yet.");
  });

  it("keeps the implementation RPC-only and avoids Diocese Admin permission escalation", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/pages/church-admin/ContributionsPage.tsx"), "utf8");

    expect(source).toContain('"list_pending_public_giving_submissions"');
    expect(source).toContain('"approve_public_giving_submission"');
    expect(source).toContain('"reject_public_giving_submission"');
    expect(source).not.toContain('.from("public_giving_submissions")');
    expect(source).not.toMatch(/diocese/i);
    expect(source).toContain("p_payment_verified: true");
    expect(source).toContain("approvalVerified");
  });
});
