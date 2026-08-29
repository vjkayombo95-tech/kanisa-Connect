import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Search } from "lucide-react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChurchAdminCommandMenu } from "@/components/church-admin/ChurchAdminCommandMenu";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ staffWorkspace: "admin" }),
}));

vi.mock("@/components/staff-mobile/StaffMobileExperience", () => ({
  useVisibleStaffServices: () => ({
    services: [
      { id: "members", label: "Members", group: "People", route: "/church-admin/members", icon: Search },
      { id: "contributions", label: "Contributions", group: "Finance", route: "/church-admin/contributions", icon: Search },
      { id: "announcements", label: "Announcements", group: "Communication", route: "/church-admin/announcements", icon: Search },
    ],
  }),
}));

let host: HTMLDivElement;
let root: Root;

function RouteOpened() {
  return <p>Route opened: {useLocation().pathname}</p>;
}

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(
    <MemoryRouter initialEntries={["/church-admin"]}>
      <div style={{ transform: "translateZ(0)" }}><ChurchAdminCommandMenu /></div>
      <Routes><Route path="/church-admin/:service" element={<RouteOpened />} /></Routes>
    </MemoryRouter>,
  ));
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const openMenu = (modifier: "ctrlKey" | "metaKey") => {
  act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", [modifier]: true, bubbles: true })));
  return document.querySelector<HTMLInputElement>("div.fixed input")!;
};

describe("Church Admin command menu viewport positioning", () => {
  it("portals the rendered palette outside a transformed header and focuses its input", () => {
    const input = openMenu("ctrlKey");
    const dialog = input.closest<HTMLDivElement>("div.fixed")!;

    expect(dialog.parentElement).toBe(document.body);
    expect(dialog.className).toContain("w-[calc(100vw-2rem)]");
    expect(dialog.className).toContain("max-h-[calc(100dvh-2rem)]");
    expect(input).toBe(document.activeElement);
    expect(document.documentElement.scrollWidth).toBe(document.documentElement.clientWidth);

    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(document.querySelector("div.fixed input")).toBeNull();
  });

  it.each([
    ["Members", "/church-admin/members"],
    ["Contributions", "/church-admin/contributions"],
    ["Announcements", "/church-admin/announcements"],
  ])("retains authorized search and navigation for %s", (label, route) => {
    const input = openMenu("metaKey");
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, label);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const serviceButtons = [...document.querySelectorAll<HTMLButtonElement>("button")];
    const service = serviceButtons.find((button) => button.textContent?.includes(label));
    expect(service).toBeDefined();
    expect(serviceButtons.filter((button) => ["Members", "Contributions", "Announcements"].some((name) => button.textContent?.includes(name)))).toHaveLength(1);

    act(() => service!.click());
    expect(document.body.textContent).toContain(`Route opened: ${route}`);
  });
});
