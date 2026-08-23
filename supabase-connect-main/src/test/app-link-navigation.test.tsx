import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { AppLink } from "@/components/AppLink";

function Harness() {
  const location = useLocation();
  return <><AppLink to="/portal/services?tab=all#top">Internal</AppLink><AppLink to="https://example.com">External</AppLink><AppLink to="mailto:uat@example.com">Email</AppLink><AppLink to="tel:+255700000000">Phone</AppLink><AppLink to="/download" download>Download</AppLink><AppLink to="/blank" target="_blank">Blank</AppLink><AppLink to="#section">Hash</AppLink><output>{location.pathname}{location.search}{location.hash}</output></>;
}

describe("AppLink navigation", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); act(() => root.render(<MemoryRouter initialEntries={["/portal"]}><Harness /></MemoryRouter>)); });
  afterEach(() => { act(() => root.unmount()); host.remove(); });

  it("uses React Router for same-origin app navigation", () => {
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    act(() => host.querySelectorAll("a")[0].dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(host.querySelector("output")?.textContent).toBe("/portal/services?tab=all#top");
  });

  it.each([
    ["external", 1, {}],
    ["mailto", 2, {}],
    ["tel", 3, {}],
    ["download", 4, {}],
    ["target blank", 5, {}],
    ["hash", 6, {}],
    ["modified", 0, { ctrlKey: true }],
    ["Command click", 0, { metaKey: true }],
    ["Shift click", 0, { shiftKey: true }],
    ["middle click", 0, { button: 1 }],
  ])("preserves native behavior for %s links", (_label, index, init) => {
    let preventedByAppLink: boolean | undefined;
    const stopNativeNavigation = (nativeEvent: Event) => {
      preventedByAppLink = nativeEvent.defaultPrevented;
      nativeEvent.preventDefault();
    };
    document.addEventListener("click", stopNativeNavigation, { once: true });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init });
    act(() => host.querySelectorAll("a")[index].dispatchEvent(event));
    expect(preventedByAppLink).toBe(false);
  });
});
