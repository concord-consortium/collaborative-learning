import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useState } from "react";
import { useSeismicAdminStore } from "../hooks/use-seismic-admin-stores";
import { formatBytes } from "../utils/seismic-admin-utils";
import { ConfirmModal } from "./confirm-modal";
import { RawTimeline } from "./raw-timeline";
import "./station-section.scss";

interface IStationSectionProps {
  stationKey?: string;
}

/** One station's raw + envelope data state, with per-station download/delete controls. */
export const StationSection = observer(function StationSection({ stationKey }: IStationSectionProps) {
  const store = useSeismicAdminStore();
  const [confirming, setConfirming] = useState(false);

  const allStations = !stationKey;
  const station = stationKey ? store.stations.get(stationKey) : undefined;

  const stats = store.statsFor(stationKey);
  const { firstDay, lastDay } = store;
  const hasRange = firstDay !== undefined && lastDay !== undefined;
  const totalDays = hasRange ? lastDay - firstDay + 1 : 0;
  const label = station
    ? station.label || `${station.network} ${station.station} ${station.channel}`
    : `All selected stations (${store.selected.size})`;

  const cachedDaysMessage = () => {
    if (allStations) {
      const allTotalDays = totalDays * store.selected.size;
      return `${allTotalDays - stats.missingCount} / ${allTotalDays}`;
    } else {
      return `${stats.cachedDays?.size ?? 0} / ${totalDays}`;
    }
  };

  const downloadLabel = `Download ${allStations ? "all " : ""}missing raw data`;
  const downloadRaw = () => {
    if (allStations) {
      store.downloadAllSelected();
    } else {
      store.downloadStation(stationKey);
    }
  };

  const deleteLabel = `Delete ${allStations ? "all " : ""}raw data`;
  const deleteRaw = () => {
    setConfirming(false);
    if (allStations) {
      store.deleteAllSelected();
    } else {
      store.deleteRaw(stationKey);
    }
  };

  return (
    <div className={classNames("station-section", { all: allStations})}>
      <div className="station-name">{label}</div>
      <div className="station-body">
        <div className="data-column">
          <div className="data-row">
            <div className="data-kind">Local Raw Data</div>
            <div className="data-stats">{`${cachedDaysMessage()} days · ${formatBytes(stats.bytes)}`}</div>
          </div>
          {hasRange && stats?.cachedDays &&
            <RawTimeline cachedDays={stats.cachedDays} firstDay={firstDay} lastDay={lastDay} />
          }
        </div>
        <div className="data-column">
          <div className="data-kind">Envelope</div>
          <div className="timeline-placeholder">unavailable</div>
          <div className="data-stats">—</div>
        </div>
        <div className="station-actions">
          <button disabled>Fill envelope</button>
          <button disabled={stats.missingCount === 0} onClick={downloadRaw}>{downloadLabel}</button>
          <button className="danger" onClick={() => setConfirming(true)}>{deleteLabel}</button>
        </div>
      </div>
      {confirming &&
        <ConfirmModal
          message={`Delete raw data for ${label} from ${store.startDate} to ${store.endDate}?`}
          confirmLabel="Delete"
          onCancel={() => setConfirming(false)}
          onConfirm={deleteRaw}
        />}
    </div>
  );
});
