import { useEffect, useMemo, useRef } from "react";
import { useCurrent } from "../../../hooks/use-current";
import { usePersistentUIStore } from "../../../hooks/use-stores";
import { ITileApi, TileResizeEntry } from "../tile-api";

export interface IUseToolbarToolApi {
  id: string;
  enabled: boolean;
  onRegisterTileApi: (tileApi: ITileApi, facet?: string) => void;
  onUnregisterTileApi: (facet?: string) => void;
}

/*
 * Implements the tool's side of the floating toolbar API.
 */
export const useToolbarTileApi = (
  { id, enabled, onRegisterTileApi, onUnregisterTileApi }: IUseToolbarToolApi) => {
  const toolbarToolApi = useRef<ITileApi | undefined>();

  useEffect(() => {
    onRegisterTileApi({
      handleDocumentScroll: (x: number, y: number) => {
        toolbarToolApi.current?.handleDocumentScroll?.(x, y);
      },
      handleTileResize: (entry: TileResizeEntry) => {
        toolbarToolApi.current?.handleTileResize?.(entry);
      }
    }, "layout");
    return () => onUnregisterTileApi("layout");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ui = usePersistentUIStore();
  const enabledRef = useCurrent(enabled);
  const handleIsEnabled = useRef(() => {
    // Implemented as callback so that the MST accesses occur from the toolbar's
    // render function rather than the parent tool's, so that only the former
    // will re-render and not the latter.
    return enabledRef.current &&
            (ui?.selectedTileIds.length === 1) &&
            (ui?.selectedTileIds.includes(id));
  });

  return useMemo(() => ({
    onRegisterTileApi: (tileApi: ITileApi) => {
      toolbarToolApi.current = tileApi;
    },
    onUnregisterTileApi: () => {
      toolbarToolApi.current = undefined;
    },
    onIsEnabled: handleIsEnabled.current
  }), []);
};
