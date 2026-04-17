import { getSnapshot, types, Instance } from "mobx-state-tree";
import { DateTime, Duration } from "luxon";
import stringify from "json-stringify-pretty-compact";
import { ITileContentModel, TileContentModel } from "../../../models/tiles/tile-content";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { getSharedModelManager } from "../../../models/tiles/tile-environment";
import { isValidDateTime } from "../../../utilities/luxon-utils";
import { SharedDataSet, SharedDataSetType } from "../../../models/shared/shared-data-set";
import { SharedSeismogram, SharedSeismogramType } from "../../shared-seismogram/shared-seismogram";
import { TimelineEvent, kEventColorWords, kTimelineTileType } from "../timeline-types";

export const kMinViewRangeSeconds = 2;

export function defaultTimelineContent(): TimelineContentModelType {
  return TimelineContentModel.create();
}

export const TimelineContentModel = TileContentModel
  .named("TimelineTool")
  .props({
    type: types.optional(types.literal(kTimelineTileType), kTimelineTileType),
    viewStartTimeISO: types.maybe(types.string),
    viewEndTimeISO: types.maybe(types.string),
    selectedEventIndex: types.optional(types.number, 0),
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    exportJson(options?: ITileExportOptions) {
      return stringify(getSnapshot(self), {maxLength: 200});
    },
    get sharedSeismogram() {
      const smm = getSharedModelManager(self);
      return smm?.getTileSharedModelsByType(self, SharedSeismogram)[0] as SharedSeismogramType | undefined;
    },
    get sharedDataSet() {
      const smm = getSharedModelManager(self);
      return smm?.getTileSharedModelsByType(self, SharedDataSet)[0] as SharedDataSetType | undefined;
    },
    get viewStartTime() {
      if (!self.viewStartTimeISO) return undefined;
      const time = DateTime.fromISO(self.viewStartTimeISO);
      return time.isValid ? time : undefined;
    },
    get viewEndTime() {
      if (!self.viewEndTimeISO) return undefined;
      const time = DateTime.fromISO(self.viewEndTimeISO);
      return time.isValid ? time : undefined;
    }
  }))
  .views(self => ({
    get hasStationData() {
      return !!self.sharedSeismogram?.station;
    },
    get dataStartTime(): DateTime | undefined {
      return self.sharedSeismogram?.startTime;
    },
    get dataEndTime(): DateTime | undefined {
      return self.sharedSeismogram?.endTime;
    },
    get viewRangeSeconds() {
      if (!self.viewStartTime || !self.viewEndTime) return undefined;
      return self.viewEndTime.diff(self.viewStartTime, "seconds").seconds;
    },
    get events(): TimelineEvent[] {
      const ds = self.sharedDataSet?.dataSet;
      if (!ds) return [];
      const windowStartAttr = ds.attrFromName("windowStart");
      const windowEndAttr = ds.attrFromName("windowEnd");
      const eventTypeAttr = ds.attrFromName("eventType");
      if (!windowStartAttr || !windowEndAttr || !eventTypeAttr) {
        console.warn("Timeline: SharedDataSet missing required attribute(s)",
          { windowStart: !!windowStartAttr, windowEnd: !!windowEndAttr, eventType: !!eventTypeAttr });
        return [];
      }

      const events: TimelineEvent[] = [];
      for (const c of ds.cases) {
        const startStr = ds.getStrValue(c.__id__, windowStartAttr.id);
        const endStr = ds.getStrValue(c.__id__, windowEndAttr.id);
        const eventType = ds.getStrValue(c.__id__, eventTypeAttr.id);
        const windowStart = DateTime.fromISO(startStr);
        const windowEnd = DateTime.fromISO(endStr);
        if (windowStart.isValid && windowEnd.isValid && eventType) {
          events.push({ index: 0, windowStart, windowEnd, eventType });
        }
      }
      events.sort((a, b) => a.windowStart.toMillis() - b.windowStart.toMillis());
      events.forEach((e, i) => e.index = i);
      return events;
    },
    get modelLabel(): string {
      const ds = self.sharedDataSet?.dataSet;
      if (!ds) return "";
      const attr = ds.attrFromName("modelLabel");
      if (!attr || ds.cases.length === 0) return "";
      return ds.getStrValue(ds.cases[0].__id__, attr.id) ?? "";
    },
    get eventTypeColorWords(): Map<string, string> {
      const ds = self.sharedDataSet?.dataSet;
      if (!ds) return new Map();
      const eventTypeAttr = ds.attrFromName("eventType");
      if (!eventTypeAttr) return new Map();

      const colorMap = new Map<string, string>();
      let colorIndex = 0;
      for (const c of ds.cases) {
        const eventType = ds.getStrValue(c.__id__, eventTypeAttr.id);
        if (eventType && !colorMap.has(eventType) && colorIndex < kEventColorWords.length) {
          colorMap.set(eventType, kEventColorWords[colorIndex]);
          colorIndex++;
        }
      }
      return colorMap;
    }
  }))
  .views(self => ({
    get dataRangeSeconds() {
      if (!self.dataStartTime || !self.dataEndTime) return undefined;
      return self.dataEndTime.diff(self.dataStartTime, "seconds").seconds;
    },
    get viewRangeDurationText() {
      const totalSeconds = self.viewRangeSeconds;
      if (totalSeconds == null) return undefined;
      return Duration.fromObject({ seconds: totalSeconds })
        .shiftTo("weeks", "days", "hours", "minutes", "seconds")
        .toHuman({ showZeros: false });
    },
    get canZoomIn() {
      const range = self.viewRangeSeconds;
      return range !== undefined && range > kMinViewRangeSeconds;
    },
    get visibleEvents(): TimelineEvent[] {
      if (!self.viewStartTime || !self.viewEndTime) return [];
      return self.events.filter(e =>
        e.windowEnd > self.viewStartTime! && e.windowStart < self.viewEndTime!
      );
    },
    get selectedEvent(): TimelineEvent | undefined {
      const events = self.events;
      if (events.length === 0) return undefined;
      const idx = Math.max(0, Math.min(self.selectedEventIndex, events.length - 1));
      return events[idx];
    },
    get canSelectPrev() {
      return self.events.length > 0 && self.selectedEventIndex > 0;
    },
    get canSelectNext() {
      return self.selectedEventIndex < self.events.length - 1;
    },
    get selectedEventLabel() {
      if (self.events.length === 0) return "Event";
      return `Event ${self.selectedEventIndex + 1}`;
    }
  }))
  .views(self => ({
    get canZoomOut() {
      const viewRange = self.viewRangeSeconds;
      const dataRange = self.dataRangeSeconds;
      if (viewRange === undefined || dataRange === undefined) return false;
      return viewRange < dataRange;
    }
  }))
  .views(self => ({
    get canFitToData() {
      return self.canZoomOut;
    }
  }))
  .actions(self => ({
    setViewRange(start: DateTime, end: DateTime) {
      if (!isValidDateTime(start) || !isValidDateTime(end) || start >= end) return;
      self.viewStartTimeISO = start.toISO() ?? undefined;
      self.viewEndTimeISO = end.toISO() ?? undefined;
    }
  }))
  .actions(self => ({
    fitToData() {
      if (self.dataStartTime && self.dataEndTime) {
        self.setViewRange(self.dataStartTime, self.dataEndTime);
      }
    },
    zoom(factor: number) {
      if (!self.viewStartTime || self.viewRangeSeconds == null) return;
      if (!self.dataStartTime || !self.dataEndTime || self.dataRangeSeconds == null) return;

      // Clamp to [kMinViewRangeSeconds, self.dataRangeSeconds]
      const newRange = Math.max(Math.min(self.viewRangeSeconds * factor, self.dataRangeSeconds), kMinViewRangeSeconds);
      const center = self.viewStartTime.plus({ seconds: self.viewRangeSeconds / 2 });
      let newStart = center.minus({ seconds: newRange / 2 });
      let newEnd = center.plus({ seconds: newRange / 2 });

      // Shift if bumping into edges
      if (newStart < self.dataStartTime) {
        newStart = self.dataStartTime;
        newEnd = newStart.plus({ seconds: newRange });
      }
      if (newEnd > self.dataEndTime) {
        newEnd = self.dataEndTime;
        newStart = newEnd.minus({ seconds: newRange });
      }

      self.setViewRange(newStart, newEnd);
    },
    panLeft() {
      if (!self.viewStartTime || self.viewRangeSeconds == null) return;
      if (!self.dataStartTime || !self.dataEndTime || self.dataRangeSeconds == null) return;

      let newStartTime = self.viewStartTime.minus({ seconds: self.viewRangeSeconds / 4 });
      if (newStartTime < self.dataStartTime) newStartTime = self.dataStartTime;
      const newEndTime = newStartTime.plus({ seconds: self.viewRangeSeconds });

      self.setViewRange(newStartTime, newEndTime);
    },
    panRight() {
      if (!self.viewStartTime || !self.viewEndTime || self.viewRangeSeconds == null) return;
      if (!self.dataStartTime || !self.dataEndTime || self.dataRangeSeconds == null) return;

      let newEndTime = self.viewEndTime.plus({ seconds: self.viewRangeSeconds / 4 });
      if (newEndTime > self.dataEndTime) newEndTime = self.dataEndTime;
      const newStartTime = newEndTime.minus({ seconds: self.viewRangeSeconds });

      self.setViewRange(newStartTime, newEndTime);
    },
    focusEvent() {
      const event = self.selectedEvent;
      if (!event) return;
      // Adjust view to show the event with 25% padding
      const durationSeconds = event.windowEnd.diff(event.windowStart, "seconds").seconds;
      const paddingSeconds = durationSeconds * 0.25;
      let newStart = event.windowStart.minus({ seconds: paddingSeconds });
      let newEnd = event.windowEnd.plus({ seconds: paddingSeconds });
      // Clamp to data bounds
      if (self.dataStartTime && newStart < self.dataStartTime) {
        newStart = self.dataStartTime;
      }
      if (self.dataEndTime && newEnd > self.dataEndTime) {
        newEnd = self.dataEndTime;
      }
      self.setViewRange(newStart, newEnd);
    }
  }))
  .actions(self => ({
    selectEvent(index: number) {
      const events = self.events;
      if (events.length === 0) return;
      self.selectedEventIndex = Math.max(0, Math.min(index, events.length - 1));
      self.focusEvent();
    }
  }))
  .actions(self => ({
    selectNextEvent() {
      if (self.canSelectNext) {
        self.selectEvent(self.selectedEventIndex + 1);
      }
    },
    selectPrevEvent() {
      if (self.canSelectPrev) {
        self.selectEvent(self.selectedEventIndex - 1);
      }
    }
  }));

export interface TimelineContentModelType extends Instance<typeof TimelineContentModel> {}

export function isTimelineContentModel(model?: ITileContentModel): model is TimelineContentModelType {
  return model?.type === kTimelineTileType;
}
