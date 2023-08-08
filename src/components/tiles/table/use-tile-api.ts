import { useCallback, useEffect, useMemo } from "react";
import { RowHeightArgs } from "react-data-grid";

import { TRow } from "./table-types";
import { ITileApi } from "../tile-api";
import { useCurrent } from "../../../hooks/use-current";
import { IDataSet } from "../../../models/data/data-set";
import { getLinkedTableIndex } from "../../../models/tiles/table-links";
import { TableContentModelType } from "../../../models/tiles/table/table-content";
import { decipherCellId } from "../../../models/tiles/table/table-utils";
import { ITileModel } from "../../../models/tiles/tile-model";
import { IAttribute } from "../../../models/data/attribute";

interface IProps {
  content: TableContentModelType;
  dataSet: IDataSet;
  getColumnLeft: (columnIndex: number) => number;
  getContentHeight: () => number | undefined;
  getRowTop: (rowIndex: number) => number;
  exportContentAsTileJson: () => string;
  measureColumnWidth: (attribute: IAttribute) => number;
  model: ITileModel;
  onRegisterTileApi: (tileApi: ITileApi, facet?: string | undefined) => void;
  onUnregisterTileApi: (facet?: string | undefined) => void;
  readOnly?: boolean;
  rowHeight: (args: RowHeightArgs<TRow>) => number;
  rows: TRow[];
}
export const useToolApi = ({
  content, dataSet, getColumnLeft, getContentHeight, getRowTop, exportContentAsTileJson,
  measureColumnWidth, model, onRegisterTileApi, onUnregisterTileApi, readOnly, rowHeight, rows
}: IProps) => {
  const contentRef = useCurrent(content);

  const getObjectBoundingBox = useCallback((objectId: string, objectType?: string) => {
    if (objectType === "cell") {
      const { attributeId, caseId } = decipherCellId(objectId);
      if (!attributeId || !caseId) return undefined;
      const attributeIndex = dataSet.attrIndexFromID(attributeId);
      if (attributeIndex === undefined) return undefined;
      const rowIndex = dataSet.caseIndexFromID(caseId);

      const attribute = dataSet.attrFromID(attributeId);
      const row = rows[rowIndex];

      const boundingBox = {
        height: rowHeight({ row, type: 'ROW' }),
        left: getColumnLeft(attributeIndex),
        top: getRowTop(rowIndex),
        width: measureColumnWidth(attribute)
      };
      return boundingBox;
    }
  }, [dataSet, getColumnLeft, getRowTop, measureColumnWidth, rowHeight, rows]);

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
    },
    getObjectBoundingBox
  }), [exportContentAsTileJson, getContentHeight, contentRef, getObjectBoundingBox]);

  useEffect(() => {
    onRegisterTileApi(tileApi);
    return () => onUnregisterTileApi();
  }, [onRegisterTileApi, onUnregisterTileApi, tileApi]);
};
