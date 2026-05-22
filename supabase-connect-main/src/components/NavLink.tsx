import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { AppLink } from "@/components/AppLink";

interface NavLinkCompatProps {
  to: string;
  end?: boolean;
  className?: string;
  activeClassName?: string;
  children?: React.ReactNode;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, to, end = false, ...props }, ref) => {
    const pathname = typeof window === "undefined" ? "" : window.location.pathname;
    const isActive = end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);

    return (
      <AppLink
        ref={ref}
        to={to}
        className={cn(className, isActive && activeClassName)}
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
