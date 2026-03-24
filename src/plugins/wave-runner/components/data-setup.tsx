import { observer } from "mobx-react";
import React from "react";
import { useWaveRunnerContent } from "../hooks/use-wave-runner-content";
import "./data-setup.scss";

export const DataSetup: React.FC = observer(function DataSetup() {
  const content = useWaveRunnerContent();

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
          <select className="dropdown">
            <option>Choose a model</option>
          </select>
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label className="field-label" htmlFor="wave-runner-start-date">Start Date</label>
          <input
            id="wave-runner-start-date"
            className="datetime"
            type="date"
            value={content.startDate}
            onChange={e => content.setStartDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="wave-runner-end-date">End Date</label>
          <input
            id="wave-runner-end-date"
            className="datetime"
            type="date"
            value={content.endDate}
            onChange={e => content.setEndDate(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
});
