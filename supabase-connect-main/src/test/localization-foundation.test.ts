import { describe, expect, it } from "vitest";

import i18n from "@/i18n";
import { getWorkspaceNavigationItems } from "@/components/workspace/registry";
import { answerKanisaAIConversation, createKanisaAIContext, decideKanisaAIRoute, routeKanisaAIRequest } from "@/lib/ai";
import { classifyKanisaIntent } from "@/lib/ai/intent";
import {
  getStatusLabelKey,
  preferLocalizedContent,
  resolveInitialAppLanguage,
  type AppLanguage,
} from "@/lib/localization";

describe("English/Kiswahili localization foundation", () => {
  it("uses the Tanzania pilot default for the Member Portal and honors persisted preference", () => {
    expect(resolveInitialAppLanguage({ pathname: "/portal" })).toBe("sw");
    expect(resolveInitialAppLanguage({ pathname: "/church-admin" })).toBe("en");
    expect(resolveInitialAppLanguage({ storedLanguage: "en", pathname: "/portal" })).toBe("en");
    expect(resolveInitialAppLanguage({ storedLanguage: "bad", pathname: "/portal" })).toBe("sw");
  });

  it("resolves English and Kiswahili translation keys with English fallback", () => {
    i18n.changeLanguage("en");
    expect(i18n.t("navigation.items.daily-readings")).toBe("Daily Readings");
    expect(i18n.t("missing.key", "Fallback Copy")).toBe("Fallback Copy");

    i18n.changeLanguage("sw");
    expect(i18n.t("navigation.items.daily-readings")).toBe("Masomo ya Leo");
    expect(i18n.t("ai.placeholder.member")).toContain("Biblia");
  });

  it("keeps member navigation ownership while resolving Kiswahili labels", () => {
    i18n.changeLanguage("sw");
    const items = getWorkspaceNavigationItems("member");
    const dailyReadings = items.find((item) => item.id === "daily-readings");

    expect(dailyReadings?.to).toBe("/portal/daily-readings");
    expect(i18n.t(`navigation.items.${dailyReadings?.id}`, dailyReadings?.label ?? "")).toBe("Masomo ya Leo");
  });

  it("understands core Kiswahili Kanisa AI intents", () => {
    expect(classifyKanisaIntent("Masomo ya leo ni yapi?")).toBe("OPEN_DAILY_READINGS");
    expect(classifyKanisaIntent("Nipatie sala ya uponyaji")).toBe("OPEN_PRAYER_LIBRARY");
    expect(classifyKanisaIntent("Onyesha michango yangu")).toBe("OPEN_CONTRIBUTIONS");
    expect(classifyKanisaIntent("Fungua Biblia")).toBe("OPEN_BIBLE");
  });

  it("does not let Kiswahili finance analytics bypass member workspace authorization", () => {
    const context = createKanisaAIContext({
      workspace: "member",
      role: "member",
      church: { id: "church-1" },
      tenant: { id: "church-1" },
      route: "/portal/kanisa-ai",
      language: "sw",
    });

    const personal = decideKanisaAIRoute({ input: "Onyesha michango yangu", context });
    const parishWide = routeKanisaAIRequest({ input: "Onyesha mwenendo wa michango ya parokia", context });

    expect(personal.allowed).toBe(true);
    expect(personal.targetRoute).toBe("/portal/contribution-history");
    expect(parishWide.type).toBe("permission_denied");
  });

  it("prefers sw Catholic content and labels English fallback explicitly without changing stored status", () => {
    const rows = [
      { id: "en", status: "published", language: { code: "en" } },
      { id: "sw", status: "published", language: { code: "sw" } },
    ];
    const swMatch = preferLocalizedContent(rows, "sw", (item) => item.language.code);
    const fallback = preferLocalizedContent([rows[0]], "sw", (item) => item.language.code);

    expect(swMatch.item?.id).toBe("sw");
    expect(swMatch.usedFallback).toBe(false);
    expect(fallback.item?.id).toBe("en");
    expect(fallback.usedFallback).toBe(true);
    expect(getStatusLabelKey(rows[0].status)).toBe("status.published");

    i18n.changeLanguage("sw");
    expect(i18n.t(getStatusLabelKey(rows[0].status))).toBe("Imechapishwa");
    expect(rows[0].status).toBe("published");
  });

  it("formats locale-sensitive numbers without changing values", () => {
    const value = 125000;
    const language: AppLanguage = "sw";
    expect(new Intl.NumberFormat(language === "sw" ? "sw-TZ" : "en-US").format(value)).toContain("125");
    expect(value).toBe(125000);
  });

  it("returns Kiswahili labels for member portal Daily Readings conversation responses", () => {
    const context = createKanisaAIContext({
      workspace: "member",
      role: "member",
      church: { id: "church-1" },
      tenant: { id: "church-1" },
      route: "/portal/kanisa-ai",
      language: "sw",
    });

    const response = answerKanisaAIConversation("Masomo ya leo", context);

    expect(response.title).toBe("Hakuna Somo la Leo Lililopakiwa");
    expect(response.actions[0]?.label).toBe("Fungua Masomo ya Leo");
  });

  it("keeps member portal chrome translated while treating authored content as separate language data", () => {
    i18n.changeLanguage("sw");

    expect(i18n.t("member_portal.daily_readings.title")).toBe("Masomo ya Leo");
    expect(i18n.t("member_portal.prayer_detail.library")).toBe("Maktaba ya Sala");
    expect(i18n.t("member_portal.content_language.english_fallback")).toBe("Maudhui ya Kiingereza");
  });
});
