const STORAGE_KEY = "seismic-admin-filters";

export interface AdminFilters {
  startDate?: string;
  endDate?: string;
  // Selected station keys (getStationChannelPrefix). Absent means "never chosen".
  selectedStations?: string[];
  // Selected model metadata URLs. Absent means "never chosen".
  selectedModels?: string[];
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === "string");
}

/** Read the saved header filters. Returns {} when absent, malformed, or storage is unavailable. */
export function loadFilters(): AdminFilters {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const { startDate, endDate, selectedStations, selectedModels } = JSON.parse(raw) ?? {};
    return {
      startDate: typeof startDate === "string" ? startDate : undefined,
      endDate: typeof endDate === "string" ? endDate : undefined,
      selectedStations: isStringArray(selectedStations) ? selectedStations : undefined,
      selectedModels: isStringArray(selectedModels) ? selectedModels : undefined,
    };
  } catch {
    return {};
  }
}

/** Persist the header filters. Silently no-ops when storage is unavailable or full. */
export function saveFilters(filters: AdminFilters): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Persistence is a convenience; a failure here must not break the page.
  }
}
