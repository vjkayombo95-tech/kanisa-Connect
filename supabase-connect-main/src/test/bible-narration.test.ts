import { describe, expect, it } from "vitest";

import {
  DEFAULT_SWAHILI_INTRO_TEMPLATE,
  buildBibleNarrationText,
  getSwahiliBookReference,
  prepareVerseForNarration,
  swahiliNumberToWords,
} from "@/lib/bible-narration";

describe("Bible narration engine", () => {
  it("renders Swahili chapter numbers for spoken narration", () => {
    expect(swahiliNumberToWords(1)).toBe("moja");
    expect(swahiliNumberToWords(2)).toBe("mbili");
    expect(swahiliNumberToWords(3)).toBe("tatu");
    expect(swahiliNumberToWords(23)).toBe("ishirini na tatu");
    expect(swahiliNumberToWords(119)).toBe("mia moja kumi na tisa");
  });

  it("uses natural Swahili book references", () => {
    expect(getSwahiliBookReference({ name: "Zaburi" })).toBe("kitabu cha Zaburi");
    expect(getSwahiliBookReference({ name: "Yohane" })).toBe("Injili ya Yohane");
  });

  it("removes embedded verse numbers without changing scripture wording", () => {
    expect(prepareVerseForNarration({ verse_text: "1 Bwana ndiye mchungaji wangu." })).toBe(
      "Bwana ndiye mchungaji wangu.",
    );
    expect(prepareVerseForNarration({ verse_text: "Hunilaza katika malisho ya majani mabichi." })).toBe(
      "Hunilaza katika malisho ya majani mabichi.",
    );
  });

  it("builds narration-ready text with intro, paragraph breaks, and no spoken verse numbers", () => {
    const text = buildBibleNarrationText({
      translation: { code: "sw-open-bible", language_code: "sw" },
      book: { name: "Zaburi" },
      chapter: { chapter_number: 23 },
      verses: [
        { verse_number: 1, verse_text: "1 Bwana ndiye mchungaji wangu; Sitapungukiwa na kitu." },
        { verse_number: 2, verse_text: "2 Hunilaza katika malisho ya majani mabichi." },
        { verse_number: 3, verse_text: "Hunihuisha nafsi yangu.", paragraph_break_before: true },
      ],
    });

    expect(text).toContain("Tusikilize Neno la Mungu kutoka kitabu cha Zaburi, sura ya ishirini na tatu.");
    expect(text).not.toContain("1 Bwana");
    expect(text).not.toContain("2 Hunilaza");
    expect(text).toContain("Bwana ndiye mchungaji wangu; Sitapungukiwa na kitu.");
    expect(text).toContain("Hunilaza katika malisho ya majani mabichi.\n\nHunihuisha nafsi yangu.");
  });

  it("keeps the outro configurable and disabled by default", () => {
    const base = {
      translation: { language_code: "sw" },
      book: { name: "Zaburi" },
      chapter: { chapter_number: 1 },
      verses: [{ verse_text: "Heri mtu yule." }],
    };

    expect(buildBibleNarrationText(base)).not.toContain("Hilo ndilo Neno la Mungu.");
    expect(buildBibleNarrationText({ ...base, options: { includeOutro: true } })).toContain(
      "Hilo ndilo Neno la Mungu.",
    );
    expect(DEFAULT_SWAHILI_INTRO_TEMPLATE).toContain("{book_reference}");
  });
});
