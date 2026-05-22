import { AnchorHTMLAttributes, MouseEvent, forwardRef } from "react";

type AppLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: string;
};

function isModifiedEvent(event: MouseEvent<HTMLAnchorElement>) {
  return event.metaKey || event.altKey || event.ctrlKey || event.shiftKey;
}

function isExternalUrl(to: string) {
  return /^(https?:)?\/\//.test(to) || to.startsWith("mailto:") || to.startsWith("tel:");
}

const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(
  ({ to, onClick, target, rel, ...props }, ref) => {
    const safeRel = target === "_blank" ? rel ?? "noreferrer noopener" : rel;

    return (
      <a
        ref={ref}
        href={to}
        target={target}
        rel={safeRel}
        onClick={(event) => {
          onClick?.(event);

          if (
            event.defaultPrevented ||
            typeof window === "undefined" ||
            target === "_blank" ||
            isModifiedEvent(event) ||
            isExternalUrl(to)
          ) {
            return;
          }

          event.preventDefault();
          window.location.assign(to);
        }}
        {...props}
      />
    );
  },
);

AppLink.displayName = "AppLink";

export { AppLink };
