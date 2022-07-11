import { useEffect, useMemo } from "react";
import { useCurrent } from "../../../hooks/use-current";
import { getLinkedTableIndex } from "../../../models/tools/table-links";
import { TableContentModelType } from "../../../models/tools/table/table-content";
import { IToolApi } from "../tool-api";

interface IProps {
  content: TableContentModelType;
  getTitle: () => string | undefined;
  getContentHeight: () => number | undefined;
  exportContentAsTileJson: () => string;
  onRegisterToolApi: (toolApi: IToolApi, facet?: string | undefined) => void;
  onUnregisterToolApi: (facet?: string | undefined) => void;
}
export const useToolApi = ({
  content, getTitle, getContentHeight, exportContentAsTileJson, onRegisterToolApi, onUnregisterToolApi
}: IProps) => {
  const contentRef = useCurrent(content);
  const toolApi: IToolApi = useMemo(() => ({
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
    onRegisterToolApi(toolApi);
    return () => onUnregisterToolApi();
  }, [onRegisterToolApi, onUnregisterToolApi, toolApi]);
};
