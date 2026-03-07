import { types, Instance } from "mobx-state-tree";
import { TileContentModel } from "../../../models/tiles/tile-content";
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
    }
  }));

export interface TimelineContentModelType extends Instance<typeof TimelineContentModel> {}
