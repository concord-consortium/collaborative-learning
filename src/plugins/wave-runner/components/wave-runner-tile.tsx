import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useContext } from "react";
import { useResizeDetector } from "react-resize-detector";
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { ITileProps } from "../../../components/tiles/tile-component";
import { TileToolbar } from "../../../components/toolbar/tile-toolbar";
import { isWaveRunnerContentModel } from "../models/wave-runner-content";
import { DataSetup } from "./data-setup";
import { StatusAndOutput } from "./status-and-output";
import "../wave-runner-toolbar";
import "./wave-runner-tile.scss";

export const WaveRunnerComponent: React.FC<ITileProps> = observer(({ readOnly, tileElt }) => {
  const { width: containerWidth, ref: containerRef } = useResizeDetector();
  const vertical = !containerWidth || containerWidth < 700;
  const rawContent = useContext(TileModelContext)?.content;
  const content = isWaveRunnerContentModel(rawContent) ? rawContent : undefined;

  return (
    <div className="tile-content wave-runner-tile">
      <BasicEditableTileTitle />
      <TileToolbar tileType="wave-runner" readOnly={!!readOnly} tileElement={tileElt} />
      <div ref={containerRef} className="wave-runner-content">
        <div className="title-background" />
        <div className={classNames("sections", { vertical, horizontal: !vertical })}>
          {content && <DataSetup content={content} />}
          <StatusAndOutput />
        </div>
      </div>
    </div>
  );
});
WaveRunnerComponent.displayName = "WaveRunnerComponent";
