import { useEffect, useMemo, useRef } from "react";
import { useUIStore } from "../../../hooks/use-stores";
import { IToolApi } from "../tool-tile";

export interface IUseToolbarToolApi {
  id: string;
  readOnly?: boolean;
  onRegisterToolApi: (toolApi: IToolApi, facet?: string) => void;
  onUnregisterToolApi: (facet?: string) => void;
}

/*
 * Implements the tool's side of the floating toolbar API.
 */
export const useToolbarToolApi = (
  { id, readOnly, onRegisterToolApi, onUnregisterToolApi }: IUseToolbarToolApi) => {
  const toolbarToolApi = useRef<IToolApi | undefined>();

  useEffect(() => {
    onRegisterToolApi({
      handleDocumentScroll: (x: number, y: number) => {
        toolbarToolApi.current?.handleDocumentScroll?.(x, y);
      },
      handleTileResize: (entry: ResizeObserverEntry) => {
        toolbarToolApi.current?.handleTileResize?.(entry);
      }
    }, "layout");
    return () => onUnregisterToolApi("layout");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ui = useUIStore();
  const handleIsEnabled = useRef(() => {
    // Implemented as callback so that the MST accesses occur from the toolbar's
    // render function rather than the parent tool's, so that only the former
    // will re-render and not the latter.
    return !readOnly &&
            (ui?.selectedTileIds.length === 1) &&
            (ui?.selectedTileIds.includes(id));
  });

  return useMemo(() => ({
    onRegisterToolApi: (toolApi: IToolApi) => {
      toolbarToolApi.current = toolApi;
    },
    onUnregisterToolApi: () => {
      toolbarToolApi.current = undefined;
    },
    onIsEnabled: handleIsEnabled.current
  }), []);
};
