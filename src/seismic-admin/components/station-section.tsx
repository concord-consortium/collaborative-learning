import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useState } from "react";
import { ModelListEntry } from "../../../shared/seismic/model-metadata";
import { useSeismicAdminStore } from "../hooks/use-seismic-admin-stores";
import CheckIcon from "../../assets/icons/check/check-selected.svg";
import WarningIcon from "../../assets/icons/caution.svg";
import { formatBytes, stationLabel } from "../utils/seismic-admin-utils";
import { ConfirmModal } from "./confirm-modal";
import { RawTimeline } from "./raw-timeline";
import "./station-section.scss";

interface ICoverageSectionProps {
  // The station whose coverage is shown; absent for the all-stations aggregate.
  stationKey?: string;
  model: ModelListEntry;
}

/** One model's event coverage: a three-state timeline for a single station,
 *  or an aggregate text line (no bar) across all selected stations. */
const CoverageSection = observer(function CoverageSection({ stationKey, model }: ICoverageSectionProps) {
  const store = useSeismicAdminStore();
  const { firstDay, lastDay } = store;
  const hasRange = firstDay !== undefined && lastDay !== undefined;
  const stats = store.modelStats(model.metadataUrl, stationKey);
  const { eventCount, coveredDays, partialDays, coveredDayCount, totalDays } = stats;

  const statsMessage = `${coveredDayCount} / ${totalDays} days · ${eventCount} events`;
  const highlightedDays = stationKey ? coveredDays.get(stationKey) : undefined;
  const midDays = stationKey ? partialDays.get(stationKey) : undefined;

  return (
    <div className="data-section coverage">
      <div className="data-section-header">
        <div className="data-kind">{model.label}</div>
        <div className="data-stats">{statsMessage}</div>
      </div>
      {hasRange && stationKey && (highlightedDays
        ? <RawTimeline highlightedDays={highlightedDays} partialDays={midDays} firstDay={firstDay} lastDay={lastDay} />
        : "Loading..."
      )}
    </div>
  );
});

interface IStationSectionProps {
  stationKey?: string;
}

/** One or all selected station's data state, with download/delete controls. */
export const StationSection = observer(function StationSection({ stationKey }: IStationSectionProps) {
  const store = useSeismicAdminStore();
  const [confirming, setConfirming] = useState(false);

  const allStations = !stationKey;
  const station = stationKey ? store.stations.get(stationKey) : undefined;

  const stats = allStations ? store.allStats : store.statsFor(stationKey);
  const { firstDay, lastDay, rangeDays, selectedStations } = store;
  const hasRange = firstDay !== undefined && lastDay !== undefined;
  const label = station
    ? stationLabel(station)
    : `All selected stations (${selectedStations.size})`;

  const allTotalDays = rangeDays * selectedStations.size;
  const cachedDaysMessage = allStations
    ? `${allTotalDays - stats.missingCount} / ${allTotalDays}`
    : `${stats.cachedDays?.size ?? 0} / ${rangeDays}`;

  const downloadLabel = `Download ${allStations ? "all " : ""}missing raw data`;
  const downloadRaw = () => {
    if (allStations) {
      void store.downloadAllSelected();
    } else {
      void store.downloadStation(stationKey);
    }
  };

  const isFullyCovered = store.isFullyCovered(stationKey);
  const ReadyIcon = isFullyCovered ? CheckIcon : WarningIcon;
  const readyLabel = isFullyCovered ? "Ready" : "Not Ready!";
  const updateDisabled = !store.authReady || store.selectedModels.size === 0 || isFullyCovered || store.isBusy ||
    (allStations && selectedStations.size === 0);
  const updateLabel = `Update ${allStations ? "all stations" : "station"}`;
  const update = () => {
    if (allStations) {
      void store.updateAllSelected();
    } else {
      void store.updateStation(stationKey);
    }
  };

  const deleteLabel = `Delete ${allStations ? "all " : ""}raw data`;
  const deleteRaw = () => {
    setConfirming(false);
    if (allStations) {
      void store.deleteAllSelected();
    } else {
      void store.deleteRaw(stationKey);
    }
  };

  return (
    <div className={classNames("station-section", { all: allStations})}>
      <div className="station-body">
        <div className="data-sections">
          <div className="data-section">
            <div className="data-section-header">
              <div className="station-name">{label}</div>
              <div className={classNames("station-ready", { "not-ready": !isFullyCovered })}>
                {readyLabel}
                <ReadyIcon className="icon" />
              </div>
            </div>
          </div>
          <div className="data-section">
            <div className="data-section-header">
              <div className="data-kind">Local Raw Data</div>
              <div className="data-stats">{`${cachedDaysMessage} days · ${formatBytes(stats.bytes)}`}</div>
            </div>
            {hasRange && stats?.cachedDays &&
              <RawTimeline highlightedDays={stats.cachedDays} firstDay={firstDay} lastDay={lastDay} />
            }
          </div>
          {store.selectedModelList.map(model => (
            <CoverageSection key={model.metadataUrl} stationKey={stationKey} model={model} />
          ))}
        </div>
        <div className="station-actions">
          <button disabled={updateDisabled} onClick={update}>{updateLabel}</button>
          <button disabled={stats.missingCount === 0 || store.isBusy} onClick={downloadRaw}>{downloadLabel}</button>
          <button className="danger" disabled={store.isBusy} onClick={() => setConfirming(true)}>{deleteLabel}</button>
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
