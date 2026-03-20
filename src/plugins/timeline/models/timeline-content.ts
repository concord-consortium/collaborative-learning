import { types, Instance } from "mobx-state-tree";
import { DateTime } from "luxon";
import { ITileContentModel, TileContentModel } from "../../../models/tiles/tile-content";
import { getSharedModelManager } from "../../../models/tiles/tile-environment";
import { SharedSeismogram } from "../../shared-seismogram/shared-seismogram";
import { kTimelineTileType } from "../timeline-types";

export const kMinViewRangeSeconds = 5;

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
      return smm?.findFirstSharedModelByType(SharedSeismogram);
    },
    get viewStartTime() {
      return self.viewStartTimeISO ? DateTime.fromISO(self.viewStartTimeISO) : undefined;
    },
    get viewEndTime() {
      return self.viewEndTimeISO ? DateTime.fromISO(self.viewEndTimeISO) : undefined;
    }
  }))
  .views(self => ({
    get seismogram() {
      return self.sharedSeismogram?.seismogram;
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
    }
  }));

export interface TimelineContentModelType extends Instance<typeof TimelineContentModel> {}

export function isTimelineContentModel(model?: ITileContentModel): model is TimelineContentModelType {
  return model?.type === kTimelineTileType;
}
