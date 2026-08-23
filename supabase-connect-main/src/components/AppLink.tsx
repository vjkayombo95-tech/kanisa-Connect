import { AnchorHTMLAttributes, MouseEvent, forwardRef } from "react";
import { useNavigate } from "react-router-dom";

type AppLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: string;
};

function isModifiedEvent(event: MouseEvent<HTMLAnchorElement>) {
  return event.metaKey || event.altKey || event.ctrlKey || event.shiftKey;
}

function isExternalUrl(to: string) {
  return to.startsWith("mailto:") || to.startsWith("tel:");
}

const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(
  ({ to, onClick, target, rel, ...props }, ref) => {
    const navigate = useNavigate();
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
            event.button !== 0 ||
            (target && target !== "_self") ||
            props.download !== undefined ||
            isModifiedEvent(event) ||
            isExternalUrl(to) ||
            to.startsWith("#")
          ) {
            return;
          }

          const url = new URL(to, window.location.href);
          if (url.origin !== window.location.origin) return;

          event.preventDefault();
          navigate(`${url.pathname}${url.search}${url.hash}`);
        }}
        {...props}
      />
    );
  },
);

AppLink.displayName = "AppLink";

export { AppLink };
