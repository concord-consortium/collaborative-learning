import React from "react";
import { render, screen } from "@testing-library/react";
import { GroupComponent, GroupObject } from "./group";
import { RectangleObject } from "./rectangle";
import { useDrawingScale } from "../components/drawing-scale-context";
import { TextObject } from "./text";

import "../drawing-registration";

// Patch RectangleComponent to render the scale context for the test
jest.mock("./rectangle", () => {
  const actual = jest.requireActual("./rectangle");
  return {
    ...actual,
    RectangleComponent: ({ model }: any) => {
      const { scaleX, scaleY } = useDrawingScale();
      return (<text data-testid="scale">{`scaleX:${scaleX},scaleY:${scaleY}`}</text>);
    }
  };
});

// Minimal mock for useReadOnlyContext
jest.mock("../../../components/document/read-only-context", () => ({
  useReadOnlyContext: () => false
}));

// Minimal mock for Transformable
jest.mock("../components/transformable", () => ({
  Transformable: ({ children }: { children: React.ReactNode }) => children
}));

// Suppress React/JSDOM warnings about unrecognized SVG tags
let originalConsoleError: typeof console.error;
beforeAll(() => {
  originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    if (typeof args[0] === "string" && args[0].includes("is unrecognized in this browser")) {
      return;
    }
    originalConsoleError(...args);
  };
});
afterAll(() => {
  console.error = originalConsoleError;
});

describe("GroupComponent scale context with MST models", () => {
  it("provides the correct scale to children via context", () => {
    // Create a rectangle MST object as the child
    const rect = RectangleObject.create({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      fill: "#fff",
      stroke: "#000",
      strokeDashArray: "",
      strokeWidth: 1
    });
    // Create a group MST object with known width/height
    const group = GroupObject.create({
      type: "group",
      x: 0,
      y: 0,
      width: 5,
      height: 7,
      objects: [rect]
    });
    render(<GroupComponent model={group} />);
    expect(screen.getByTestId("scale")).toHaveTextContent("scaleX:5,scaleY:7");
  });

  it("provides the correct scale to children in nested groups", () => {
    // Create a rectangle MST object as the child
    const rect = RectangleObject.create({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      fill: "#fff",
      stroke: "#000",
      strokeDashArray: "",
      strokeWidth: 1
    });
    // Create an inner group MST object with width 0.5 and height 0.2
    const innerGroup = GroupObject.create({
      type: "group",
      x: 0,
      y: 0,
      width: 0.5,
      height: 0.2,
      objects: [rect]
    });
    // Create an outer group MST object
    const outerGroup = GroupObject.create({
      type: "group",
      x: 0,
      y: 0,
      width: 5,
      height: 3,
      objects: [innerGroup]
    });
    render(<GroupComponent model={outerGroup} />);
    expect(screen.getByTestId("scale")).toHaveTextContent("scaleX:2.5,scaleY:0.6");
  });

  it("renders a Text object inside a group with a <g> transform that is the reciprocal of the scaling", () => {
    const text = TextObject.create({
      type: "text",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      stroke: "#000",
      text: "Hello"
    });
    const group = GroupObject.create({
      type: "group",
      x: 0,
      y: 0,
      width: 2,
      height: 4,
      objects: [text]
    });
    const { container } = render(<GroupComponent model={group} />);
    const g = container.querySelector("g.text");
    expect(g).toHaveAttribute("transform", "scale(0.5, 0.25)");
  });
});
