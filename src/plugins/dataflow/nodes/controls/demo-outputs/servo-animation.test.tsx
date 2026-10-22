import { render, screen } from "@testing-library/react";
import React from "react";
import { ServoAnimation } from "./servo-animation";

describe("ServoAnimation", () => {
  function arm() {
    return document.querySelector<HTMLElement>(".servo-part.arm")!;
  }

  it("draws a body and an arm", () => {
    const { container } = render(<ServoAnimation angle={0} />);
    expect(container.querySelector(".servo-part.body")).toBeInTheDocument();
    expect(arm()).toBeInTheDocument();
  });

  it("starts at the angle it is given rather than sweeping up to it", () => {
    render(<ServoAnimation angle={90} />);
    expect(arm().style.transform).toBe("rotate(90deg)");
  });

  // The arm steps towards a new angle rather than jumping, so right after a change it is still
  // where it was. What it must not do is land anywhere outside the sweep.
  it("stays within the sweep while it travels", () => {
    const { rerender } = render(<ServoAnimation angle={0} />);
    rerender(<ServoAnimation angle={180} />);
    const degrees = Number(/rotate\((-?\d+(?:\.\d+)?)deg\)/.exec(arm().style.transform)![1]);
    expect(degrees).toBeGreaterThanOrEqual(0);
    expect(degrees).toBeLessThanOrEqual(180);
  });
});
