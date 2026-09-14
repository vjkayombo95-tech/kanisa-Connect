import { act, type ReactNode, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function render(node: ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(node));
  return { host, root };
}

describe("DropdownMenu controlled and uncontrolled behavior", () => {
  let mounted: { host: HTMLDivElement; root: Root } | null = null;

  afterEach(() => {
    if (mounted) {
      act(() => mounted?.root.unmount());
      mounted.host.remove();
    }
  });

  beforeEach(() => {
    mounted = null;
  });

  it("keeps uncontrolled menus self-managed", () => {
    mounted = render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Menu item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    expect(mounted.host).not.toHaveTextContent("Menu item");

    act(() => (mounted?.host.querySelector("button") as HTMLButtonElement).click());
    expect(mounted.host).toHaveTextContent("Menu item");

    act(() => (mounted?.host.querySelector("button") as HTMLButtonElement).click());
    expect(mounted.host).not.toHaveTextContent("Menu item");
  });

  it("delegates state through controlled open and onOpenChange", () => {
    const onOpenChange = vi.fn();

    function ControlledDropdown() {
      const [open, setOpen] = useState(false);

      return (
        <DropdownMenu
          open={open}
          onOpenChange={(nextOpen) => {
            onOpenChange(nextOpen);
            setOpen(nextOpen);
          }}
        >
          <DropdownMenuTrigger>Open controlled menu</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Controlled item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    mounted = render(<ControlledDropdown />);

    act(() => (mounted?.host.querySelector("button") as HTMLButtonElement).click());
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(mounted.host).toHaveTextContent("Controlled item");

    act(() => (mounted?.host.querySelector("button") as HTMLButtonElement).click());
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(mounted.host).not.toHaveTextContent("Controlled item");
  });
});
