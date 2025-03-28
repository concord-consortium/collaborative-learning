import React from "react";
import { observer } from "mobx-react";
import { getParent, getSnapshot, getType } from "mobx-state-tree";
import { ITileProps } from "../tile-component";
import { QuestionContentModelType } from "../../../models/tiles/question/question-content";
import { BasicEditableTileTitle } from "../basic-editable-tile-title";
import { ReadOnlyTileTitle } from "../read-only-tile-title";
import { RowListComponent } from "../../document/row-list";
import { DocumentContentModelType } from "../../../models/document/document-content";
import QuestionBadge from "../../../assets/icons/question-badge.svg";

import "./question-tile.scss";

export const QuestionTileComponent: React.FC<ITileProps> = observer(function QuestionTileComponent(props) {
  const content = props.model.content as QuestionContentModelType;

  const rowRefs: any[] = [];
  let domElement: HTMLElement | null = null;
  let documentContent: DocumentContentModelType | null = null;
  try {
    let parent = getParent(content);
    while (parent && getType(parent).name !== "DocumentContent") {
      parent = getParent(parent);
    }
    documentContent = parent as DocumentContentModelType;
  } catch (e) {
    console.error("Error getting document content", e);
  }

  if (!documentContent) {
    console.log("failed render question tile", props.model.id, documentContent && getSnapshot(documentContent));
    return null;
  }
  const storeRef = (elt: any) => {
    domElement = elt;
    rowRefs.push(elt);
  };

  return (
    <div className="question-tile-content"
          data-testid="question-tile"
          ref={(elt) => storeRef(elt)}>
      <div className="question-badge">
        <QuestionBadge />
      </div>
      {content.locked ? (
        <ReadOnlyTileTitle />
      ) : (
        <BasicEditableTileTitle />
      )}
      <div className="question-tile-rows">
        <RowListComponent
          documentContentModel={documentContent}
          rowListModel={content}
          documentContent={domElement}
          rowRefs={rowRefs}
          context={props.context}
          documentId={props.documentId}
          // typeClass={props.typeClass}
          scale={props.scale}
          readOnly={props.readOnly}
          // dropRowInfo={props.dropRowInfo}
          // highlightPendingDropLocation={props.highlightPendingDropLocation}
        />
      </div>
    </div>
  );
});
