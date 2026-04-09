import { types, Instance } from "mobx-state-tree";
import { DateTime } from "luxon";
import { ITileContentModel, TileContentModel } from "../../../models/tiles/tile-content";
import { getSharedModelManager } from "../../../models/tiles/tile-environment";
import { isValidDateTime } from "../../../utilities/luxon-utils";
import { SharedSeismogram, SharedSeismogramType } from "../../shared-seismogram/shared-seismogram";
import { kTimelineTileType } from "../timeline-types";

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
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    get sharedSeismogram() {
      const smm = getSharedModelManager(self);
      return smm?.getTileSharedModelsByType(self, SharedSeismogram)[0] as SharedSeismogramType | undefined;
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
    }
  }))
  .views(self => ({
    get viewRangeSeconds() {
      if (!self.viewStartTime || !self.viewEndTime) return undefined;
      return self.viewEndTime.diff(self.viewStartTime, "seconds").seconds;
    },
    get dataRangeSeconds() {
      if (!self.dataStartTime || !self.dataEndTime) return undefined;
      return self.dataEndTime.diff(self.dataStartTime, "seconds").seconds;
    }
  }))
  .views(self => ({
    get canZoomIn() {
      const range = self.viewRangeSeconds;
      return range !== undefined && range > kMinViewRangeSeconds;
    },
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
    }
  }));

export interface TimelineContentModelType extends Instance<typeof TimelineContentModel> {}

export function isTimelineContentModel(model?: ITileContentModel): model is TimelineContentModelType {
  return model?.type === kTimelineTileType;
}
