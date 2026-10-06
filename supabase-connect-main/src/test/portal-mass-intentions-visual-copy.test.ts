import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("PortalMassIntentions visual copy contract", () => {
  const page = read("src/pages/portal/PortalMassIntentions.tsx");
  const en = JSON.parse(read("src/locales/en.json"));
  const sw = JSON.parse(read("src/locales/sw.json"));
  const massCopy = [
    page,
    JSON.stringify(en.mass_intentions_form),
    JSON.stringify(en.mass_intentions_labels),
    JSON.stringify(sw.mass_intentions_form),
    JSON.stringify(sw.mass_intentions_labels),
  ].join("\n");

  it("keeps Mass Intentions framed as a localized member-facing service", () => {
    expect(page).toContain('t("mass_intentions_form.page_title")');
    expect(page).toContain('t("mass_intentions_form.page_description")');
    expect(page).toContain("Kanisa Connect");
    expect(page).toContain('t("mass_intentions_form.member_context")');
    expect(page).toContain('t("mass_intentions_form.before_submit_title")');
    expect(en.mass_intentions_form.page_title).toBe("Mass Intentions");
    expect(sw.mass_intentions_form.page_title).toBe("Nia za Misa");
  });

  it("uses neutral offering language without checkout claims", () => {
    expect(massCopy).toContain("Kiasi cha sadaka");
    expect(massCopy).toContain("Sadaka ya nia ya Misa inahitajika. Chaguo-msingi ni {{amount}}.");
    expect(massCopy).toContain("Parokia inapokea");
    expect(massCopy).toContain("Ada ya mfumo ({{percent}}%)");
    expect(massCopy).toContain("Jumla ya sadaka");
    expect(sw.mass_intentions_form.submit_and_pay).toBe("Wasilisha Nia");
    expect(en.mass_intentions_form.submit_and_pay).toBe("Submit Intention");
    expect(massCopy).not.toMatch(/Submit & Pay|Wasilisha na Lipa|You pay|Unalipa|Total paid|Jumla iliyolipwa/i);
  });

  it("keeps common status and form actions localized for Kiswahili members", () => {
    expect(sw.mass_intentions_form.my_intentions).toBe("Nia Zangu ({{count}})");
    expect(page).toContain("translateStatus(t, intention.status)");
    expect(sw.common.completed).toBe("Imekamilika");
    expect(sw.mass_intentions_form.offering).toBe("Sadaka: {{amount}}");
    expect(sw.mass_intentions_form.draft_saved).toBe("Rasimu hii inahifadhiwa kwenye kifaa hiki unapoandika.");
    expect(page).toContain('t("common.cancel")');
    expect(sw.common.cancel).toBe("Ghairi");
    expect(page).toContain('value: "other"');
    expect(page).toContain('labelKey: "mass_intentions_labels.other"');
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
