import { fireEvent, render, screen } from "@testing-library/react";
import React, { useRef } from "react";
import { useRovingTabindex } from "./use-roving-tabindex";

// Toolbar with one group of buttons
function TestToolbar({ buttonLabels }: { buttonLabels: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { handleKeyDown } = useRovingTabindex(containerRef);

  return (
    <div ref={containerRef} data-testid="toolbar" role="toolbar" onKeyDown={handleKeyDown}>
      {buttonLabels.map(label => (
        <button key={label} data-testid={`btn-${label}`} type="button">{label}</button>
      ))}
    </div>
  );
}

// Toolbar with multiple groups of buttons (mimics upper/lower toolbar sections)
function GroupedTestToolbar() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { handleKeyDown } = useRovingTabindex(containerRef);

  return (
    <div ref={containerRef} data-testid="toolbar" role="toolbar" onKeyDown={handleKeyDown}>
      <div role="group">
        <button data-testid="btn-A" type="button">A</button>
        <button data-testid="btn-B" type="button">B</button>
      </div>
      <div role="group">
        <button data-testid="btn-C" type="button">C</button>
        <button data-testid="btn-D" type="button">D</button>
      </div>
    </div>
  );
}

describe("useRovingTabindex", () => {

  it("sets first button to tabIndex=0 and others to tabIndex=-1", () => {
    render(<TestToolbar buttonLabels={["A", "B", "C"]} />);
    expect(screen.getByTestId("btn-A")).toHaveAttribute("tabindex", "0");
    expect(screen.getByTestId("btn-B")).toHaveAttribute("tabindex", "-1");
    expect(screen.getByTestId("btn-C")).toHaveAttribute("tabindex", "-1");
  });

  it("moves focus forward with ArrowDown", () => {
    render(<TestToolbar buttonLabels={["A", "B", "C"]} />);
    const btnA = screen.getByTestId("btn-A");
    const btnB = screen.getByTestId("btn-B");

    btnA.focus();
    fireEvent.keyDown(screen.getByTestId("toolbar"), { key: "ArrowDown" });

    expect(document.activeElement).toBe(btnB);
    expect(btnA).toHaveAttribute("tabindex", "-1");
    expect(btnB).toHaveAttribute("tabindex", "0");
  });

  it("moves focus forward with ArrowRight", () => {
    render(<TestToolbar buttonLabels={["A", "B", "C"]} />);
    const btnA = screen.getByTestId("btn-A");
    const btnB = screen.getByTestId("btn-B");

    btnA.focus();
    fireEvent.keyDown(screen.getByTestId("toolbar"), { key: "ArrowRight" });

    expect(document.activeElement).toBe(btnB);
    expect(btnB).toHaveAttribute("tabindex", "0");
  });

  it("moves focus backward with ArrowUp", () => {
    render(<TestToolbar buttonLabels={["A", "B", "C"]} />);
    const toolbar = screen.getByTestId("toolbar");
    const btnA = screen.getByTestId("btn-A");
    const btnB = screen.getByTestId("btn-B");

    // Move to B first
    btnA.focus();
    fireEvent.keyDown(toolbar, { key: "ArrowDown" });
    expect(document.activeElement).toBe(btnB);

    // Move back to A
    fireEvent.keyDown(toolbar, { key: "ArrowUp" });
    expect(document.activeElement).toBe(btnA);
    expect(btnA).toHaveAttribute("tabindex", "0");
    expect(btnB).toHaveAttribute("tabindex", "-1");
  });

  it("moves focus backward with ArrowLeft", () => {
    render(<TestToolbar buttonLabels={["A", "B", "C"]} />);
    const toolbar = screen.getByTestId("toolbar");
    const btnA = screen.getByTestId("btn-A");

    btnA.focus();
    fireEvent.keyDown(toolbar, { key: "ArrowDown" });
    fireEvent.keyDown(toolbar, { key: "ArrowLeft" });

    expect(document.activeElement).toBe(btnA);
  });

  it("Home moves focus to first button", () => {
    render(<TestToolbar buttonLabels={["A", "B", "C"]} />);
    const toolbar = screen.getByTestId("toolbar");
    const btnA = screen.getByTestId("btn-A");

    // Move to the last button
    btnA.focus();
    fireEvent.keyDown(toolbar, { key: "End" });

    // Home goes back to first
    fireEvent.keyDown(toolbar, { key: "Home" });
    expect(document.activeElement).toBe(btnA);
    expect(btnA).toHaveAttribute("tabindex", "0");
  });

  it("End moves focus to last button", () => {
    render(<TestToolbar buttonLabels={["A", "B", "C"]} />);
    const toolbar = screen.getByTestId("toolbar");
    const btnA = screen.getByTestId("btn-A");
    const btnB = screen.getByTestId("btn-B");
    const btnC = screen.getByTestId("btn-C");

    btnA.focus();
    fireEvent.keyDown(toolbar, { key: "End" });

    expect(document.activeElement).toBe(btnC);
    expect(btnC).toHaveAttribute("tabindex", "0");
    expect(btnA).toHaveAttribute("tabindex", "-1");
    expect(btnB).toHaveAttribute("tabindex", "-1");
  });

  it("does not wrap around at the beginning", () => {
    render(<TestToolbar buttonLabels={["A", "B", "C"]} />);
    const toolbar = screen.getByTestId("toolbar");
    const btnA = screen.getByTestId("btn-A");

    btnA.focus();
    fireEvent.keyDown(toolbar, { key: "ArrowUp" });

    // Focus stays on first button
    expect(document.activeElement).toBe(btnA);
    expect(btnA).toHaveAttribute("tabindex", "0");
  });

  it("does not wrap around at the end", () => {
    render(<TestToolbar buttonLabels={["A", "B", "C"]} />);
    const toolbar = screen.getByTestId("toolbar");
    const btnA = screen.getByTestId("btn-A");
    const btnC = screen.getByTestId("btn-C");

    btnA.focus();
    fireEvent.keyDown(toolbar, { key: "End" });
    fireEvent.keyDown(toolbar, { key: "ArrowDown" });

    // Focus stays on last button
    expect(document.activeElement).toBe(btnC);
    expect(btnC).toHaveAttribute("tabindex", "0");
  });

  it("does not preventDefault for keys the hook does not handle", () => {
    render(<TestToolbar buttonLabels={["A", "B"]} />);
    const toolbar = screen.getByTestId("toolbar");
    const btnA = screen.getByTestId("btn-A");

    btnA.focus();
    const escapeEvent = fireEvent.keyDown(toolbar, { key: "Escape" });
    expect(escapeEvent).toBe(true);

    const enterEvent = fireEvent.keyDown(toolbar, { key: "Enter" });
    expect(enterEvent).toBe(true);
  });

  it("updates roving target when a button is focused directly (e.g., mouse click)", () => {
    render(<TestToolbar buttonLabels={["A", "B", "C"]} />);
    const toolbar = screen.getByTestId("toolbar");
    const btnA = screen.getByTestId("btn-A");
    const btnC = screen.getByTestId("btn-C");

    // Directly focus the third button (simulating a mouse click)
    btnC.focus();

    expect(btnC).toHaveAttribute("tabindex", "0");
    expect(btnA).toHaveAttribute("tabindex", "-1");

    // Arrow navigation should now work relative to button C
    fireEvent.keyDown(toolbar, { key: "ArrowUp" });
    expect(document.activeElement).toBe(screen.getByTestId("btn-B"));
  });

  it("navigates seamlessly across groups", () => {
    render(<GroupedTestToolbar />);
    const toolbar = screen.getByTestId("toolbar");
    const btnB = screen.getByTestId("btn-B");
    const btnC = screen.getByTestId("btn-C");

    // Focus button B (last in first group)
    btnB.focus();

    // ArrowDown should move to button C (first in second group)
    fireEvent.keyDown(toolbar, { key: "ArrowDown" });
    expect(document.activeElement).toBe(btnC);

    // ArrowUp should move back to button B
    fireEvent.keyDown(toolbar, { key: "ArrowUp" });
    expect(document.activeElement).toBe(btnB);
  });

  it("handles a single button", () => {
    render(<TestToolbar buttonLabels={["only"]} />);
    const toolbar = screen.getByTestId("toolbar");
    const btn = screen.getByTestId("btn-only");

    expect(btn).toHaveAttribute("tabindex", "0");

    btn.focus();
    fireEvent.keyDown(toolbar, { key: "ArrowDown" });
    expect(document.activeElement).toBe(btn);
    expect(btn).toHaveAttribute("tabindex", "0");
  });
});
