import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useEffect, useMemo } from "react";
import { ModelListEntry } from "../../../../shared/seismic/models/model-metadata";
import { StationConfig } from "../../../../shared/seismic/seismic-types";
import { CustomSelect, ICustomDropdownItem } from "../../../clue/components/custom-select";
import { useSettingFromStores } from "../../../hooks/use-stores";
import { stationId } from "../../shared-seismogram/station-model";
import { useWaveRunnerContent } from "../hooks/use-wave-runner-content";
import { kDefaultEndDate, kDefaultStartDate } from "../models/wave-runner-content";
import { todayDateString } from "./date-utils";
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

  // There is no data for a day that has not happened yet, so neither field may reach past today.
  // The start field is additionally capped by the end date, whichever comes first.
  const latestSelectableDate = todayDateString();
  const latestStartDate = content.endDate < latestSelectableDate ? content.endDate : latestSelectableDate;

  // CustomSelect resolves its header as `title || selectedItem.text`, so a non-empty title would
  // permanently mask the chosen station or model. Supply one only while nothing is selected.
  const stationPlaceholder = !hasStations
    ? "No stations configured"
    : (currentStationId ? undefined : "Choose a station");
  const modelPlaceholder = (modelConfigs ?? []).length === 0
    ? "No models configured"
    : (content.selectedModelUrl ? undefined : "Choose a model");

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
          {/* CustomSelect's header is not a native, labelable form control (it is a div with
              role="button"), so a plain htmlFor cannot forward a click to it the way it would for
              a real <select> - id-based aria-labelledby, wired below, is what actually links this
              label to the control for assistive tech. */}
          <label className="field-label" id="wave-runner-station-label">Station</label>
          {/* The placeholder is italic and a chosen label is not, which CSS alone cannot tell
              apart - the header markup is identical either way. */}
          <CustomSelect
            className={classNames("wave-runner-dropdown", { "is-placeholder": !currentStationId })}
            dataTestId="wave-runner-station"
            items={stationItems}
            title={stationPlaceholder}
            ariaLabelledBy="wave-runner-station-label"
            isDisabled={!hasStations || content.isRunning || content.isLoadingData}
          />
        </div>
        <div className="field">
          <label className="field-label" id="wave-runner-model-label">Model</label>
          <CustomSelect
            className={classNames("wave-runner-dropdown", { "is-placeholder": !content.selectedModelUrl })}
            dataTestId="wave-runner-model"
            items={modelItems}
            title={modelPlaceholder}
            ariaLabelledBy="wave-runner-model-label"
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
            maxValue={latestStartDate}
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
            maxValue={latestSelectableDate}
            onChange={date => content.setEndDate(date)}
            isDisabled={content.isRunning || content.isLoadingData}
          />
        </div>
      </div>
    </div>
  );
});
