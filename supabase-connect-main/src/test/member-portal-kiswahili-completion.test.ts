import { describe, expect, it } from "vitest";

import en from "@/locales/en.json";
import sw from "@/locales/sw.json";
import { getBibleBookDisplayName } from "@/lib/bible-display";

const requiredBibleKeys = [
  "title",
  "description",
  "search_label",
  "search_placeholder",
  "testaments.old",
  "testaments.new",
  "testaments.deuterocanonical",
  "chapter_number",
  "chapter_verse",
  "open_reference",
  "unable_search",
  "unable_books",
  "unable_chapters",
  "no_books",
  "no_chapters",
  "no_verses",
];

function getNestedValue(source: unknown, path: string) {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, source);
}

describe("member portal Kiswahili completion", () => {
  it("keeps Bible UI keys available in English and Kiswahili", () => {
    requiredBibleKeys.forEach((key) => {
      expect(getNestedValue(en.member_portal.bible, key), `missing English key ${key}`).toBeTruthy();
      expect(getNestedValue(sw.member_portal.bible, key), `missing Kiswahili key ${key}`).toBeTruthy();
    });
  });

  it("localizes common Bible book labels without changing English display", () => {
    expect(getBibleBookDisplayName({ name: "Matthew" }, "sw")).toBe("Mathayo");
    expect(getBibleBookDisplayName({ name: "John" }, "sw-TZ")).toBe("Yohana");
    expect(getBibleBookDisplayName({ name: "Psalms" }, "sw")).toBe("Zaburi");
    expect(getBibleBookDisplayName({ name: "Matthew" }, "en")).toBe("Matthew");
  });
});

