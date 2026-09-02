import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("PortalMassIntentions visual copy contract", () => {
  const page = read("src/pages/portal/PortalMassIntentions.tsx");
  const en = read("src/locales/en.json");
  const sw = read("src/locales/sw.json");
  const massCopy = `${page}\n${en}\n${sw}`;

  it("keeps Nia za Misa framed as a member-facing service", () => {
    expect(page).toContain(">Nia za Misa</h1>");
    expect(page).toContain("Wasilisha nia yako kwa Misa utakayochagua");
    expect(page).toContain("Kanisa Connect");
    expect(page).toContain("Nia zako zinaunganishwa na ushiriki wako wa parokia.");
    expect(page).toContain("Kabla ya kuwasilisha");
  });

  it("uses neutral offering language without checkout claims", () => {
    expect(massCopy).toContain("Kiasi cha sadaka");
    expect(massCopy).toContain("Sadaka ya nia ya Misa inahitajika. Chaguo-msingi ni {{amount}}.");
    expect(massCopy).toContain("Parokia inapokea");
    expect(massCopy).toContain("Ada ya mfumo ({{percent}}%)");
    expect(massCopy).toContain("Jumla ya sadaka");
    expect(massCopy).toContain('"submit_and_pay": "Wasilisha Nia"');
    expect(massCopy).toContain('"submit_and_pay": "Submit Intention"');
    expect(massCopy).not.toMatch(/Submit & Pay|Wasilisha na Lipa|You pay|Unalipa|Total paid|Jumla iliyolipwa/i);
  });

  it("keeps common status and form actions localized for Kiswahili members", () => {
    expect(sw).toContain('"my_intentions": "Nia Zangu ({{count}})"');
    expect(sw).toContain('"completed": "Imekamilika"');
    expect(sw).toContain('"offering": "Sadaka: {{amount}}"');
    expect(sw).toContain('"draft_saved": "Rasimu hii inahifadhiwa kwenye kifaa hiki unapoandika."');
    expect(sw).toContain('"cancel": "Ghairi"');
    expect(page).toContain('label: "Nyingine"');
    expect(page).not.toContain('label: "Other"');
  });

  it("does not introduce frontend gateway/provider semantics", () => {
    expect(massCopy).not.toMatch(/stripe|paypal|checkout|payment_intent|paymentIntent|gateway|tokenization/i);
    expect(page).toContain("submitPortalMassIntentionForOccurrence({");
  });

  it("keeps the current UI mobile-conscious without locking the whole layout", () => {
    expect(page).toContain("pb-28");
    expect(page).toContain("min-w-0");
    expect(page).toContain("max-w-6xl");
  });
});
