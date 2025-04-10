import React from "react";
import { observer } from "mobx-react";
import { ITileProps } from "../tile-component";
import { QuestionContentModelType } from "../../../models/tiles/question/question-content";
import { BasicEditableTileTitle } from "../basic-editable-tile-title";
import { ReadOnlyTileTitle } from "../read-only-tile-title";
import QuestionBadge from "../../../assets/icons/question-badge.svg";

import "./question-tile.scss";

export const QuestionTileComponent: React.FC<ITileProps> = observer(function QuestionTileComponent(props) {
  const content = props.model.content as QuestionContentModelType;

  return (
    <div className="question-tile-content" data-testid="question-tile">
      <div className="question-badge">
        <QuestionBadge />
      </div>
      {content.locked ? (
        <ReadOnlyTileTitle />
      ) : (
        <BasicEditableTileTitle />
      )}
    </div>
  );
});
