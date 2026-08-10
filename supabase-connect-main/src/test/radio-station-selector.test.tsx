import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { orderChurchRadioStations, type ChurchRadioStation } from "@/lib/church-radio";

const mocks = vi.hoisted(() => ({ play: vi.fn() }));
vi.mock("@/contexts/RadioPlayerContext", () => ({ useRadioPlayer: () => ({ play: mocks.play }) }));
import { RadioStationSelector } from "@/components/portal/RadioStationSelector";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const makeStation = (id: string, name: string, sortOrder: number, isFeatured = false, churchId = "church-a"): ChurchRadioStation => ({ id, selectionId: `selection-${id}`, churchId, name, streamUrl: `https://example.com/${id}`, websiteUrl: null, logoUrl: null, description: null, provider: null, streamFormat: null, isActive: true, isApproved: true, healthStatus: null, lastHealthCheckedAt: null, enabled: true, isFeatured, sortOrder });
let container: HTMLDivElement; let root: Root;
function paint(stations: ChurchRadioStation[]) { act(() => root.render(<RadioStationSelector stations={stations} />)); }
function clickText(text: string) { const button = [...container.querySelectorAll("button")].find((item) => item.textContent?.includes(text)); expect(button).toBeDefined(); act(() => button!.dispatchEvent(new MouseEvent("click", { bubbles: true }))); }

describe("RadioStationSelector", () => {
  beforeEach(() => { mocks.play.mockReset(); container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it("renders nothing for zero and the current CTA for one station", () => {
    paint([]); expect(container.innerHTML).toBe("");
    paint([makeStation("a", "Radio A", 0)]); expect(container.textContent).toContain("Listen Now"); expect(container.querySelector('[data-testid="radio-station-selector"]')).toBeNull();
  });

  it("orders featured first, then sort order, then deterministic name", () => {
    const ordered = orderChurchRadioStations([makeStation("c", "Zulu", 1), makeStation("b", "Alpha", 1), makeStation("a", "Featured", 9, true)]);
    expect(ordered.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("expands multiple stations and explicitly switches through the singleton player", () => {
    const stations = [makeStation("b", "Radio B", 1), makeStation("a", "Radio A", 0, true)];
    paint(stations); expect(container.textContent).toContain("Choose Station");
    clickText("Choose Station");
    const names = [...container.querySelectorAll('[data-testid="radio-station-options"] p')].map((item) => item.textContent);
    expect(names[0]).toBe("Radio A"); expect(container.textContent).toContain("Default");
    const listenButtons = [...container.querySelectorAll<HTMLButtonElement>('button[aria-label^="Listen:"]')];
    act(() => listenButtons[0].dispatchEvent(new MouseEvent("click", { bubbles: true })));
    act(() => listenButtons[1].dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(mocks.play.mock.calls.map(([item]) => item.id)).toEqual(["a", "b"]);
  });
});
