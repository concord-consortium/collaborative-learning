import React, { useContext } from "react";
import { observer } from "mobx-react";
import { IBaseProps } from "../base";
import TileRowComponent from "./tile-row";
import { RowListType } from "../../models/document/row-list";
import { DropRowContext } from "./drop-row-context";
import { RowRefsContext } from "./row-refs-context";

interface IProps extends IBaseProps {
  rowListModel: RowListType;
  documentContent: HTMLElement | null;
  context: string;
  documentId?: string;
  docId: string;
  typeClass?: string;
  scale?: number;
  readOnly?: boolean;
}

export const RowListComponent = observer((props: IProps) => {
  const { rowListModel, documentContent, context, documentId, docId, typeClass,
    scale, readOnly } = props;
  const { rowMap, rowOrder } = rowListModel;
  const dropRowInfo = useContext(DropRowContext);
  const rowRefs = useContext(RowRefsContext);

  // CLUE-615/tiles_copy diagnostic: React silently drops list children that share a `key`, so a
  // duplicate row id in rowOrder renders fewer `.tile-row` elements than exist — a candidate cause
  // of the flaky "32 rows but got 22" copy-to-workspace regression. Warn (naming the duplicates) so
  // the next CI failure is diagnosable. Fires only when duplicates exist; log-only, no behavior change.
  const seenRowIds = new Set<string>();
  const duplicateRowIds: string[] = [];
  for (const rowId of rowOrder) {
    if (seenRowIds.has(rowId)) duplicateRowIds.push(rowId);
    else seenRowIds.add(rowId);
  }
  if (duplicateRowIds.length > 0) {
    console.warn("RowListComponent: duplicate row ids in rowOrder — rows will be dropped on render",
      { docId, duplicateRowIds });
  }
  // Also: a rowId in rowOrder with no entry in rowMap renders `null` below (no `.tile-row`), which
  // would drop rows without any duplicate key. Report it with the total count so we can see whether
  // the model actually has all the expected rows (the tiles_copy "32 vs 22" question).
  const orphanRowIds = rowOrder.filter(rowId => !rowMap.get(rowId));
  if (orphanRowIds.length > 0) {
    console.warn("RowListComponent: rowOrder ids missing from rowMap — these render nothing",
      { docId, rowOrderCount: rowOrder.length, rowMapSize: rowMap.size, orphanRowIds });
  }

  return (
    <>
      {rowOrder.map((rowId, index) => {
        const row = rowMap.get(rowId);
        const isDropTarget = dropRowInfo && (dropRowInfo.rowDropId === rowId);
        const dropHighlight = isDropTarget && dropRowInfo.rowDropLocation
                              ? dropRowInfo.rowDropLocation
                              : undefined;
        const dropTileInsertIndex = isDropTarget ? dropRowInfo.tileInsertIndex : undefined;

        return row
                ? <TileRowComponent
                    key={row.id}
                    model={row}
                    documentId={documentId}
                    docId={docId}
                    documentContent={documentContent}
                    rowIndex={index}
                    dropHighlight={dropHighlight}
                    dropTileInsertIndex={dropTileInsertIndex}
                    context={context}
                    typeClass={typeClass}
                    scale={scale}
                    readOnly={readOnly}
                    ref={(ref) => {
                      if (ref && rowRefs) {
                        rowRefs.addRowRef(ref);
                      }
                    }}
                  />
                : null;
      })}
    </>
  );
});
