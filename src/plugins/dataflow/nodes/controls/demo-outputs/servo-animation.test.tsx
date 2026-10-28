import { render } from "@testing-library/react";
import React from "react";
import { ServoAnimation } from "./servo-animation";

describe("ServoAnimation", () => {
  function armDegrees() {
    const arm = document.querySelector<HTMLElement>(".servo-part.arm")!;
    return Number(/rotate\((-?\d+(?:\.\d+)?)deg\)/.exec(arm.style.transform)![1]);
  }

  it("draws a body and an arm", () => {
    const { container } = render(<ServoAnimation angle={0} />);
    expect(container.querySelector(".servo-part.body")).toBeInTheDocument();
    expect(container.querySelector(".servo-part.arm")).toBeInTheDocument();
  });

  // The body lies on its side with the hub at its right, so the arm sweeps the space to the
  // right of it rather than back across the body.
  it.each([
    ["the start of the sweep, pointing up", 0, 0],
    ["the middle, pointing right", 90, 90],
    ["the end, pointing down", 180, 180]
  ])("points %s", (_label, angle, expected) => {
    render(<ServoAnimation angle={angle} />);
    expect(armDegrees()).toBe(expected);
  });

  // It steps towards a new angle rather than jumping, so just after a change it is still on its
  // way. Wherever it is, it must stay within the half turn the servo has.
  it("stays within the sweep while it travels", () => {
    const { rerender } = render(<ServoAnimation angle={0} />);
    rerender(<ServoAnimation angle={180} />);
    expect(armDegrees()).toBeGreaterThanOrEqual(0);
    expect(armDegrees()).toBeLessThanOrEqual(180);
  });
});
