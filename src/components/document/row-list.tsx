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

  return (
    <>
      {rowOrder.map((rowId, index) => {
        const row = rowMap.get(rowId);
        const dropHighlight = dropRowInfo && (dropRowInfo.rowDropId === rowId) &&
                            dropRowInfo.rowDropLocation
                              ? dropRowInfo.rowDropLocation
                              : undefined;

        return row
                ? <TileRowComponent
                    key={row.id}
                    model={row}
                    documentId={documentId}
                    docId={docId}
                    documentContent={documentContent}
                    rowIndex={index}
                    dropHighlight={dropHighlight}
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
