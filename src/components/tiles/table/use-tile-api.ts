import { useMemo } from "react";
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
  padding?: number;
  readOnly?: boolean;
  rowHeight: (args: RowHeightArgs<TRow>) => number;
  rows: TRow[];
}
export const useToolApi = ({
  columns, content, dataSet, getTitleHeight, headerHeight, measureColumnWidth,
  padding, readOnly, rowHeight, rows
}: IProps): ITileApi => {
  // Live refs — updated synchronously each render so methods always see current values
  const columnsRef = useCurrent(columns);
  const contentRef = useCurrent(content);
  const dataSetRef = useCurrent(dataSet);
  const getTitleHeightRef = useCurrent(getTitleHeight);
  const headerHeightRef = useCurrent(headerHeight);
  const measureColumnWidthRef = useCurrent(measureColumnWidth);
  const paddingRef = useCurrent(padding);
  const readOnlyRef = useCurrent(readOnly);
  const rowHeightRef = useCurrent(rowHeight);
  const rowsRef = useCurrent(rows);

  // Stable-identity tileApi; each method reads live values from refs.
  return useMemo<ITileApi>(() => ({
    getContentHeight: () => {
      const _content = contentRef.current;
      return getTableContentHeight({
        readOnly: readOnlyRef.current,
        rows: rowsRef.current,
        rowHeight: rowHeightRef.current,
        headerHeight: headerHeightRef.current,
        getTitleHeight: getTitleHeightRef.current,
        hasExpressions: _content.hasExpressions,
        padding: paddingRef.current
      });
    },
    exportContentAsTileJson: () => {
      const _content = contentRef.current;
      return exportTableContentAsJson(_content.metadata, dataSetRef.current, _content.columnWidth);
    },
    isLinked: () => {
      return contentRef.current.isLinked;
    },
    getObjectBoundingBox: (objectId: string, objectType?: string) => {
      if (objectType === "cell") {
        const _dataSet = dataSetRef.current;
        const _rows = rowsRef.current;
        const _rowHeight = rowHeightRef.current;
        const _measureColumnWidth = measureColumnWidthRef.current;
        const _columns = columnsRef.current;
        const _content = contentRef.current;

        const { attributeId, caseId } = decipherCellId(objectId);
        if (!attributeId || !caseId) return undefined;
        const attributeIndex = _dataSet.attrIndexFromID(attributeId);
        if (attributeIndex === undefined) return undefined;
        const rowIndex = _dataSet.caseIndexFromID(caseId);

        const attribute = _dataSet.attrFromID(attributeId);
        const row = _rows[rowIndex];

        const columnLeft = getTableColumnLeft({
          columnIndex: attributeIndex, columns: _columns, dataSet: _dataSet,
          measureColumnWidth: _measureColumnWidth
        }) + kCellLeftOffset;

        const rowTop = getTableRowTop({
          getTitleHeight: getTitleHeightRef.current,
          hasExpressions: _content.hasExpressions,
          headerHeight: headerHeightRef.current,
          padding: paddingRef.current,
          readOnly: readOnlyRef.current,
          rowHeight: _rowHeight,
          rowIndex,
          rows: _rows
        }) + kCellTopOffset;

        return {
          height: _rowHeight({ row, type: 'ROW' }) + kCellHeightOffset,
          left: columnLeft,
          top: rowTop,
          width: _measureColumnWidth(attribute) + kCellWidthOffset
        };
      }
    },
    getObjectDefaultOffsets: (objectId: string, objectType?: string) => {
      const offsets = OffsetModel.create({});
      if (objectType === "cell") {
        // Duplicates the height calculation from getObjectBoundingBox above.
        // We can't delegate to getObjectBoundingBox here because both functions
        // are being defined together in this useMemo — the api object isn't
        // available yet.
        const _dataSet = dataSetRef.current;
        const _rows = rowsRef.current;
        const _rowHeight = rowHeightRef.current;

        const { attributeId, caseId } = decipherCellId(objectId);
        if (attributeId && caseId) {
          const rowIndex = _dataSet.caseIndexFromID(caseId);
          const row = _rows[rowIndex];
          const height = _rowHeight({ row, type: 'ROW' }) + kCellHeightOffset;
          offsets.setDy(height * -.5 + 2);
        }
      }
      return offsets;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- object identity is stable; refs provide live values
  }), []);
};
