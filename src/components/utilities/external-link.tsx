import React from "react";
import { VisuallyHidden } from "@chakra-ui/react";

interface IProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "target" | "rel"> {
  href: string;
  showArrow?: boolean;
  children: React.ReactNode;
}

// A link that opens in a new tab and tells screen-reader users that it does.
export function ExternalLink({ href, showArrow, children, ...others }: IProps) {
  return (
    <a {...others} href={href} target="_blank" rel="noopener noreferrer">
      {children}
      {showArrow && <span aria-hidden="true"> ↗</span>}
      <VisuallyHidden> (opens in a new tab)</VisuallyHidden>
    </a>
  );
}
