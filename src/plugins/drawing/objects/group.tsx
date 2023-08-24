import { Instance, SnapshotIn, types } from "mobx-state-tree";
import { DrawingObject, DrawingObjectType, IDrawingComponentProps, 
  typeField } from "./drawing-object";
import { BoundingBoxDelta, Point } from "../model/drawing-basic-types";

export const GroupObject = DrawingObject.named("GroupObject")
  .props({
    type: typeField("group"),
    memberIds: types.array(types.string)
  })
  .views(self => ({
    get boundingBox() {
      const {x, y} = self.position;
      const dx = 0; // TODO
      const dy = 0;
      const nw: Point = {x: x, y: y};
      const se: Point = {x: x + dx, y: y + dy};
      return {nw, se};
    }
  }))
  .actions(self => ({
    setDragBounds(deltas: BoundingBoxDelta) {
      // TODO
    },
    resizeObject() {
      // TODO
    }
  }));
export interface GroupObjectType extends Instance<typeof GroupObject> {}
export interface GroupObjectSnapshot extends SnapshotIn<typeof GroupObject> {}

function isGroupObject(model: DrawingObjectType): model is GroupObjectType {
  return model.type === "group";
}

export const GroupComponent = function GroupComponent(
    {model, handleHover, handleDrag} : IDrawingComponentProps) {
  if (!isGroupObject(model)) return null;
  return null;
};


// export function GroupToolbarButton({toolbarManager}: IToolbarButtonProps) {
//   return <SvgToolModeButton modalButton="group" title="Group"
//       toolbarManager={toolbarManager} SvgIcon={GroupIcon} />;
// }
