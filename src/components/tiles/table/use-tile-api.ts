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
    // TODO: we should be able to remove getTitle from the tool api and instead
    // all tile content models can provide a title property. In some cases this is a
    // actual MST property that is saved, in the the case of the table tile this is
    // a computed value coming from the dataset.
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
