import { ModelListEntry } from "../../../shared/seismic/model-metadata";
import { StationConfig } from "../../../shared/seismic/seismic-types";
import appConfig from "../../clue/app-config.json";
import curriculumConfigJson from "../../clue/curriculum-config.json";
import { getUnitJson } from "../../models/curriculum/unit-utils";
import { CurriculumConfig } from "../../models/stores/curriculum-config";
import { urlParams } from "../../utilities/url-params";

function settingsFromUnitConfig(unitJson: any) {
  return unitJson?.config?.settings ?? unitJson?.settings;
}

/**
 * Pull the wave-runner station catalog out of a unit config JSON.
 * Stations live under `config.settings["wave-runner"].stations`; older units keep
 * `settings` at the top level. Returns undefined when the unit declares no stations.
 */
export function stationsFromUnitConfig(unitJson: any): StationConfig[] | undefined {
  const settings = settingsFromUnitConfig(unitJson);
  const stations = settings?.["wave-runner"]?.stations;
  return Array.isArray(stations) ? stations as StationConfig[] : undefined;
}

/**
 * Pull the wave-runner model list out of a unit config JSON. Models live under
 * `config.settings["wave-runner"].models` (or top-level `settings` in older
 * units). Returns undefined when the unit declares no (or malformed) models.
 */
export function modelsFromUnitConfig(unitJson: any): ModelListEntry[] | undefined {
  const settings = settingsFromUnitConfig(unitJson);
  const models = settings?.["wave-runner"]?.models;
  return Array.isArray(models) ? models as ModelListEntry[] : undefined;
}

export interface AdminCatalog {
  stations: StationConfig[];
  models: ModelListEntry[];
}

export function defaultCatalog(): AdminCatalog {
  return {
    stations: stationsFromUnitConfig(appConfig) ?? [],
    models: modelsFromUnitConfig(appConfig) ?? [],
  };
}

/**
 * The station and model catalog for the page: the app-config defaults, each
 * overridden independently by the `?unit=` unit's when it declares any. The unit
 * param is resolved and fetched with the same code the main app uses
 * (CurriculumConfig.getUnitUrl and getUnitJson), so `curriculumBranch` and
 * `authoringBranch` params work here too. Any failure (network error, bad JSON,
 * 404) degrades to the base catalog.
 *
 * Settings merge two levels deep (see ConfigurationManager.settings), so a unit's
 * `wave-runner.stations`/`.models` arrays replace the base lists rather than
 * extending them.
 */
export async function loadCatalog(): Promise<AdminCatalog> {
  const base = defaultCatalog();
  try {
    // Bail out before getUnitJson: getUnitSpec would otherwise fall back to the
    // main app's defaultUnit, which shouldn't affect the admin page.
    if (!urlParams.unit) return base;

    const curriculumConfig = CurriculumConfig.create(curriculumConfigJson, { urlParams });
    const unitJson = await getUnitJson(urlParams.unit, curriculumConfig);
    return {
      stations: stationsFromUnitConfig(unitJson) ?? base.stations,
      models: modelsFromUnitConfig(unitJson) ?? base.models,
    };
  } catch {
    return base;
  }
}
