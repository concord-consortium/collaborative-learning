import { DateTime } from "luxon";

export function formatTime(time: DateTime) {
  return time.toUTC().toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS);
}

/** Describes the visible time range for screen reader announcements. */
export function describeView({ viewStartTime, viewEndTime }: { viewStartTime?: DateTime, viewEndTime?: DateTime }) {
  return viewStartTime && viewEndTime
    ? `Showing ${formatTime(viewStartTime)} to ${formatTime(viewEndTime)}.`
    : "";
}
