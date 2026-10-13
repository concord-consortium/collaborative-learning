import { DateTime } from "luxon";
import { kEventStyles } from "./timeline-event-styles";

export const kTimelineTileType = "Timeline";

// Tall enough for the whole tile without scrolling. The stack measures 422px: a 26px title, the
// container's 46px and 15px margins, an 18px event row, 251px of graph, range labels and Full
// Timeline, and the 28px Event Key with the 16px step above it. The rest is slack.
export const kTimelineDefaultHeight = 440;

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
