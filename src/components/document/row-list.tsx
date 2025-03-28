import React from "react";
import { observer } from "mobx-react";
import { BaseComponent, IBaseProps } from "../base";
import { TileRowComponent } from "./tile-row";
import { DocumentContentModelType } from "../../models/document/document-content";
import { IDropRowInfo } from "../../models/document/tile-row";
import { RowListType } from "../../models/document/row-list";

interface IProps extends IBaseProps {
  documentContentModel: DocumentContentModelType;
  rowListModel: RowListType;
  documentContent: HTMLElement | null;
  context: string;
  documentId?: string;
  typeClass?: string;
  scale?: number;
  readOnly?: boolean;
  dropRowInfo?: IDropRowInfo;
  highlightPendingDropLocation?: number;
  rowRefs: Array<TileRowComponent | null>;
}

@observer
export class RowListComponent extends BaseComponent<IProps> {
  public render() {
    const { documentContentModel, rowListModel, documentContent, context, documentId, typeClass,
      scale, readOnly, dropRowInfo, highlightPendingDropLocation, rowRefs } = this.props;
    const { tileMap } = documentContentModel;
    const { rowMap, rowOrder } = rowListModel;

    return rowOrder.map((rowId, index) => {
      const row = rowMap.get(rowId);
      let dropHighlight = dropRowInfo && (dropRowInfo.rowDropIndex != null) &&
                          (dropRowInfo.rowDropIndex === index) &&
                          dropRowInfo.rowDropLocation
                            ? dropRowInfo.rowDropLocation
                            : undefined;
      if (!dropHighlight) {
        if (index === highlightPendingDropLocation) {
          dropHighlight = "top";
        }
        else if ((index === rowOrder.length - 1) && (index + 1 === highlightPendingDropLocation)) {
          dropHighlight = "bottom";
        }
      }

      return row
              ? <TileRowComponent
                  key={row.id}
                  docId={documentContentModel.contentId}
                  model={row}
                  documentContent={documentContent}
                  rowIndex={index}
                  tileMap={tileMap}
                  dropHighlight={dropHighlight}
                  ref={(elt) => rowRefs.push(elt)}
                  context={context}
                  documentId={documentId}
                  typeClass={typeClass}
                  scale={scale}
                  readOnly={readOnly}
                />
              : null;
    });
  }
}
