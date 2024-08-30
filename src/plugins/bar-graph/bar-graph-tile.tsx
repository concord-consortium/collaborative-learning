import React from "react";
import classNames from "classnames";
import { observer } from "mobx-react";
import { useResizeDetector } from "react-resize-detector";

import { BasicEditableTileTitle } from "../../components/tiles/basic-editable-tile-title";
import { ITileProps } from "../../components/tiles/tile-component";
import { BarGraphChart } from "./bar-graph-chart";
import { BarGraphModelContext } from "./bar-graph-content-context";
import { isBarGraphModel } from "./bar-graph-content";

import "./bar-graph.scss";

export const BarGraphComponent: React.FC<ITileProps> = observer((props: ITileProps) => {

  const {height: resizeHeight, width: resizeWidth, ref} = useResizeDetector();

  const { model, readOnly } = props;

  const content = isBarGraphModel(model.content) ? model.content : null;


  return (
    <BarGraphModelContext.Provider value={content}>
      <BasicEditableTileTitle />
      <div
        ref={ref}
        className={classNames("bar-graph-content", { "read-only": readOnly })}
        data-testid="bar-graph-content"
      >
        <BarGraphChart width={resizeWidth||10} height={resizeHeight||10} />
      </div>
    </BarGraphModelContext.Provider>
  );
});

BarGraphComponent.displayName = "BarGraphComponent";
