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

  // The arm's ink runs only upwards from its pivot, so an unrotated arm points straight up over
  // the node's dropdown. Keeping the sweep between left and right through the bottom is what
  // stops it reaching the controls above it.
  it.each([
    ["one end of the sweep", 0, 270],
    ["the middle, pointing down", 90, 180],
    ["the other end", 180, 90]
  ])("points sideways or down at %s", (_label, angle, expected) => {
    render(<ServoAnimation angle={angle} />);
    expect(armDegrees()).toBe(expected);
  });

  // It steps towards a new angle rather than jumping, so just after a change it is still on its
  // way. Wherever it is, it must not be above the hub.
  it("stays below the hub while it travels", () => {
    const { rerender } = render(<ServoAnimation angle={0} />);
    rerender(<ServoAnimation angle={180} />);
    expect(armDegrees()).toBeGreaterThanOrEqual(90);
    expect(armDegrees()).toBeLessThanOrEqual(270);
  });
});
