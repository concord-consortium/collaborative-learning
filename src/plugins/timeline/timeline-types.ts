import { DateTime } from "luxon";
import { kEventStyles } from "./timeline-event-styles";

export const kTimelineTileType = "Timeline";

// Tall enough for the whole tile without scrolling: a 26px title, the container's 46px and 15px
// margins, an 18px event row, 251px of graph, range labels and Full Timeline, and the Event Key
// with the 16px step above it. The rest is slack. `timeline_event_key_spec` asserts the tile does
// not scroll at this height, so anything that adds a row fails there rather than silently scroll.
export const kTimelineDefaultHeight = 460;

export interface TimelineEvent {
  index: number;
  windowStart: DateTime;
  windowEnd: DateTime;
  eventType: string;
}

export const kEventColorWords = kEventStyles.map(s => s.colorWord);
const allColorWords = new Set(kEventColorWords);

export function getEventColorClass(colorWord?: string): string {
  const word = colorWord && allColorWords.has(colorWord) ? colorWord : "default";
  return `${word}-event`;
}
