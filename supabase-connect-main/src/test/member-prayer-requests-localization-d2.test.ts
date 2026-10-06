import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n, { changeAppLanguage } from "@/i18n";
import { formatAppDate } from "@/lib/localization";
import { enqueueOfflineSyncAction } from "@/lib/offline-sync";
import { submitPortalPrayerRequest } from "@/lib/prayer-requests";

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const pageSource = read("src/pages/portal/PortalPrayerRequests.tsx");
const commentThreadSource = read("src/components/portal/CommentThread.tsx");
const offlineSyncSource = read("src/lib/offline-sync.ts");

describe("member prayer requests localization D2", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: { success: true, id: "prayer-1", created: true }, error: null });
    window.localStorage.clear();
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "offline-action-id") });
  });

  it("provides English and Kiswahili strings for the member prayer request UI", async () => {
    await changeAppLanguage("en");
    expect(i18n.t("member_prayer_requests.title")).toBe("Prayer Requests");
    expect(i18n.t("member_prayer_requests.actions.create")).toBe("Submit Prayer Request");
    expect(i18n.t("member_prayer_requests.privacy.anonymous_public.label")).toBe("Without showing my name");
    expect(i18n.t("member_prayer_requests.offering.helper")).toContain("not required");
    expect(i18n.t("member_prayer_requests.comments.heading")).toBe("Messages of Comfort");

    await changeAppLanguage("sw");
    expect(i18n.t("member_prayer_requests.title")).toBe("Maombi");
    expect(i18n.t("member_prayer_requests.actions.create")).toBe("Tuma Ombi la Maombi");
    expect(i18n.t("member_prayer_requests.privacy.anonymous_public.label")).toBe("Bila kutaja jina");
    expect(i18n.t("member_prayer_requests.offering.helper")).toContain("si sharti");
    expect(i18n.t("member_prayer_requests.comments.heading")).toBe("Ujumbe wa Faraja");
  });

  it("keeps canonical privacy and status values out of translated storage paths", () => {
    for (const privacy of ["public_to_church", "private_to_pastor_admin", "anonymous_public"]) {
      expect(pageSource).toContain(`value: "${privacy}"`);
      expect(offlineSyncSource).toContain(privacy);
    }

    for (const status of ["pending", "approved", "rejected"]) {
      expect(pageSource).toContain(`status === "${status}"`);
    }

    expect(pageSource).toContain('type: "prayer_request_create"');
    expect(pageSource).toContain("payload: {");
    expect(pageSource).toContain("churchId,");
    expect(pageSource).toContain("memberId: member.id");
    expect(pageSource).toContain("memberName: member.full_name");
    expect(pageSource).toContain("requestText,");
    expect(pageSource).toContain("offeringAmount: requestedOffering");
    expect(pageSource).toContain("privacy,");
    expect(pageSource).toContain("`offline-draft:prayer-request:${churchId}:${member?.id || \"member\"}`");
  });

  it("keeps online RPC payloads language-neutral", async () => {
    const payload = {
      request_text: "Please pray for my family",
      member_id: "member-1",
      church_id: "church-1",
      offering_amount: 5000,
      privacy: "anonymous_public" as const,
      idempotency_key: "same-key",
    };

    await changeAppLanguage("en");
    await submitPortalPrayerRequest(payload);
    const englishRpcPayload = rpcMock.mock.calls.at(-1)?.[1];

    await changeAppLanguage("sw");
    await submitPortalPrayerRequest(payload);
    const kiswahiliRpcPayload = rpcMock.mock.calls.at(-1)?.[1];

    expect(englishRpcPayload).toEqual(kiswahiliRpcPayload);
    expect(englishRpcPayload).toMatchObject({
      p_church_id: "church-1",
      p_member_id: "member-1",
      p_request_text: "Please pray for my family",
      p_offering_amount: 5000,
      p_privacy: "anonymous_public",
      p_idempotency_key: "same-key",
    });
  });

  it("keeps offline prayer request payloads language-neutral", async () => {
    const action = {
      type: "prayer_request_create" as const,
      payload: {
        churchId: "church-1",
        memberId: "member-1",
        memberName: "Neema",
        requestText: "Please pray for my family",
        offeringAmount: 5000,
        privacy: "anonymous_public" as const,
      },
    };

    await changeAppLanguage("en");
    const englishAction = enqueueOfflineSyncAction(action);
    window.localStorage.clear();

    await changeAppLanguage("sw");
    const kiswahiliAction = enqueueOfflineSyncAction(action);

    expect(englishAction.type).toBe("prayer_request_create");
    expect(kiswahiliAction.type).toBe("prayer_request_create");
    expect(englishAction.payload).toEqual(kiswahiliAction.payload);
    expect(englishAction.payload).toEqual(action.payload);
  });

  it("keeps offering, anonymity, comments, reactions, prayer marks, and tenant scope structural", () => {
    expect(pageSource).toContain("offering_amount: requestedOffering || null");
    expect(pageSource).toContain("const PLATFORM_FEE_PERCENT = 1");
    expect(pageSource).toContain('request.privacy === "anonymous_public" ? t("member_prayer_requests.anonymous_requester") : request.member_name');
    expect(pageSource).toContain('.from("prayer_request_comments")');
    expect(pageSource).toContain("prayer_request_id: request.id");
    expect(pageSource).toContain("author_name: member?.full_name || \"Member\"");
    expect(pageSource).toContain('.from("prayer_request_comment_reactions")');
    expect(pageSource).toContain('onConflict: "comment_id,user_id"');
    expect(pageSource).toContain('.from("prayer_request_prayers")');
    expect(pageSource).toContain('attemptedPrayerOperation.current = prayerStats.prayedByMe ? "delete" : "insert"');
    expect(pageSource).toContain('.eq("church_id", churchId)');
    expect(pageSource).toContain('.eq("member_id", member.id)');
  });

  it("uses language-aware date presentation without changing dynamic content", () => {
    expect(pageSource).toContain("formatAppDate(request.created_at, i18n.language)");
    expect(pageSource).toContain("formatAppDate(item.createdAt, i18n.language");

    const instant = "2026-10-05T12:15:00Z";
    expect(formatAppDate(instant, "en", { dateStyle: "medium" })).not.toBe(
      formatAppDate(instant, "sw", { dateStyle: "medium" }),
    );
  });

  it("localizes CommentThread framing through page props while shared fallbacks remain localized", () => {
    expect(pageSource).toContain('headingLabel={t("member_prayer_requests.comments.heading")}');
    expect(pageSource).toContain('draftPlaceholder={t("member_prayer_requests.comments.placeholder")}');
    expect(pageSource).toContain('emptyState={t("member_prayer_requests.comments.empty")}');
    expect(commentThreadSource).toContain('headingLabel ?? t("member_comments.heading")');
    expect(commentThreadSource).toContain('draftPlaceholder ?? t("member_comments.placeholder")');
  });
});
