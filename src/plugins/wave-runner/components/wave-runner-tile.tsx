import classNames from "classnames";
import { observer } from "mobx-react";
import React from "react";
import { useResizeDetector } from "react-resize-detector";
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";
import { ITileProps } from "../../../components/tiles/tile-component";
import "./wave-runner.scss";

export const WaveRunnerToolComponent: React.FC<ITileProps> = observer(() => {
  const { width: containerWidth, ref: containerRef } = useResizeDetector();
  const vertical = !containerWidth || containerWidth < 600;

  return (
    <div className="tile-content wave-runner-tool">
      <BasicEditableTileTitle />
      <div ref={containerRef} className="wave-runner-content">
        <div className="wave-runner-title-background" />
        <div className={classNames("wave-runner-sections", { vertical, horizontal: !vertical })}>
          <div className="wave-runner-section data-setup">
            <div className="wave-runner-section-title">Data Setup</div>
            <div className="wave-runner-field-row">
              <div className="wave-runner-field">
                <label className="wave-runner-field-label">Station</label>
                <select className="wave-runner-dropdown">
                  <option>Choose a station</option>
                </select>
              </div>
              <div className="wave-runner-field">
                <label className="wave-runner-field-label">Model</label>
                <select className="wave-runner-dropdown">
                  <option>Choose a model</option>
                </select>
              </div>
            </div>
            <div className="wave-runner-field-row">
              <div className="wave-runner-field">
                <label className="wave-runner-field-label">Start Date and Time</label>
                <input className="wave-runner-datetime" type="datetime-local" readOnly />
              </div>
              <div className="wave-runner-field">
                <label className="wave-runner-field-label">End Date and Time</label>
                <input className="wave-runner-datetime" type="datetime-local" readOnly />
              </div>
            </div>
          </div>
          <div className="wave-runner-section status-and-output">
            <div className="wave-runner-section-title">Status and Output</div>
          </div>
        </div>
      </div>
    </div>
  );
});
WaveRunnerToolComponent.displayName = "WaveRunnerToolComponent";
