import React, { useCallback, useRef } from "react";
import { hasSelectionModifier } from "../../../utilities/event-utils";

export const useTileSelectionPointerEvents = (
              isTileSelected: () => boolean,
              setSelectedTile: (append: boolean) => void,
              focusableElement: React.RefObject<HTMLDivElement>) => {
  const didLastMouseDownSelectTile = useRef(false);

  const handlePointerDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {

    // if the clicked element is focusable, let it handle the event
    const target = e.target as HTMLElement;
    const classList = target.classList;
    if (classList?.contains("focusable")) return;

    // clicked tile gets keyboard focus
    if (focusableElement.current) {
      // requires non-empty tabIndex
      focusableElement.current.focus();
    }

    // first click selects the tile
    if (!isTileSelected()) {
      setSelectedTile(hasSelectionModifier(e));
      didLastMouseDownSelectTile.current = true;
      // prevent the click from taking effect, e.g. creating a point
      e.preventDefault();
      e.stopPropagation();
    }
  }, [focusableElement, isTileSelected, setSelectedTile]);

  const handlePointerUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (didLastMouseDownSelectTile.current) {
      didLastMouseDownSelectTile.current = false;
      // prevent the click from taking effect, e.g. creating a point
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  return [handlePointerDown, handlePointerUp];
};
