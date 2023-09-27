import { useCallback, useEffect, useMemo } from "react";
import { RowHeightArgs } from "react-data-grid";

import { TColumn, TRow } from "./table-types";
import { getTableColumnLeft, getTableContentHeight, getTableRowTop } from "./table-utils";
import { ITileApi } from "../tile-api";
import { useCurrent } from "../../../hooks/use-current";
import { IAttribute } from "../../../models/data/attribute";
import { IDataSet } from "../../../models/data/data-set";
import { TableContentModelType } from "../../../models/tiles/table/table-content";
import { exportTableContentAsJson } from "../../../models/tiles/table/table-export";
import { decipherCellId } from "../../../models/tiles/table/table-utils";
import { OffsetModel } from "../../../models/annotations/clue-object";

// Offsets for annotation bounding boxes
const kCellTopOffset = -1.5;
const kCellLeftOffset = .5;
const kCellHeightOffset = -2;
const kCellWidthOffset = -2;

interface IProps {
  columns: TColumn[];
  content: TableContentModelType;
  dataSet: IDataSet;
  getTitleHeight: () => number;
  headerHeight: () => number;
  measureColumnWidth: (attribute: IAttribute) => number;
  onRegisterTileApi: (tileApi: ITileApi, facet?: string | undefined) => void;
  onUnregisterTileApi: (facet?: string | undefined) => void;
  padding?: number;
  readOnly?: boolean;
  rowHeight: (args: RowHeightArgs<TRow>) => number;
  rows: TRow[];
}
export const useToolApi = ({
  columns, content, dataSet, getTitleHeight, headerHeight, measureColumnWidth, onRegisterTileApi,
  onUnregisterTileApi, padding, readOnly, rowHeight, rows
}: IProps) => {
  const contentRef = useCurrent(content);
  const hasExpressions = content.hasExpressions;

  const getContentHeight = useCallback(() => {
    return getTableContentHeight({
      readOnly,
      rows,
      rowHeight,
      headerHeight,
      getTitleHeight,
      hasExpressions,
      padding
    });
  }, [getTitleHeight, hasExpressions, headerHeight, padding, readOnly, rowHeight, rows]);
  const exportContentAsTileJson = useCallback(() => {
    return exportTableContentAsJson(content.metadata, dataSet, content.columnWidth);
  }, [dataSet, content]);

  const getRowTop = useCallback((rowIndex: number) => {
    return getTableRowTop({
      getTitleHeight, hasExpressions, headerHeight, padding, readOnly, rowHeight, rowIndex, rows
    }) + kCellTopOffset;
  }, [getTitleHeight, hasExpressions, headerHeight, padding, readOnly, rowHeight, rows]);
  const getColumnLeft = useCallback((columnIndex: number) => {
    return getTableColumnLeft({
      columnIndex, columns, dataSet, measureColumnWidth
    }) + kCellLeftOffset;
  }, [columns, dataSet, measureColumnWidth]);
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
        height: rowHeight({ row, type: 'ROW' }) + kCellHeightOffset,
        left: getColumnLeft(attributeIndex),
        top: getRowTop(rowIndex),
        width: measureColumnWidth(attribute) + kCellWidthOffset
      };
      return boundingBox;
    }
  }, [dataSet, getColumnLeft, getRowTop, measureColumnWidth, rowHeight, rows]);
  const getObjectDefaultOffsets = useCallback((objectId: string, objectType?: string) => {
    const offsets = OffsetModel.create({});
    if (objectType === "cell") {
      const boundingBox = getObjectBoundingBox(objectId, objectType);
      if (boundingBox) {
        offsets.setDy(boundingBox.height * -.5 + 2);
      }
    }
    return offsets;
  }, [getObjectBoundingBox]);

  const tileApi = useMemo<ITileApi>(() => ({
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
    getObjectBoundingBox,
    getObjectDefaultOffsets
  }), [exportContentAsTileJson, getContentHeight, contentRef, getObjectBoundingBox, getObjectDefaultOffsets]);

  useEffect(() => {
    onRegisterTileApi(tileApi);
    return () => onUnregisterTileApi();
  }, [onRegisterTileApi, onUnregisterTileApi, tileApi]);
};
