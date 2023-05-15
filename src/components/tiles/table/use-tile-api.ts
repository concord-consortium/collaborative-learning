import { useEffect, useMemo } from "react";
import { useCurrent } from "../../../hooks/use-current";
import { getLinkedTableIndex } from "../../../models/tiles/table-links";
import { TableContentModelType } from "../../../models/tiles/table/table-content";
import { ITileApi } from "../tile-api";

interface IProps {
  content: TableContentModelType;
  getContentHeight: () => number | undefined;
  exportContentAsTileJson: () => string;
  onRegisterTileApi: (tileApi: ITileApi, facet?: string | undefined) => void;
  onUnregisterTileApi: (facet?: string | undefined) => void;
}
export const useToolApi = ({
  content, getContentHeight, exportContentAsTileJson, onRegisterTileApi, onUnregisterTileApi
}: IProps) => {
  const contentRef = useCurrent(content);
  const tileApi: ITileApi = useMemo(() => ({
    // TODO: we should be able to remove getTitle from the tool api. All other
    // tiles can just access the title from the TileModel (wrapper). This table
    // tile is more complicated because if the title of the tile isn't, set then
    // the title is pulled from the table's dataset. So to remove this from the
    // api, we'll need a title view on TileModel that optionally lets the content
    // override the title stored on the TileModel.
    getTitle: () => contentRef.current.title,
    getContentHeight,
    exportContentAsTileJson,
    isLinked: () => {
      return contentRef.current.isLinked;
    },
    getLinkIndex: (index?: number) => {
      return contentRef.current.isLinked
              ? getLinkedTableIndex(contentRef.current.metadata.id)
              : -1;
    }
  }), [exportContentAsTileJson, getContentHeight, contentRef]);

  useEffect(() => {
    onRegisterTileApi(tileApi);
    return () => onUnregisterTileApi();
  }, [onRegisterTileApi, onUnregisterTileApi, tileApi]);
};
