import { observer } from "mobx-react";
import React, { useState, useEffect, useMemo } from "react";
import { ToolTileModelType } from "../../../models/tools/tool-tile";

import '../deck-tool.scss'

interface IProps {
  currentCaseIndex: any;
  model: ToolTileModelType;
}

export const NewCardAttribute: React.FC<IProps> = observer((props) => {
  return (
    <div className="add-attribute-area">
      <div className="new-attribute">new attribute input</div>
      <div className="new-value">new attribute data input</div>
    </div>
  );
});

