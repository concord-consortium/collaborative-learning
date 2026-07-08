import { StationData, StationConfig } from "../../shared/seismic/seismic-types";
import { getStationChannelPrefix } from "../../shared/seismic/tile-addressing";

/** Run-length spans of cached/uncached days across [firstDay, lastDay]. */
export function coverageSegments(cached: Set<number>, firstDay: number, lastDay: number) {
  const segs: { startDay: number; endDay: number; cached: boolean }[] = [];
  for (let day = firstDay; day <= lastDay; day++) {
    const isCached = cached.has(day);
    const last = segs[segs.length - 1];
    if (last && last.cached === isCached) {
      last.endDay = day;
    } else {
      segs.push({ startDay: day, endDay: day, cached: isCached });
    }
  }
  return segs;
}

/** Missing days in the inclusive range [firstDay, lastDay]. */
export function missingDayCount(cachedDays: number, firstDay: number, lastDay: number): number {
  return (lastDay - firstDay + 1) - cachedDays;
}

/** Union OPFS stations with catalog stations into a Map keyed by getStationChannelPrefix. */
export function mergeStations(opfs: StationData[], catalog: StationConfig[]): Map<string, StationConfig> {
  const byKey = new Map<string, StationConfig>();
  for (const o of opfs) byKey.set(getStationChannelPrefix(o), o);
  // Override with entries from catalog when there are collisions, since these have location & label.
  for (const c of catalog) byKey.set(getStationChannelPrefix(c), c);
  return byKey;
}
