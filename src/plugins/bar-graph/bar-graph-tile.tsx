import React from "react";
import classNames from "classnames";
import { observer } from "mobx-react";
import { useResizeDetector } from "react-resize-detector";

import { BasicEditableTileTitle } from "../../components/tiles/basic-editable-tile-title";
import { ITileProps } from "../../components/tiles/tile-component";
import { BarGraphChart } from "./bar-graph-chart";

import "./bar-graph.scss";

export const BarGraphComponent: React.FC<ITileProps> = observer((props) => {

  const {height: resizeHeight, width: resizeWidth, ref} = useResizeDetector();

  return (
    <React.Fragment>
      <BasicEditableTileTitle />
      <div
        ref={ref}
        className={classNames("bar-graph-content", { "read-only": props.readOnly })}
        data-testid="bar-graph-content"
      >
       <BarGraphChart width={resizeWidth||10} height={resizeHeight||10} />
      </div>
    </React.Fragment>
  );
});

BarGraphComponent.displayName = "BarGraphComponent";
