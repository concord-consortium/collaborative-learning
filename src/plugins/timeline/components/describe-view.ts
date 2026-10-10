import { DateTime } from "luxon";

export function formatTime(time: DateTime) {
  return time.toUTC().toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS);
}

/** Describes the visible time range for screen readers, in announcements and as the scrollbar's value. */
export function describeView({ viewStartTime, viewEndTime }: { viewStartTime?: DateTime, viewEndTime?: DateTime }) {
  return viewStartTime && viewEndTime
    ? `Showing ${formatTime(viewStartTime)} to ${formatTime(viewEndTime)}.`
    : "";
}
