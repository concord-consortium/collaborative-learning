import { observer } from "mobx-react";
import React, { useState } from "react";
import { useSeismicAdminStore } from "../hooks/use-seismic-admin-stores";
import { ConfirmModal } from "./confirm-modal";
import "./all-stations-section.scss";

/** Aggregate summary + bulk download/delete across all selected stations. */
export const AllStationsSection = observer(function AllStationsSection() {
  const store = useSeismicAdminStore();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="all-stations-section">
      <div className="station-name">All selected stations ({store.selected.size})</div>
      <div className="station-body">
        <div className="summary">
          <div>Missing raw days: {store.selectedMissingRawDays}</div>
          <div>Missing envelope days: —</div>
        </div>
        <div className="station-actions">
          <button onClick={() => void store.downloadAllSelected()}>Download all missing raw</button>
          <button className="danger" onClick={() => setConfirming(true)}>Delete all raw</button>
        </div>
      </div>
      {confirming &&
        <ConfirmModal
          message={`Delete raw data for all ${store.selected.size} selected stations ` +
            `from ${store.startDate} to ${store.endDate}?`}
          confirmLabel="Delete all"
          onCancel={() => setConfirming(false)}
          onConfirm={() => { setConfirming(false); void store.deleteAllSelected(); }}
        />}
    </div>
  );
});
