import { DateTime } from "luxon";

export const kTimelineTileType = "Timeline";

export const kTimelineDefaultHeight = 320;

export interface TimelineEvent {
  index: number;
  windowStart: DateTime;
  windowEnd: DateTime;
  eventType: string;
}

export const kEventColorWords = ["blue", "orange", "red", "yellow", "magenta", "purple"];
const allColorWords = new Set(kEventColorWords);

export function getEventColorClass(colorWord?: string): string {
  const word = colorWord && allColorWords.has(colorWord) ? colorWord : "default";
  return `${word}-event`;
}
