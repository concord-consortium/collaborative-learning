import { observer } from "mobx-react";
import React, { useEffect, useMemo } from "react";
import { useSettingFromStores } from "../../../hooks/use-stores";
import { StationConfig, stationId } from "../../shared-seismogram/station-model";
import { useWaveRunnerContent } from "../hooks/use-wave-runner-content";
import "./data-setup.scss";

export const DataSetup: React.FC = observer(function DataSetup() {
  const content = useWaveRunnerContent();
  const stationConfigs = useSettingFromStores("stations", "wave-runner") as StationConfig[] | undefined;
  const defaultStationIndex = (useSettingFromStores("defaultStation", "wave-runner") as number) ?? 0;

  // Build the options list: config stations + orphaned saved station
  const stationOptions = useMemo(() => {
    const options = (stationConfigs ?? []).map(config => ({
      config,
      id: stationId(config),
    }));
    return options;
  }, [stationConfigs]);

  // Compute the current station's id for matching
  const currentStationId = content.station
    ? stationId(content.station)
    : undefined;

  // Check if the saved station is orphaned (not in config)
  const isOrphaned = currentStationId != null
    && stationOptions.every(opt => opt.id !== currentStationId);

  // Build the full dropdown list including orphaned station
  const dropdownOptions = useMemo(() => {
    if (!isOrphaned || !content.station) return stationOptions;
    return [
      ...stationOptions,
      { config: content.station as StationConfig, id: currentStationId! },
    ];
  }, [stationOptions, isOrphaned, content.station, currentStationId]);

  // Auto-set default station on mount
  useEffect(() => {
    if (!content.station && stationConfigs?.length) {
      const defaultConfig = stationConfigs[defaultStationIndex] ?? stationConfigs[0];
      content.setStation({
        network: defaultConfig.network,
        station: defaultConfig.station,
        location: defaultConfig.location ?? "",
        channel: defaultConfig.channel,
        label: defaultConfig.label,
      });
    }
  }, [content, stationConfigs, defaultStationIndex]);

  const handleStationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const match = dropdownOptions.find(opt => opt.id === selectedId);
    if (match) {
      content.setStation({
        network: match.config.network,
        station: match.config.station,
        location: match.config.location ?? "",
        channel: match.config.channel,
        label: match.config.label,
      });
    }
  };

  const hasStations = dropdownOptions.length > 0;

  return (
    <div className="section data-setup">
      <div className="section-title">Data Setup</div>
      <div className="field-row">
        <div className="field">
          <label className="field-label" htmlFor="wave-runner-station">Station</label>
          <select
            id="wave-runner-station"
            className="dropdown"
            value={currentStationId ?? ""}
            onChange={handleStationChange}
            disabled={!hasStations}
          >
            {!hasStations && <option value="">No stations configured</option>}
            {dropdownOptions.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.config.label}</option>
            ))}
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
          <label className="field-label" htmlFor="wave-runner-start-date">Start Date and Time</label>
          <input
            id="wave-runner-start-date"
            className="datetime"
            type="datetime-local"
            value={`${content.startDate}T00:00`}
            onChange={e => content.setStartDate(e.target.value.split("T")[0])}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="wave-runner-end-date">End Date and Time</label>
          <input
            id="wave-runner-end-date"
            className="datetime"
            type="datetime-local"
            value={`${content.endDate}T00:00`}
            onChange={e => content.setEndDate(e.target.value.split("T")[0])}
          />
        </div>
      </div>
    </div>
  );
});
