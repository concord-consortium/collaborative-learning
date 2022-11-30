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
    // TODO: we should be able to remove getTitle from the tool api. Most tiles
    // let the the TileModel (wrapper) store the title and read it from there.
    // Many of them have a title property on their content model and a setTitle
    // action both of which update the title in the TileModel (wrapper). This
    // table tile is more complicated because the title is actually coming from
    // the dataSet. So we'll need a title abstraction that can handle this case
    // too.
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
