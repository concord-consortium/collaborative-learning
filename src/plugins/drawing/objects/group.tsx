import { Instance, SnapshotIn, types } from "mobx-state-tree";
import { DrawingObject, DrawingObjectType, IDrawingComponentProps, 
  IToolbarManager, 
  ObjectMap, 
  typeField } from "./drawing-object";
import { BoundingBoxDelta, Point } from "../model/drawing-basic-types";
import { DrawingObjectMSTUnion } from "../components/drawing-object-manager";

export const GroupObject = DrawingObject.named("GroupObject")
  .props({
    type: typeField("group"),
    objects: types.array(types.late(() => DrawingObjectMSTUnion)),
  })
  .views(self => ({
    get objectMap() {
        // TODO not sure if this is going to be needed
        return self.objects.reduce((map, obj) => {
          map[obj.id] = obj;
          return map;
        }, {} as ObjectMap);
      },
    get boundingBox() {
        if (!self.objects.length) return {nw: { x: 0, y: 0}, se: { x: 0, y: 0}};
        return self.objects.reduce((cur, obj) => {
            if (obj) {
                const objBB = obj.boundingBox;
                if (objBB.nw.x < cur.nw.x) cur.nw.x = objBB.nw.x;
                if (objBB.nw.y < cur.nw.y) cur.nw.y = objBB.nw.y;
                if (objBB.se.x > cur.se.x) cur.se.x = objBB.se.x;
                if (objBB.se.y > cur.se.y) cur.se.y = objBB.se.y;
            }
            return cur;
        }, {nw : { x: Number.MAX_VALUE, y: Number.MAX_VALUE}, se: { x: 0, y: 0}});
    },
    get supportsResize() {
        return false;
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
export interface GroupObjectSnapshotForAdd extends SnapshotIn<typeof GroupObject> {type: string}

export function isGroupObject(model: DrawingObjectType): model is GroupObjectType {
  return model.type === "group";
}

export const GroupComponent = function GroupComponent(
    {model, handleHover, handleDrag} : IDrawingComponentProps) {
  if (!isGroupObject(model)) return null;
  return null;
};

export function createGroup(toolbarManager: IToolbarManager, objects: string[]) {
    const props: GroupObjectSnapshotForAdd = {
        type: "group",
        x: 0,
        y: 0,
        objects: [] // objects.map((id) => castToReferenceSnapshot(toolbarManager.objectMap[id]))
    };
    console.log('createing group: ', props);
    const group = toolbarManager.addAndSelectObject(props) as GroupObjectType;
    toolbarManager.moveObjectsIntoGroup(group, objects);
    console.log('tada: ', group);
}

// export function GroupToolbarButton({toolbarManager}: IToolbarButtonProps) {
//   return <SvgToolModeButton modalButton="group" title="Group"
//       toolbarManager={toolbarManager} SvgIcon={GroupIcon} />;
// }
