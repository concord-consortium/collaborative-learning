import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useEffect } from "react";
import { useResizeDetector } from "react-resize-detector";
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";
import { ITileProps } from "../../../components/tiles/tile-component";
import { TileToolbar } from "../../../components/toolbar/tile-toolbar";
import { kWaveRunnerDefaultHeight, kWaveRunnerStackedHeight } from "../wave-runner-types";
import { DataSetup } from "./data-setup";
import { StatusAndOutput } from "./status-and-output";
import "../wave-runner-toolbar";
import "./wave-runner-tile.scss";

export const WaveRunnerComponent: React.FC<ITileProps> = observer(
  ({ model, readOnly, tileElt, onRequestRowHeight }) => {
  const { width: containerWidth, ref: containerRef } = useResizeDetector();
  const vertical = !containerWidth || containerWidth < 700;

  // Ask for the height the layout needs. Safe from feedback: the choice depends on the tile's
  // WIDTH, so a new height cannot change which layout is in use and ask again.
  // Skipped when read-only: the same document can render editable and read-only (four-up,
  // published view) at different widths at once, and onRequestRowHeight mutates the shared row
  // model, so a read-only instance would otherwise overwrite the height the editable one set.
  // Skipped until containerWidth is measured: `vertical` defaults true while it is undefined, so
  // the first render would otherwise ask for the stacked height even in a wide row. tile-row.tsx
  // refuses to shrink a multi-tile row back down once a tile has asked for more, so that first,
  // throwaway request could strand a wide WaveRunner at the stacked height with dead space below
  // it, even after the real width comes in and asks for the smaller one.
  useEffect(() => {
    if (readOnly || containerWidth === undefined) return;
    onRequestRowHeight(model.id, vertical ? kWaveRunnerStackedHeight : kWaveRunnerDefaultHeight);
  }, [vertical, model.id, onRequestRowHeight, readOnly, containerWidth]);

  return (
    <div className="tile-content wave-runner-tile">
      <BasicEditableTileTitle />
      <TileToolbar tileType="wave-runner" readOnly={!!readOnly} tileElement={tileElt} />
      <div ref={containerRef} className="wave-runner-content">
        <div className="title-background" />
        <div className={classNames("sections", { vertical, horizontal: !vertical })}>
          <DataSetup />
          <StatusAndOutput />
        </div>
      </div>
    </div>
  );
});
WaveRunnerComponent.displayName = "WaveRunnerComponent";
