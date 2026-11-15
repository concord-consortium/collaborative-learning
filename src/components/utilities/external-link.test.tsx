import React from "react";
import { render, screen } from "@testing-library/react";
import { ExternalLink } from "./external-link";

describe("ExternalLink", () => {
  it("opens in a new tab and says so to screen readers", () => {
    render(<ExternalLink href="https://example.com/" className="extra">Example</ExternalLink>);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://example.com/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveClass("extra");
    expect(link).toHaveAccessibleName("Example (opens in a new tab)");
    expect(link.querySelector("[aria-hidden]")).toBeNull();
  });

  it("shows a decorative arrow when asked", () => {
    render(<ExternalLink href="https://example.com/" showArrow={true}>Example</ExternalLink>);
    const link = screen.getByRole("link");
    const arrow = link.querySelector("[aria-hidden='true']");
    expect(arrow).toHaveTextContent("↗");
    expect(link).toHaveAccessibleName("Example (opens in a new tab)");
  });
});
