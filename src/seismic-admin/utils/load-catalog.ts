import appConfig from "../../clue/app-config.json";
import curriculumConfigJson from "../../clue/curriculum-config.json";
import { StationConfig } from "../../../shared/seismic/seismic-types";
import { getUnitJson } from "../../models/curriculum/unit-utils";
import { CurriculumConfig } from "../../models/stores/curriculum-config";
import { urlParams } from "../../utilities/url-params";

function stationsFromSettings(settings: any): StationConfig[] | undefined {
  const stations = settings?.["wave-runner"]?.stations;
  return Array.isArray(stations) ? stations as StationConfig[] : undefined;
}

/**
 * Pull the wave-runner station catalog out of a (fetched) unit config JSON.
 * Stations live under `config.settings["wave-runner"].stations`; older units keep
 * `settings` at the top level. Returns undefined when the unit declares no stations,
 * so the caller can fall back to the base catalog.
 */
export function stationsFromUnitConfig(unitJson: any): StationConfig[] | undefined {
  return stationsFromSettings(unitJson?.config?.settings ?? unitJson?.settings);
}

/** The base station catalog from the default app config, used when a unit declares none. */
export function defaultCatalog(): StationConfig[] {
  return stationsFromSettings((appConfig as any).config?.settings) ?? [];
}

/**
 * The station catalog for the page: the app-config defaults, overridden by the
 * `?unit=` unit's stations when it declares any. The unit param is resolved and
 * fetched with the same code the main app uses (CurriculumConfig.getUnitUrl and
 * getUnitJson), so `curriculumBranch` and `authoringBranch` params work here too.
 * Any failure (network error, bad JSON, 404) degrades to the base catalog.
 *
 * Settings merge two levels deep (see ConfigurationManager.settings), so a unit's
 * `wave-runner.stations` array replaces the base list rather than extending it.
 */
export async function loadCatalog(): Promise<StationConfig[]> {
  const base = defaultCatalog();
  try {
    // Bail out before getUnitJson: getUnitSpec would otherwise fall back to the
    // main app's defaultUnit, which shouldn't affect the admin page.
    if (!urlParams.unit) return base;

    const curriculumConfig = CurriculumConfig.create(curriculumConfigJson, { urlParams });
    return stationsFromUnitConfig(await getUnitJson(urlParams.unit, curriculumConfig)) ?? base;
  } catch {
    return base;
  }
}
