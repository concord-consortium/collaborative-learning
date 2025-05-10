import React, { useRef } from "react";
import classNames from "classnames";
import { observer } from "mobx-react";
import { useResizeDetector } from "react-resize-detector";

import { ChartArea } from "./chart-area";
import { LegendArea } from "./legend-area";
import { BasicEditableTileTitle } from "../../components/tiles/basic-editable-tile-title";
import { ITileProps } from "../../components/tiles/tile-component";
import { BarGraphModelContext } from "./bar-graph-content-context";
import { isBarGraphModel } from "./bar-graph-content";
import { TileToolbar } from "../../components/toolbar/tile-toolbar";

import "./bar-graph.scss";

import "./bar-graph-toolbar";

const legendWidth = 190;

export const BarGraphComponent: React.FC<ITileProps> = observer((props: ITileProps) => {
  const { model, readOnly, onRequestRowHeight } = props;
  const content = isBarGraphModel(model.content) ? model.content : null;

  const requestedHeight = useRef<number|undefined>(undefined);

  const onResize = (width: number|undefined, height: number|undefined) => {
    let desiredTileHeight;
    if (height) {
      if (legendBelow) {
        const desiredLegendHeight = height;
        desiredTileHeight = 300 + desiredLegendHeight;
      } else {
        const desiredLegendHeight = Math.max(height, 260); // Leave room for at least 5 rows per spec
        desiredTileHeight = desiredLegendHeight + 66;
      }
      if (requestedHeight.current !== desiredTileHeight) {
        requestedHeight.current = desiredTileHeight;
        onRequestRowHeight(model.id, desiredTileHeight);
      }
    }
  };

  // We use two resize detectors to track the size of the container and the size of the legend area
  const { height: containerHeight, width: containerWidth, ref: containerRef } = useResizeDetector();

  const { height: legendHeight, ref: legendRef } = useResizeDetector({
    refreshMode: 'debounce',
    refreshRate: 500,
    skipOnMount: false,
    onResize
  });

  let svgWidth = 10, svgHeight = 10;
  // Legend is on the right if the width is >= 450px, otherwise below
  const legendBelow = containerWidth && containerWidth < 450;
  if (containerWidth && containerHeight) {
    if (legendBelow) {
      const vertPadding = 18;
      svgWidth = containerWidth;
      svgHeight = containerHeight - vertPadding - (legendHeight || 0);
    } else {
      svgWidth = containerWidth - legendWidth;
      svgHeight = containerHeight;
    }
  }

  return (
    <BarGraphModelContext.Provider value={content}>
      <div className="tile-content bar-graph-tile-wrapper">
        <BasicEditableTileTitle />
        <TileToolbar tileType="bargraph" readOnly={!!readOnly} tileElement={props.tileElt} />
        <div
          ref={containerRef}
          className={classNames("bar-graph-content", legendBelow ? "vertical" : "horizontal", { "readonly": readOnly })}
          data-testid="bar-graph-content"
        >
          <ChartArea width={svgWidth} height={svgHeight} />
          <LegendArea legendRef={legendRef} />
        </div>
      </div>
    </BarGraphModelContext.Provider>
  );
});

BarGraphComponent.displayName = "BarGraphComponent";
