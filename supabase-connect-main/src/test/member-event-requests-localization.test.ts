import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { formatAppDate } from "@/lib/localization";
import en from "@/locales/en.json";
import sw from "@/locales/sw.json";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const source = read("src/pages/portal/EventRequests.tsx");

describe("member Event Requests localization hardening", () => {
  it("renders preferred request dates through the app date formatter and current i18n language", () => {
    expect(source).toContain('import { formatAppDate } from "@/lib/localization"');
    expect(source).toContain("const { t, i18n } = useTranslation()");
    expect(source).toContain('formatAppDate(request.preferred_date, i18n.language, { dateStyle: "medium" })');
    expect(source).not.toContain("{t(\"event_request.preferred_date\")}: {request.preferred_date}");
  });

  it("formats the same date-only value differently by app language without changing its canonical value", () => {
    const canonicalDate = "2026-10-04";
    const english = formatAppDate(canonicalDate, "en", { dateStyle: "medium" });
    const kiswahili = formatAppDate(canonicalDate, "sw", { dateStyle: "medium" });

    expect(english).not.toBe(canonicalDate);
    expect(kiswahili).not.toBe(canonicalDate);
    expect(english).not.toBe(kiswahili);
    expect(canonicalDate).toBe("2026-10-04");
  });

  it("preserves canonical service mappings, statuses, date input, and submit payload", () => {
    expect(source).toContain('const SERVICE_KEYS: ServiceKey[] = ["wedding", "baptism", "confirmation", "first_communion", "funeral", "requested_event", "other"]');
    expect(source).toContain('wedding: { requestType: "parish_event", type: "wedding" }');
    expect(source).toContain('confirmation: { requestType: "parish_event", type: "confirmation" }');
    expect(source).toContain('first_communion: { requestType: "parish_event", type: "first_communion" }');
    expect(source).toContain('other: { requestType: "other", type: "other_office_service" }');
    expect(source).toContain('status: "submitted"');
    expect(source).toContain('type="date"');
    expect(source).toContain("value={preferredDate}");
    expect(source).toContain("setPreferredDate(event.target.value)");
    expect(source).toContain("preferred_date: values.preferred_date");
  });

  it("keeps existing event_request translations available in English and Kiswahili", () => {
    expect(en.event_request.preferred_date).toBe("Preferred Date");
    expect(sw.event_request.preferred_date).toBe("Tarehe Inayopendekezwa");
    expect(en.event_request.my_requests).toBe("My requests");
    expect(sw.event_request.my_requests).toBe("Maombi yangu");
    expect(en.event_request.status_submitted).toBe("Submitted");
    expect(sw.event_request.status_submitted).toBe("Limetumwa");
  });

  it("preserves member-scoped event request query and workflow behavior", () => {
    expect(source).toContain('queryKey: ["event-request-member", churchId, user?.id]');
    expect(source).toContain('queryKey: ["event-requests", churchId, member.data?.id]');
    expect(source).toContain('.from("event_requests")');
    expect(source).toContain('.select("id, type, request_type, status, preferred_date, created_at")');
    expect(source).toContain('.eq("church_id", churchId)');
    expect(source).toContain('.eq("member_id", member.data.id)');
    expect(source).toContain('.order("created_at", { ascending: false })');
    expect(source).toContain('await queryClient.invalidateQueries({ queryKey: ["event-requests", churchId, member.data?.id] })');
  });
});
