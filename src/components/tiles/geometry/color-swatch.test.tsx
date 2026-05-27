import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { ColorSwatch } from "./color-swatch";

describe("ColorSwatch — keyboard accessibility", () => {
  function getSwatch(container: HTMLElement) {
    return container.querySelector<HTMLElement>(".color-swatch[role='button']");
  }

  it("renders as a focusable role='button' with the color name as aria-label", () => {
    const { container } = render(
      <ColorSwatch name="blue" color="#3366ff" index={0} isSelected={false} onSelectColor={jest.fn()} />
    );
    const swatch = getSwatch(container);
    expect(swatch).not.toBeNull();
    expect(swatch?.getAttribute("tabindex")).toBe("0");
    expect(swatch?.getAttribute("aria-label")).toBe("blue");
    expect(swatch?.getAttribute("aria-pressed")).toBe("false");
  });

  it("uses aria-pressed='true' when the swatch is the currently selected color", () => {
    const { container } = render(
      <ColorSwatch name="orange" color="#ff9933" index={1} isSelected={true} onSelectColor={jest.fn()} />
    );
    expect(getSwatch(container)?.getAttribute("aria-pressed")).toBe("true");
  });

  it("calls onSelectColor with the swatch index on click", () => {
    const onSelect = jest.fn();
    const { container } = render(
      <ColorSwatch name="green" color="#33cc66" index={2} isSelected={false} onSelectColor={onSelect} />
    );
    fireEvent.click(getSwatch(container)!);
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("calls onSelectColor when Enter is pressed (role=button needs manual keyboard handling)", () => {
    const onSelect = jest.fn();
    const { container } = render(
      <ColorSwatch name="red" color="#cc3333" index={3} isSelected={false} onSelectColor={onSelect} />
    );
    fireEvent.keyDown(getSwatch(container)!, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it("calls onSelectColor when Space is pressed", () => {
    const onSelect = jest.fn();
    const { container } = render(
      <ColorSwatch name="purple" color="#9933cc" index={4} isSelected={false} onSelectColor={onSelect} />
    );
    fireEvent.keyDown(getSwatch(container)!, { key: " " });
    expect(onSelect).toHaveBeenCalledWith(4);
  });

  it("ignores other keys", () => {
    const onSelect = jest.fn();
    const { container } = render(
      <ColorSwatch name="indigo" color="#333399" index={5} isSelected={false} onSelectColor={onSelect} />
    );
    fireEvent.keyDown(getSwatch(container)!, { key: "ArrowRight" });
    expect(onSelect).not.toHaveBeenCalled();
  });
});
