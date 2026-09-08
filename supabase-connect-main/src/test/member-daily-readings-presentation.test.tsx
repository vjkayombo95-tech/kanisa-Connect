import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DailyReadingEmptyState,
  DailyReadingErrorState,
  DailyReadingLiturgicalHeader,
  DailyReadingLoadingState,
  DailyReadingReferenceList,
  DailyReadingSourceAttribution,
} from "@/components/portal/daily-readings/DailyReadingPresentation";
import type { DailyReadingEntry, DailyReadingSection } from "@/lib/daily-readings";

let host: HTMLDivElement;
let root: Root;

const baseReadings: DailyReadingSection[] = [
  { id: "first", title: "First Reading", reference: "Isa 7:10-14; 8:10", text: null, bibleReference: null },
  { id: "psalm", title: "Responsorial Psalm", reference: "Ps 24:1-2, 3-4ab, 5-6", text: null, bibleReference: null },
  { id: "gospel", title: "Gospel", reference: "Lk 1:26-38", text: null, bibleReference: null },
];

function reading(overrides: Partial<DailyReadingEntry> = {}): DailyReadingEntry {
  return {
    id: "reading-1",
    date: "2026-09-08",
    source: "cms",
    languageCode: "sw",
    status: "published",
    liturgicalDayId: null,
    celebration: "Kuzaliwa kwa Bikira Maria",
    liturgicalSeason: "Kipindi cha Kawaida",
    liturgicalYear: "A",
    weekdayCycle: "II",
    liturgicalColor: "Nyeupe",
    rank: "Sikukuu",
    lectionaryNumber: "636",
    reflection: null,
    prayer: null,
    isReferenceOnly: true,
    sourceAttribution: null,
    sourceOrganization: null,
    sourcePublication: null,
    sourceYear: null,
    sourceEdition: null,
    readings: baseReadings,
    ...overrides,
  };
}

