import React from "react";
import classNames from "classnames";
import { observer } from "mobx-react";
import { BasicEditableTileTitle } from "../../components/tiles/basic-editable-tile-title";
import { ITileProps } from "../../components/tiles/tile-component";

import "./bar-graph.scss";

export const BarGraphComponent: React.FC<ITileProps> = observer((props) => {

  return (
    <div>
      <BasicEditableTileTitle />
      <div
        className={classNames("bar-graph-content", { "read-only": props.readOnly })}
        data-testid="bar-graph-content"
      >
        <p>This is a bar graph.</p>
      </div>
    </div>
  );
});

BarGraphComponent.displayName = "BarGraphComponent";
