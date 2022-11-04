import { useEffect, useMemo } from "react";
import { useCurrent } from "../../../hooks/use-current";
import { getLinkedTableIndex } from "../../../models/tiles/table-links";
import { TableContentModelType } from "../../../models/tiles/table/table-content";
import { ITileApi } from "../tile-api";

interface IProps {
  content: TableContentModelType;
  getTitle: () => string | undefined;
  getContentHeight: () => number | undefined;
  exportContentAsTileJson: () => string;
  onRegisterTileApi: (toolApi: ITileApi, facet?: string | undefined) => void;
  onUnregisterTileApi: (facet?: string | undefined) => void;
}
export const useToolApi = ({
  content, getTitle, getContentHeight, exportContentAsTileJson, onRegisterTileApi, onUnregisterTileApi
}: IProps) => {
  const contentRef = useCurrent(content);
  const toolApi: ITileApi = useMemo(() => ({
    getTitle,
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
  }), [exportContentAsTileJson, getContentHeight, getTitle, contentRef]);

  useEffect(() => {
    onRegisterTileApi(toolApi);
    return () => onUnregisterTileApi();
  }, [onRegisterTileApi, onUnregisterTileApi, toolApi]);
};
