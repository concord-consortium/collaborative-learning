import { useCallback, useContext } from "react";
import { TileModelContext } from "../tile-api";
import { useUIStore } from "../../../hooks/use-stores";

export const useTileModelContext = () => {
  const tile = useContext(TileModelContext);
  const ui = useUIStore();

  const isTileSelected = useCallback(function isTileSelected() {
    const { selectedTileIds } = ui;
    return !!tile?.id && selectedTileIds.indexOf(tile.id) >= 0;
  }, [tile?.id, ui]);

  return { tile, isTileSelected };
};
