import React from "react";
import { render } from "@testing-library/react";
import { RawTimeline } from "./raw-timeline";

function filledFraction(container: HTMLElement) {
  const filled = container.querySelectorAll(".segment.filled");
  return [...filled].reduce((sum, el) => sum + parseFloat((el as HTMLElement).style.width), 0);
}

describe("RawTimeline", () => {
  it("renders filled spans covering the cached fraction of the range", () => {
    // days 1..4, cached {1, 2} → 50% filled
    const { container } = render(<RawTimeline highlightedDays={new Set([1, 2])} firstDay={1} lastDay={4} />);
    expect(filledFraction(container)).toBeCloseTo(50);
  });

  it("renders no filled span when nothing is cached", () => {
    const { container } = render(<RawTimeline highlightedDays={new Set()} firstDay={1} lastDay={10} />);
    expect(container.querySelectorAll(".segment.filled").length).toBe(0);
    expect(container.querySelectorAll(".segment.empty").length).toBe(1);
  });

  it("renders a partial segment alongside filled and empty spans when partialDays is given", () => {
    const { container } = render(
      <RawTimeline highlightedDays={new Set([1])} partialDays={new Set([2])} firstDay={1} lastDay={4} />
    );
    expect(container.querySelectorAll(".segment.filled").length).toBe(1);
    expect(container.querySelectorAll(".segment.partial").length).toBe(1);
    expect(container.querySelectorAll(".segment.empty").length).toBe(1);
  });

  it("renders no partial segments when partialDays is omitted", () => {
    const { container } = render(<RawTimeline highlightedDays={new Set([1, 2])} firstDay={1} lastDay={4} />);
    expect(container.querySelectorAll(".segment.partial").length).toBe(0);
    expect(filledFraction(container)).toBeCloseTo(50);
  });
});
