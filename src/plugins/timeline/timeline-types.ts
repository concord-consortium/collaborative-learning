import { DateTime } from "luxon";

export const kTimelineTileType = "Timeline";

export const kTimelineDefaultHeight = 320;

export interface TimelineEvent {
  index: number;
  windowStart: DateTime;
  windowEnd: DateTime;
  eventType: string;
}
