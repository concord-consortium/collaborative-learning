import React from "react";
import "./data-setup.scss";

export const DataSetup: React.FC = () => {
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
};
