import { observer } from "mobx-react";
import React from "react";
import { DEFAULT_MODELS, WaveRunnerContentModelType } from "../models/wave-runner-content";
import "./data-setup.scss";

interface IProps {
  content: WaveRunnerContentModelType;
}

export const DataSetup: React.FC<IProps> = observer(({ content }) => {
  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const url = e.target.value;
    if (url) {
      content.ensureModelMetadata(url);
    }
  };

  return (
    <div className="section data-setup">
      <div className="section-title">Data Setup</div>
      <div className="field-row">
        <div className="field">
          <label className="field-label">Station</label>
          <select className="dropdown">
            <option>Choose a station</option>
          </select>
        </div>
        <div className="field">
          <label className="field-label">Model</label>
          <select
            className="dropdown"
            value={content.selectedModelUrl ?? ""}
            onChange={handleModelChange}
          >
            <option value="">Choose a model</option>
            {DEFAULT_MODELS.map(model => (
              <option key={model.metadataUrl} value={model.metadataUrl}>
                {model.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label className="field-label">Start Date and Time</label>
          <input className="datetime" type="datetime-local" readOnly />
        </div>
        <div className="field">
          <label className="field-label">End Date and Time</label>
          <input className="datetime" type="datetime-local" readOnly />
        </div>
      </div>
    </div>
  );
});
DataSetup.displayName = "DataSetup";
