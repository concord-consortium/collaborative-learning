import { getType, types, Instance } from "mobx-state-tree";
import { TileContentModel } from "../../../models/tiles/tile-content";
import { getSharedModelManager } from "../../../models/tiles/tile-environment";
import { SharedSeismogram } from "../../shared-seismogram/shared-seismogram";
import { kTimelineTileType } from "../timeline-types";

export function defaultTimelineContent(): TimelineContentModelType {
  return TimelineContentModel.create();
}

export const TimelineContentModel = TileContentModel
  .named("TimelineTool")
  .props({
    type: types.optional(types.literal(kTimelineTileType), kTimelineTileType),
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    get sharedSeismogram() {
      const smm = getSharedModelManager(self);
      return smm?.findFirstSharedModelByType(SharedSeismogram);
    }
  }))
  .views(self => ({
    get seismogram() {
      return self.sharedSeismogram?.seismogram;
    }
  }));

export interface TimelineContentModelType extends Instance<typeof TimelineContentModel> {}

export function isTimelineContentModel(model: unknown): model is TimelineContentModelType {
  return !!model && getType(model as object) === TimelineContentModel;
}
