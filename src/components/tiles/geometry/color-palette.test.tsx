import React from "react";
import { render, fireEvent, act } from "@testing-library/react";
import { ColorPalette } from "./color-palette";

describe("ColorPalette — keyboard accessibility", () => {
  it("renders as a labelled group of color swatches", () => {
    const { container } = render(
      <ColorPalette selectedColor={0} onSelectColor={jest.fn()} onClose={jest.fn()} />
    );
    const group = container.querySelector(".color-palette");
    expect(group?.getAttribute("role")).toBe("group");
    expect(group?.getAttribute("aria-label")).toBe("Color picker");
    expect(container.querySelectorAll(".color-swatch[role='button']").length).toBeGreaterThan(0);
  });

  it("auto-focuses the currently-selected swatch when opened", () => {
    const { container } = render(
      <ColorPalette selectedColor={2} onSelectColor={jest.fn()} onClose={jest.fn()} />
    );
    const swatches = container.querySelectorAll<HTMLElement>(".color-swatch[role='button']");
    expect(document.activeElement).toBe(swatches[2]);
  });

  it("focuses the first swatch when no swatch is selected", () => {
    const { container } = render(
      <ColorPalette onSelectColor={jest.fn()} onClose={jest.fn()} />
    );
    const swatches = container.querySelectorAll<HTMLElement>(".color-swatch[role='button']");
    expect(document.activeElement).toBe(swatches[0]);
  });

  it("calls onClose when Escape is pressed inside the palette", () => {
    const onClose = jest.fn();
    const { container } = render(
      <ColorPalette selectedColor={0} onSelectColor={jest.fn()} onClose={onClose} />
    );
    const group = container.querySelector(".color-palette") as HTMLElement;
    act(() => {
      fireEvent.keyDown(group, { key: "Escape" });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose for non-Escape keys", () => {
    const onClose = jest.fn();
    const { container } = render(
      <ColorPalette selectedColor={0} onSelectColor={jest.fn()} onClose={onClose} />
    );
    const group = container.querySelector(".color-palette") as HTMLElement;
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(onClose).not.toHaveBeenCalled();
  });

  describe("arrow-key navigation between swatches", () => {
    function renderPalette(selectedColor = 0) {
      const { container } = render(
        <ColorPalette selectedColor={selectedColor} onSelectColor={jest.fn()} onClose={jest.fn()} />
      );
      const group = container.querySelector(".color-palette") as HTMLElement;
      const swatches = Array.from(
        container.querySelectorAll<HTMLElement>(".color-swatch[role='button']")
      );
      return { group, swatches };
    }

    it("ArrowRight moves focus to the next swatch", () => {
      const { group, swatches } = renderPalette(0);
      expect(document.activeElement).toBe(swatches[0]);
      act(() => { fireEvent.keyDown(group, { key: "ArrowRight" }); });
      expect(document.activeElement).toBe(swatches[1]);
    });

    it("ArrowDown also moves to the next swatch", () => {
      const { group, swatches } = renderPalette(0);
      act(() => { fireEvent.keyDown(group, { key: "ArrowDown" }); });
      expect(document.activeElement).toBe(swatches[1]);
    });

    it("ArrowLeft moves focus to the previous swatch", () => {
      const { group, swatches } = renderPalette(2);
      expect(document.activeElement).toBe(swatches[2]);
      act(() => { fireEvent.keyDown(group, { key: "ArrowLeft" }); });
      expect(document.activeElement).toBe(swatches[1]);
    });

    it("ArrowRight wraps from the last swatch to the first", () => {
      const { group, swatches } = renderPalette(0);
      const last = swatches.length - 1;
      act(() => { swatches[last].focus(); });
      act(() => { fireEvent.keyDown(group, { key: "ArrowRight" }); });
      expect(document.activeElement).toBe(swatches[0]);
    });

    it("ArrowLeft wraps from the first swatch to the last", () => {
      const { group, swatches } = renderPalette(0);
      expect(document.activeElement).toBe(swatches[0]);
      act(() => { fireEvent.keyDown(group, { key: "ArrowLeft" }); });
      expect(document.activeElement).toBe(swatches[swatches.length - 1]);
    });

    it("Home focuses the first swatch, End focuses the last", () => {
      const { group, swatches } = renderPalette(3);
      act(() => { fireEvent.keyDown(group, { key: "Home" }); });
      expect(document.activeElement).toBe(swatches[0]);
      act(() => { fireEvent.keyDown(group, { key: "End" }); });
      expect(document.activeElement).toBe(swatches[swatches.length - 1]);
    });
  });
});
