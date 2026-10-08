import { render } from "@testing-library/react";
import React from "react";
import { EventShape } from "./event-shape";

describe("EventShape", () => {
  function renderShape(colorWord?: string, size?: number) {
    const { container } = render(<EventShape colorWord={colorWord} size={size} />);
    return container.querySelector("svg")!;
  }

  it("gives each event color its own shape", () => {
    expect(renderShape("blue").querySelectorAll("rect")).toHaveLength(1);
    expect(renderShape("orange").querySelector("circle")).toBeInTheDocument();
    expect(renderShape("red").querySelector("polygon")).toHaveAttribute("points", "6,0.5 11.5,11.5 0.5,11.5");
    expect(renderShape("yellow").querySelector("polygon")).toHaveAttribute("points", "0.5,0.5 11.5,0.5 6,11.5");
    expect(renderShape("magenta").querySelectorAll("rect")).toHaveLength(2);
    expect(renderShape("purple").querySelector("polygon")).toHaveAttribute("points", "6,0.5 11.5,6 6,11.5 0.5,6");
    expect(renderShape("unknown")).toHaveTextContent("?");
    expect(renderShape(undefined)).toHaveTextContent("?");
  });

  it("is colored by its event color", () => {
    expect(renderShape("purple")).toHaveClass("event-shape", "purple-event");
    expect(renderShape("unknown")).toHaveClass("event-shape", "default-event");
  });

  it("is 12px unless given a size", () => {
    expect(renderShape("blue")).toHaveAttribute("width", "12");
    expect(renderShape("blue", 6)).toHaveAttribute("width", "6");
    expect(renderShape("blue", 6)).toHaveAttribute("height", "6");
  });

  it("is hidden from assistive technology", () => {
    expect(renderShape("blue")).toHaveAttribute("aria-hidden", "true");
  });
});
