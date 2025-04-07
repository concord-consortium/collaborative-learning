import React, { useCallback, useRef } from "react";
import { hasSelectionModifier } from "../../../utilities/event-utils";

/**
 * Handle pointer events that may select a tile in a standard way.
 * This hook returns a pair of functions that can be used as onMouseDown and onMouseUp handlers.
 * In some cases you may also want to attach them to `onPointerDownCapture` and `onPointerUpCapture`.
 * Note that to use this hook you will need to set `tileHandlesOwnSelection` to true when registering
 * the tile with `registerTileComponentInfo`.
 *
 * @param getTileId - a function that returns the id of the current tile
 * @param getSelectedTileIds - a function that returns the ids of the currently selected tiles
 * @param setSelectedTile - a function that selects or deselects the current tile
 * @param focusableElement - a ref to the tile's element that should get keyboard focus when the tile is clicked
 * @returns a pair of functions that can be used as onMouseDown and onMouseUp handlers
 */
export const useTileSelectionPointerEvents = (
              getTileId: () => string,
              getSelectedTileIds: () => string[],
              setSelectedTile: (append: boolean) => void,
              focusableElement: React.RefObject<HTMLDivElement>) => {
  const didLastMouseDownSelectTile = useRef(false);

  const handlePointerDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {

    // if the clicked element or its ancestor is focusable, let it handle the event
    let ancestor = e.target as HTMLElement|null;
    while (ancestor && !ancestor.classList.contains("focusable")) {
      ancestor = ancestor.parentElement;
    }
    if (ancestor) return;

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
