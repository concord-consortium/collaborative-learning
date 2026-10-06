import { observer } from "mobx-react";
import React, { useEffect, useMemo } from "react";
import { ModelListEntry } from "../../../../shared/seismic/models/model-metadata";
import { StationConfig } from "../../../../shared/seismic/seismic-types";
import { CustomSelect, ICustomDropdownItem } from "../../../clue/components/custom-select";
import { useSettingFromStores } from "../../../hooks/use-stores";
import { stationId } from "../../shared-seismogram/station-model";
import { useWaveRunnerContent } from "../hooks/use-wave-runner-content";
import { kDefaultEndDate, kDefaultStartDate } from "../models/wave-runner-content";
import { DateField } from "./date-field";
import "./data-setup.scss";

export const DataSetup: React.FC = observer(function DataSetup() {
  const content = useWaveRunnerContent();
  const stationConfigs = useSettingFromStores("stations", "wave-runner") as StationConfig[] | undefined;
  const defaultStationIndex = useSettingFromStores("defaultStation", "wave-runner") as number | undefined;
  const modelConfigs = useSettingFromStores("models", "wave-runner") as ModelListEntry[] | undefined;
  const defaultModelIndex = useSettingFromStores("defaultModel", "wave-runner") as number | undefined;

  // Build the options list from config stations
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
    if (!content.station && stationConfigs?.length && defaultStationIndex != null) {
      const defaultConfig = stationConfigs[defaultStationIndex];
      if (defaultConfig) {
        content.setStation({
          network: defaultConfig.network,
          station: defaultConfig.station,
          location: defaultConfig.location ?? "",
          channel: defaultConfig.channel,
          label: defaultConfig.label,
        });
      }
    }
  }, [content, stationConfigs, defaultStationIndex]);

  // Auto-set default model on mount
  useEffect(() => {
    if (!content.selectedModelUrl && modelConfigs?.length && defaultModelIndex != null) {
      const defaultModel = modelConfigs[defaultModelIndex];
      if (defaultModel) {
        content.ensureModelMetadata(defaultModel.metadataUrl);
      }
    }
  }, [content, modelConfigs, defaultModelIndex]);

  const hasStations = dropdownOptions.length > 0;

  const stationItems: ICustomDropdownItem[] = dropdownOptions.map(opt => ({
    id: opt.id,
    text: opt.config.label ?? opt.id,
    selected: opt.id === currentStationId,
    onClick: () => {
      const { network, station, channel, label } = opt.config;
      const location = opt.config.location ?? "";
      content.setStation({ network, station, location, channel, label });
    }
  }));

  const modelItems: ICustomDropdownItem[] = (modelConfigs ?? []).map(model => ({
    id: model.metadataUrl,
    text: model.label,
    selected: model.metadataUrl === content.selectedModelUrl,
    onClick: () => content.ensureModelMetadata(model.metadataUrl)
  }));

  return (
    <div className="section data-setup">
      <div className="section-title">Data Setup</div>
      <div className="field-row">
        <div className="field">
          <label className="field-label">Station</label>
          <CustomSelect
            className="wave-runner-dropdown"
            dataTestId="wave-runner-station"
            items={stationItems}
            title={hasStations ? "Choose a station" : "No stations configured"}
            isDisabled={!hasStations || content.isRunning || content.isLoadingData}
          />
        </div>
        <div className="field">
          <label className="field-label">Model</label>
          <CustomSelect
            className="wave-runner-dropdown"
            dataTestId="wave-runner-model"
            items={modelItems}
            title="Choose a model"
            isDisabled={content.isRunning}
          />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <DateField
            id="wave-runner-start-date"
            label="Start Date and Time"
            value={content.startDate}
            defaultValue={kDefaultStartDate}
            maxValue={content.endDate}
            onChange={date => content.setStartDate(date)}
            isDisabled={content.isRunning || content.isLoadingData}
          />
        </div>
        <div className="field">
          <DateField
            id="wave-runner-end-date"
            label="End Date and Time"
            value={content.endDate}
            defaultValue={kDefaultEndDate}
            minValue={content.startDate}
            onChange={date => content.setEndDate(date)}
            isDisabled={content.isRunning || content.isLoadingData}
          />
        </div>
      </div>
    </div>
  );
});
