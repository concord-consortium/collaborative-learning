import { useEffect, useMemo } from "react";
import { useCurrent } from "../../../hooks/use-current";
import { getLinkedTableIndex } from "../../../models/tools/table-links";
import { TableMetadataModelType } from "../../../models/tools/table/table-content";
import { IToolApi } from "../tool-api";

interface IProps {
  metadata: TableMetadataModelType;
  getTitle: () => string | undefined;
  getContentHeight: () => number | undefined;
  onRegisterToolApi: (toolApi: IToolApi, facet?: string | undefined) => void;
  onUnregisterToolApi: (facet?: string | undefined) => void;
}
export const useToolApi = ({
  metadata, getTitle, getContentHeight, onRegisterToolApi, onUnregisterToolApi
}: IProps) => {
  const metadataRef = useCurrent(metadata);
  const toolApi: IToolApi = useMemo(() => ({
    getTitle,
    getContentHeight,
    isLinked: () => {
      return metadataRef.current.isLinked;
    },
    getLinkIndex: (index?: number) => {
      return metadataRef.current.isLinked
              ? getLinkedTableIndex(metadataRef.current.id)
              : -1;
    }
  }), [getContentHeight, getTitle, metadataRef]);

  useEffect(() => {
    onRegisterToolApi(toolApi);
    return () => onUnregisterToolApi();
  }, [onRegisterToolApi, onUnregisterToolApi, toolApi]);
};
