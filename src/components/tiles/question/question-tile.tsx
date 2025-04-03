import React from "react";
import { observer } from "mobx-react";
import { ITileProps } from "../tile-component";
import { QuestionContentModelType } from "../../../models/tiles/question/question-content";

import "./question-tile.scss";

export const QuestionTileComponent: React.FC<ITileProps> = observer(function QuestionTileComponent(props) {
  const content = props.model.content as QuestionContentModelType;

  return (
    <div className="question-tile" data-testid="question-tile">
      Question Tile
    </div>
  );
});
