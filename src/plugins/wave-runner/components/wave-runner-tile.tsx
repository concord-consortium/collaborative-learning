import { observer } from "mobx-react";
import React from "react";
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";
import { ITileProps } from "../../../components/tiles/tile-component";
import "./wave-runner.scss";

export const WaveRunnerToolComponent: React.FC<ITileProps> = observer(() => {
  return (
    <div className="tile-content wave-runner-tool">
      <BasicEditableTileTitle />
      <div className="wave-runner-content">
        <div className="wave-runner-title-background" />
        <div className="wave-runner-section data-setup">
          <div className="wave-runner-section-title">Data Setup</div>
        </div>
        <div className="wave-runner-section status-and-output">
          <div className="wave-runner-section-title">Status and Output</div>
        </div>
      </div>
    </div>
  );
});
WaveRunnerToolComponent.displayName = "WaveRunnerToolComponent";