function render(node: ReactNode) {
  act(() => {
    root.render(node);
  });
}

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("member Daily Readings presentation components", () => {
  it("renders the empty state with calm Kiswahili copy and no retry or error semantics", () => {
    render(<DailyReadingEmptyState />);

    expect(host.textContent).toContain("Masomo ya siku hiyo bado hayajachapishwa.");
    expect(host.textContent).toContain("Tutayaonyesha hapa mara tu yatakapokuwa tayari kwa waumini.");
    expect(host.querySelector("button")).toBeNull();
    expect(host.querySelector('[data-testid="daily-reading-error-state"]')).toBeNull();
  });

  it("renders the error state separately and supports retry", () => {
    const retry = vi.fn();
    render(<DailyReadingErrorState onRetry={retry} />);

    expect(host.textContent).toContain("Hatukuweza kupakia masomo kwa sasa.");
    expect(host.textContent).toContain("Tafadhali jaribu tena.");
    const button = host.querySelector<HTMLButtonElement>("button")!;
    expect(button.getAttribute("aria-label")).toBe("Jaribu kupakia masomo tena");
    act(() => button.click());
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("renders the loading state without fake content", () => {
    render(<DailyReadingLoadingState />);

    expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(host.textContent).not.toContain("Masomo ya siku hiyo bado hayajachapishwa.");
    expect(host.textContent).not.toMatch(/reference pending/i);
    expect(host.textContent).not.toContain("READING_PLACEHOLDER");
  });

  it("renders required reading references using accessible list structure", () => {
    render(<DailyReadingReferenceList readings={baseReadings} />);

    expect(host.querySelector("section[aria-labelledby]")).not.toBeNull();
    expect(host.querySelector("ol")).not.toBeNull();
    expect(host.textContent).toContain("Somo la Kwanza");
    expect(host.textContent).toContain("Isa 7:10-14; 8:10");
    expect(host.textContent).toContain("Zaburi ya Kujibu");
    expect(host.textContent).toContain("Ps 24:1-2, 3-4ab, 5-6");
    expect(host.textContent).toContain("Injili");
    expect(host.textContent).toContain("Lk 1:26-38");
  });

  it("keeps absent optional second reading and gospel acclamation out of the list", () => {
    render(<DailyReadingReferenceList readings={baseReadings} />);

    expect(host.textContent).not.toContain("Somo la Pili");
    expect(host.textContent).not.toContain("Shangilio la Injili");
  });

  it("renders optional second reading and gospel acclamation when present", () => {
    render(
      <DailyReadingReferenceList
        readings={[
          ...baseReadings.slice(0, 2),
          { id: "second", title: "Second Reading", reference: "Rom 8:28-30", text: null, bibleReference: null },
          { id: "gospel_acclamation", title: "Gospel Acclamation", reference: "Alleluia", text: null, bibleReference: null },
          baseReadings[2],
        ]}
      />,
    );

    expect(host.textContent).toContain("Somo la Pili");
    expect(host.textContent).toContain("Rom 8:28-30");
    expect(host.textContent).toContain("Shangilio la Injili");
    expect(host.textContent).toContain("Alleluia");
  });

  it("wraps long references instead of intentionally truncating them", () => {
    const longReference = "Mt 1:1-16, 18-23; Lk 1:26-38; Jn 1:1-18; Rom 8:28-30";
    render(<DailyReadingReferenceList readings={[{ id: "gospel", title: "Gospel", reference: longReference, text: null, bibleReference: null }]} />);

    const reference = host.querySelector('[data-reading-kind="gospel"] p:last-child')!;
    expect(reference.textContent).toBe(longReference);
    expect(reference.className).toContain("break-words");
    expect(reference.className).not.toContain("truncate");
  });

  it("hides absent liturgical metadata without placeholder copy", () => {
    render(
      <DailyReadingLiturgicalHeader
        reading={reading({
          celebration: null,
          liturgicalSeason: null,
          liturgicalColor: null,
          rank: null,
        })}
      />,
    );

    expect(host.textContent).toContain("Masomo ya Leo");
    expect(host.textContent).not.toMatch(/pending|N\/A/i);
  });

  it("renders available liturgical metadata naturally", () => {
    render(<DailyReadingLiturgicalHeader reading={reading()} />);

    expect(host.textContent).toContain("Kuzaliwa kwa Bikira Maria");
    expect(host.textContent).toContain("Kipindi cha Kawaida");
    expect(host.textContent).toContain("Nyeupe");
    expect(host.textContent).toContain("Sikukuu");
  });

  it("renders source attribution only when present and avoids internal provenance", () => {
    render(
      <DailyReadingSourceAttribution
        reading={reading({
          sourceAttribution: "Baraza la Maaskofu Katoliki Tanzania",
          sourceOrganization: "TEC",
          sourcePublication: "Kalenda ya Liturujia",
          sourceYear: 2026,
          sourceEdition: "Toleo la waumini",
        })}
      />,
    );

    expect(host.textContent).toContain("Chanzo:");
    expect(host.textContent).toContain("Baraza la Maaskofu Katoliki Tanzania");
    expect(host.textContent).toContain("TEC");
    expect(host.textContent).toContain("Kalenda ya Liturujia");
    expect(host.textContent).not.toMatch(/import_batch|import item|hash|service_role/i);
  });

  it("renders nothing for absent source attribution", () => {
    render(<DailyReadingSourceAttribution reading={reading({ sourceAttribution: null })} />);

    expect(host.textContent).toBe("");
    expect(host.querySelector('[data-testid="daily-reading-source-attribution"]')).toBeNull();
  });

  it("does not render synthetic placeholders or full scripture text when only references exist", () => {
    render(<DailyReadingReferenceList readings={baseReadings} />);

    expect(host.textContent).not.toContain("READING_PLACEHOLDER");
    expect(host.textContent).not.toMatch(/reference pending/i);
    expect(host.textContent).not.toContain("In the beginning");
  });
});
