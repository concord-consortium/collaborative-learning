import React, { useCallback, useRef } from "react";
import { hasSelectionModifier } from "../../../utilities/event-utils";

export const useTileSelectionPointerEvents = (
              getTileId: () => string,
              getSelectedTileIds: () => string[],
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

    // first click or subsequent clicks when the tile is one of many selected
    // tiles selects the tile and prevents the click from taking effect
    const selectedTileIds = getSelectedTileIds();
    const isTileSelected = selectedTileIds.includes(getTileId());
    const otherTilesSelected = selectedTileIds.length > 1;
    if (!isTileSelected || otherTilesSelected) {
      setSelectedTile(hasSelectionModifier(e));
      didLastMouseDownSelectTile.current = true;
      // prevent the click from taking effect, e.g. creating a point
      e.preventDefault();
      e.stopPropagation();
    }
  }, [focusableElement, getSelectedTileIds, getTileId, setSelectedTile]);

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
