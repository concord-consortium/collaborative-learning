import { FINEST_LEVEL, S3_PREFIX, TILE_BASE_URL } from "./envelope-config";
import { dayIndex, dayRange } from "../seismic-day";
import { DayCoverageState, DaySpan, StationData, TimeRange } from "../seismic-types";
import { getLevelPath } from "../station-addressing";
import { getS3Root, getTileIndicesForViewport } from "./tile-addressing";

type ListFetchFn = (url: string) => Promise<Pick<Response, "ok" | "status" | "text">>;

/** All existing L2 tile indices for a station, via anonymous paginated S3 listing. */
export async function listEnvelopeTileIndices(
  stationData: StationData, fetchFn: ListFetchFn = fetch
): Promise<Set<number>> {
  const prefix = `${getS3Root(S3_PREFIX)}${getLevelPath(stationData, FINEST_LEVEL)}/`;
  const indices = new Set<number>();
  let continuationToken: string | undefined;
  do {
    let url = `${TILE_BASE_URL}?list-type=2&max-keys=1000&prefix=${encodeURIComponent(prefix)}`;
    if (continuationToken) url += `&continuation-token=${encodeURIComponent(continuationToken)}`;
    const response = await fetchFn(url);
    if (!response.ok) throw new Error(`Envelope tile listing failed: ${response.status}`);
    const doc = new DOMParser().parseFromString(await response.text(), "text/xml");
    for (const keyEl of Array.from(doc.getElementsByTagName("Key"))) {
      const key = keyEl.textContent ?? "";
      const segment = key.slice(key.lastIndexOf("/") + 1);
      if (/^\d+$/.test(segment)) indices.add(Number(segment));
    }
    const truncated = doc.getElementsByTagName("IsTruncated")[0]?.textContent === "true";
    continuationToken = truncated
      ? doc.getElementsByTagName("NextContinuationToken")[0]?.textContent ?? undefined
      : undefined;
  } while (continuationToken);
  return indices;
}

/** Envelope coverage state for each UTC day in [range.start, range.end):
 *  covered when every overlapping L2 tile exists, partial when some do. */
export function classifyEnvelopeDayCoverage(
  tileIndices: Set<number>, range: TimeRange
): Map<number, DayCoverageState> {
  const states = new Map<number, DayCoverageState>();
  for (let day = dayIndex(range.start); day <= dayIndex(range.end - 1); day++) {
    const { start, end } = dayRange(day);
    const overlapping = getTileIndicesForViewport(start, end, FINEST_LEVEL);
    const present = overlapping.filter(i => tileIndices.has(i)).length;
    states.set(day, present === overlapping.length ? "covered" : present > 0 ? "partial" : "uncovered");
  }
  return states;
}

/** Contiguous runs of days in range that are not fully covered. */
export function missingEnvelopeDaySpans(tileIndices: Set<number>, range: TimeRange): DaySpan[] {
  const spans: DaySpan[] = [];
  for (const [day, state] of classifyEnvelopeDayCoverage(tileIndices, range)) {
    if (state === "covered") continue;
    const last = spans[spans.length - 1];
    if (last && last.endDay === day - 1) {
      last.endDay = day;
    } else {
      spans.push({ startDay: day, endDay: day });
    }
  }
  return spans;
}
