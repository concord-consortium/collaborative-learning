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
import { useUIStore } from "../../hooks/use-stores";
import { useClueAccessibility } from "../../hooks/use-clue-accessibility";

import "./bar-graph.scss";

import "./bar-graph-toolbar";

const legendWidth = 190;

export const BarGraphComponent: React.FC<ITileProps> = observer((props: ITileProps) => {
  const { model, readOnly, onRequestRowHeight, onRegisterTileApi, onUnregisterTileApi } = props;
  const ui = useUIStore();
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

  useClueAccessibility({
    type: "tile",
    focusTrap: {
      onRegisterTileApi,
      onUnregisterTileApi,
      tileType: "bar-graph",
      getTitleElement: () => {
        // Find the title text element within this tile's DOM
        const tile = containerRef.current?.closest('.tool-tile');
        return tile?.querySelector('.editable-tile-title') as HTMLElement | undefined;
      },
      getContentElement: () => containerRef.current ?? undefined,
      focusContent: () => {
        const container = containerRef.current;
        if (!container) return false;
        // Focus the first bar, or fall back to the first focusable element in the content area
        const firstFocusable = container.querySelector(
          '.visx-bar[tabindex], [role="button"][tabindex], button, [tabindex="0"]'
        ) as HTMLElement | null;
        if (firstFocusable) {
          firstFocusable.focus();
          return document.activeElement === firstFocusable;
        }
        return false;
      },
    },
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

  const classes = classNames("tile-content", "bar-graph-tile-wrapper", {
    hovered: props.hovered,
    selected: ui.isSelectedTile(model),
  });

  return (
    <BarGraphModelContext.Provider value={content}>
      <div className={classes}>
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
