import React, { useEffect, useRef } from "react";
import { ColorSwatch } from "./color-swatch";
import { ClueColor, clueBasicDataColorInfo } from "../../../utilities/color-utils";

import "./color-palette.scss";

interface IProps {
  selectedColor?: number;
  onSelectColor: (color: number) => void;
  onClose: () => void;
}

export const ColorPalette: React.FC<IProps> = ({ selectedColor, onSelectColor, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const getSwatches = () =>
    Array.from(containerRef.current?.querySelectorAll<HTMLElement>(".color-swatch[role='button']") ?? []);

  useEffect(() => {
    const swatches = getSwatches();
    if (swatches.length === 0) return;
    const target = (selectedColor != null && swatches[selectedColor]) || swatches[0];
    target.focus();
    // Mount-only: re-running on prop changes would steal focus mid-pick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      onClose();
      return;
    }

    const navKeys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
    if (!navKeys.includes(e.key)) return;
    const swatches = getSwatches();
    if (swatches.length === 0) return;
    const current = swatches.indexOf(document.activeElement as HTMLElement);
    const last = swatches.length - 1;
    let next: number;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = current < 0 ? 0 : (current + 1) % swatches.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = current < 0 ? last : (current - 1 + swatches.length) % swatches.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
    swatches[next].focus();
  }

  return (
    <div
      ref={containerRef}
      className="toolbar-palette color-palette"
      role="group"
      aria-label="Color picker"
      onKeyDown={handleKeyDown}
    >
      <div className="palette-buttons">
        {clueBasicDataColorInfo.map((colorInfo: ClueColor, index) =>
          <ColorSwatch
            key={colorInfo.name}
            name={colorInfo.name}
            color={colorInfo.color}
            index={index}
            isSelected={index === selectedColor}
            onSelectColor={onSelectColor}
          />
        )}
      </div>
    </div>
  );
};
