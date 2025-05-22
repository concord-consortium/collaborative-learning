import React, { useCallback, useRef } from "react";
import classNames from "classnames";
import { observer } from "mobx-react";
import { ITileProps } from "../tile-component";
import { QuestionContentModelType } from "../../../models/tiles/question/question-content";
import { BasicEditableTileTitle } from "../basic-editable-tile-title";
import { ReadOnlyTileTitle } from "../read-only-tile-title";
import { RowListComponent } from "../../document/row-list";
import { useCurrent } from "../../../hooks/use-current";
import { useUIStore } from "../../../hooks/use-stores";
import { useTileSelectionPointerEvents } from "../geometry/use-tile-selection-pointer-events";
import { LockedContainerContext } from "../../document/locked-container-context";

import "./question-tile.scss";

export const QuestionTileComponent: React.FC<ITileProps> = observer(function QuestionTileComponent(props) {
  const content = props.model.content as QuestionContentModelType;
  const modelRef = useCurrent(props.model);
  const ui = useUIStore();
  const domElement = useRef<HTMLDivElement>(null);

  // We have to handle our own selection because clicks on nested tiles shouldn't select the Question tile.
  const [handlePointerDown, handlePointerUp] = useTileSelectionPointerEvents(
    useCallback(() => modelRef.current.id, [modelRef]),
    useCallback(() => ui.selectedTileIds, [ui]),
    useCallback((append: boolean) => ui.setSelectedTile(modelRef.current, { append }), [modelRef, ui]),
    domElement
  );

  const classes = classNames("tile-content", "question-tile-content", {
    hovered: props.hovered,
    selected: ui.isSelectedTile(modelRef.current),
  });

  return (
    <LockedContainerContext.Provider value={content.locked}>
      <div
        className={classes}
        data-testid="question-tile"
        ref={domElement}
        onMouseDown={handlePointerDown}
        onMouseUp={handlePointerUp}
      >
        <div className="question-tile-spacer" />
          {content.locked ? (
            <ReadOnlyTileTitle />
          ) : (
            <BasicEditableTileTitle />
          )}
        <div className="question-tile-rows focusable">
          <RowListComponent
            rowListModel={content}
            documentContent={props.documentContent}
            context={props.context}
            documentId={props.documentId}
            docId={props.docId}
            scale={props.scale}
            readOnly={props.readOnly}
          />
        </div>
      </div>
    </LockedContainerContext.Provider>
  );
});
