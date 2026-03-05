import classNames from "classnames";
import { observer } from "mobx-react";
import React from "react";
import { useResizeDetector } from "react-resize-detector";
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";
import { ITileProps } from "../../../components/tiles/tile-component";
import { DataSetup } from "./data-setup";
import { StatusAndOutput } from "./status-and-output";
import "./wave-runner-tile.scss";

export const WaveRunnerComponent: React.FC<ITileProps> = observer(() => {
  const { width: containerWidth, ref: containerRef } = useResizeDetector();
  const vertical = !containerWidth || containerWidth < 700;

  return (
    <div className="tile-content wave-runner-tile">
      <BasicEditableTileTitle />
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
