import React from "react";
import "./data-setup.scss";

export const DataSetup: React.FC = () => {
  return (
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
  );
};
