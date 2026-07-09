import appConfig from "../clue/app-config.json";
import curriculumConfig from "../clue/curriculum-config.json";
import { StationConfig } from "../../shared/seismic/seismic-types";
import { getUrlFromRelativeOrFullString } from "../utilities/url-utils";

/**
 * Resolve a `?unit=` value to a content.json URL, mirroring the main app's
 * CurriculumConfig.getUnitUrl: a full/`./`-relative URL is used as-is; a bare
 * unit code is mapped through unitCodeMap and appended to the curriculum site
 * (default `main` branch). Returns undefined only if the value is empty.
 */
export function unitContentUrl(unitParam: string): string | undefined {
  if (!unitParam) return undefined;
  const direct = getUrlFromRelativeOrFullString(unitParam);
  if (direct) return direct.href;
  const { curriculumSiteUrl, unitCodeMap } = curriculumConfig as
    { curriculumSiteUrl: string; unitCodeMap: Record<string, string> };
  const unitCode = unitCodeMap[unitParam] || unitParam;
  return `${curriculumSiteUrl}/branch/main/${unitCode}/content.json`;
}

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
 * `?unit=` unit's stations when it declares any. `unit` may be a bare unit code, a
 * full http(s) URL, or a `./`-relative asset path. Any failure (unresolvable URL,
 * network error, bad JSON) degrades to the base catalog.
 *
 * Settings merge two levels deep (see ConfigurationManager.settings), so a unit's
 * `wave-runner.stations` array replaces the base list rather than extending it.
 */
export async function loadCatalog(search = window.location.search): Promise<StationConfig[]> {
  const base = defaultCatalog();
  try {
    const unitParam = new URLSearchParams(search).get("unit");
    if (!unitParam) return base;
    const url = unitContentUrl(unitParam);
    if (!url) return base;
    const response = await fetch(url);
    if (!response.ok) return base;
    return stationsFromUnitConfig(await response.json()) ?? base;
  } catch {
    return base;
  }
}
