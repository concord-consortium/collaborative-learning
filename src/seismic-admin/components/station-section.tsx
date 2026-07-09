import { observer } from "mobx-react";
import React, { useState } from "react";
import { useSeismicAdminStore } from "../hooks/use-seismic-admin-stores";
import { formatBytes } from "../seismic-admin-utils";
import { ConfirmModal } from "./confirm-modal";
import { RawTimeline } from "./raw-timeline";
import "./station-section.scss";

interface IStationSectionProps {
  stationKey: string;
}

/** One station's raw + envelope data state, with per-station download/delete controls. */
export const StationSection = observer(function StationSection({ stationKey }: IStationSectionProps) {
  const store = useSeismicAdminStore();
  const [confirming, setConfirming] = useState(false);

  const station = store.stations.get(stationKey);
  if (!station) return null;

  const stats = store.statsFor(stationKey);
  const { firstDay, lastDay } = store;
  const hasRange = firstDay !== undefined && lastDay !== undefined;
  const totalDays = hasRange ? lastDay - firstDay + 1 : 0;
  const label = station.label || `${station.network} ${station.station} ${station.channel}`;

  return (
    <div className="station-section">
      <div className="station-name">{label}</div>
      <div className="station-body">
        <div className="data-column">
          <div className="data-kind">Raw</div>
          {hasRange && stats
            ? <RawTimeline cachedDays={stats.cachedDays} firstDay={firstDay} lastDay={lastDay} />
            : <div className="timeline-placeholder">unavailable</div>}
          <div className="data-stats">
            {stats ? `${stats.cachedDays.size} / ${totalDays} days · ${formatBytes(stats.bytes)}` : "—"}
          </div>
        </div>
        <div className="data-column">
          <div className="data-kind">Envelope</div>
          <div className="timeline-placeholder">unavailable</div>
          <div className="data-stats">—</div>
        </div>
        <div className="station-actions">
          <button disabled>Fill envelope</button>
          <button onClick={() => void store.downloadStation(stationKey)}>Download missing raw</button>
          <button className="danger" onClick={() => setConfirming(true)}>Delete raw</button>
        </div>
      </div>
      {confirming &&
        <ConfirmModal
          message={`Delete raw data for ${label} from ${store.startDate} to ${store.endDate}?`}
          confirmLabel="Delete"
          onCancel={() => setConfirming(false)}
          onConfirm={() => { setConfirming(false); void store.deleteRaw(stationKey); }}
        />}
    </div>
  );
});
