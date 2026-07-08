import { observer } from "mobx-react";
import React, { useState } from "react";
import { useSeismicAdminStore } from "../hooks/use-seismic-admin-stores";
import "./admin-header.scss";

/** Fixed header: station filter checkboxes + a start/end date range and an Apply button. */
export const AdminHeader = observer(function AdminHeader() {
  const store = useSeismicAdminStore();

  // Draft date range — applied to the store only when Apply is clicked.
  const [start, setStart] = useState(store.startDate);
  const [end, setEnd] = useState(store.endDate);

  const apply = () => {
    store.setRange(start, end);
    void store.refresh();
  };

  const applyDisabled = start === store.startDate && end === store.endDate;

  return (
    <div className="admin-header">
      <h3>Seismic Admin</h3>
      <div className="options">
        <div className="option-area">
          <div className="option-header">Stations</div>
          <div className="stations">
            {[...store.stations].map(([key, station]) => (
              <label className="station-checkbox" key={key}>
                <input
                  type="checkbox"
                  checked={store.selected.has(key)}
                  onChange={() => store.toggle(key)}
                />
                {station.label || `${station.network} ${station.station} ${station.channel}`}
              </label>
            ))}
          </div>
        </div>
        <div className="option-area">
          <div className="option-header">Date Range</div>
          <div className="dates">
            <label>Start <input type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
            <label>End <input type="date" value={end} onChange={e => setEnd(e.target.value)} /></label>
          </div>
        </div>
      </div>
      <div className="controls">
        <button disabled={applyDisabled} onClick={apply}>Apply</button>
      </div>
    </div>
  );
});
