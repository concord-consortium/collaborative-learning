import { observer } from "mobx-react";
import React from "react";
import { WaveRunnerContentModelType } from "../models/wave-runner-content";
import "./data-setup.scss";

interface IProps {
  content: WaveRunnerContentModelType;
}

export const DataSetup: React.FC<IProps> = observer(({ content }) => {
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
DataSetup.displayName = "DataSetup";
