import { createContext, useCallback, useContext } from "react";
import { ITileModel } from "../../../../models/tiles/tile-model";
import { useUIStore } from "../../../../hooks/use-stores";

export const TileModelContext = createContext<ITileModel | undefined>(undefined);

export const useTileModelContext = () => {
  const tile = useContext(TileModelContext);
  const ui = useUIStore();

  const isTileSelected = useCallback(function isTileSelected() {
    const { selectedTileIds } = ui;
    return !!tile?.id && selectedTileIds.indexOf(tile.id) >= 0;
  }, [tile?.id, ui]);

  return { tile, isTileSelected };
};
