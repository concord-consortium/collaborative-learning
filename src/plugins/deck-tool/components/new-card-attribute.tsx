import { observer } from "mobx-react";
import React from "react";
import { ToolTileModelType } from "../../../models/tools/tool-tile";

import '../deck-tool.scss';

interface IProps {
  currentCaseIndex: any;
  model: ToolTileModelType;
}

export const NewCardAttribute: React.FC<IProps> = observer((props) => {
  return (
    <div className="add-attribute-area">
      <div className="new-attribute" style={{color: "silver"}}><em>new attribute</em></div>
      <div className="new-value"style={{color: "silver"}}><em>new data</em></div>
    </div>
  );
});

