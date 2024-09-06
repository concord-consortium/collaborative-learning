import React from "react";
import classNames from "classnames";
import { observer } from "mobx-react";
import { useResizeDetector } from "react-resize-detector";

import { BasicEditableTileTitle } from "../../components/tiles/basic-editable-tile-title";
import { ITileProps } from "../../components/tiles/tile-component";
import { BarGraphChart } from "./bar-graph-chart";
import { BarGraphModelContext } from "./bar-graph-content-context";
import { isBarGraphModel } from "./bar-graph-content";
import { TileToolbar } from "../../components/toolbar/tile-toolbar";
import { BarGraphLegend } from "./bar-graph-legend";

import "./bar-graph.scss";

import "./bar-graph-toolbar";

const legendWidth = 190;
const legendHeight = 190; // FIXME

export const BarGraphComponent: React.FC<ITileProps> = observer((props: ITileProps) => {

  const { model, readOnly } = props;
  const content = isBarGraphModel(model.content) ? model.content : null;

  const {height: containerHeight, width: containerWidth, ref} = useResizeDetector();
  let svgWidth = 10, svgHeight = 10;
  const legendBelow = containerWidth && containerWidth < 450;
  if (containerWidth && containerHeight) {
    // Legend is on the right if the width is >= 450px
    svgWidth = legendBelow ? containerWidth : containerWidth-legendWidth;
    svgHeight = legendBelow ? containerHeight-legendHeight : containerHeight;
  }

  return (
    <BarGraphModelContext.Provider value={content}>
      <BasicEditableTileTitle />
      <TileToolbar tileType="bargraph" readOnly={!!readOnly} tileElement={props.tileElt} />
      <div
        ref={ref}
        className={classNames("bar-graph-content", legendBelow ? "vertical" : "horizontal", { "read-only": readOnly })}
        data-testid="bar-graph-content"
      >
        <BarGraphChart width={svgWidth} height={svgHeight} />
        <BarGraphLegend />
      </div>
    </BarGraphModelContext.Provider>
  );
});

BarGraphComponent.displayName = "BarGraphComponent";
