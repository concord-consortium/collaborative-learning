import { Instance, SnapshotIn, types } from "mobx-state-tree";
import { DrawingObject, DrawingObjectType, IDrawingComponentProps, 
  IToolbarManager, 
  isFilledObject, 
  isStrokedObject, 
  typeField } from "./drawing-object";
import { BoundingBoxDelta, VectorEndShape } from "../model/drawing-basic-types";
import { DrawingObjectMSTUnion } from "../components/drawing-object-manager";
import React from "react";
import { isVectorObject } from "./vector";

export const GroupObject = DrawingObject.named("GroupObject")
  .props({
    type: typeField("group"),
    objects: types.array(types.late(() => DrawingObjectMSTUnion)),
  })
  .views(self => ({
    get boundingBox() {
      if (!self.objects.length) return { nw: { x: 0, y: 0 }, se: { x: 0, y: 0 } };
      return self.objects.reduce((cur, obj) => {
        if (obj) {
          const objBB = obj.boundingBox;
          if (objBB.nw.x < cur.nw.x) cur.nw.x = objBB.nw.x;
          if (objBB.nw.y < cur.nw.y) cur.nw.y = objBB.nw.y;
          if (objBB.se.x > cur.se.x) cur.se.x = objBB.se.x;
          if (objBB.se.y > cur.se.y) cur.se.y = objBB.se.y;
        }
        return cur;
      }, { nw: { x: Number.MAX_VALUE, y: Number.MAX_VALUE }, se: { x: 0, y: 0 } });
    },
    get preDragBoundingBox() {
      if (!self.objects.length) return { nw: { x: 0, y: 0 }, se: { x: 0, y: 0 } };
      return self.objects.reduce((cur, obj) => {
        if (obj) {
          const objBB = obj.preDragBoundingBox;
          if (objBB.nw.x < cur.nw.x) cur.nw.x = objBB.nw.x;
          if (objBB.nw.y < cur.nw.y) cur.nw.y = objBB.nw.y;
          if (objBB.se.x > cur.se.x) cur.se.x = objBB.se.x;
          if (objBB.se.y > cur.se.y) cur.se.y = objBB.se.y;
        }
        return cur;
      }, { nw: { x: Number.MAX_VALUE, y: Number.MAX_VALUE }, se: { x: 0, y: 0 } });
    }
  }))
  .actions(self => ({
    setStroke(stroke: string) {
      self.objects.forEach((member) => {
        if (isStrokedObject(member)) { member.setStroke(stroke); }
      });
    },
    setStrokeDashArray(strokeDashArray: string) {
      self.objects.forEach((member) => {
        if (isStrokedObject(member)) { member.setStrokeDashArray(strokeDashArray); }
      });
    },
    setStrokeWidth(strokeWidth: number) {
      self.objects.forEach((member) => {
        if (isStrokedObject(member)) { member.setStrokeWidth(strokeWidth); }
      });
    },
    setFill(fill: string) {
      self.objects.forEach((member) => {
        if (isFilledObject(member)) { member.setFill(fill); }
      });
    },
    setEndShapes(headShape?: VectorEndShape, tailShape?: VectorEndShape) {
      self.objects.forEach((member) => {
        if (isVectorObject(member)) { member.setEndShapes(headShape, tailShape); }
      });
    },
    setDragBounds(deltas: BoundingBoxDelta) {
      // Each contained object gets adjusted in proportion to its 
      // size relative to the whole group's size.
      const bb = self.preDragBoundingBox;
      const width = bb.se.x - bb.nw.x;
      const height = bb.se.y - bb.nw.y;

      self.objects.forEach((obj) => {
        const objBB = obj.preDragBoundingBox;
        // The four sides of the target object, expressed as a proportion of the size of the group.
        const leftSideRelPosition = (objBB.nw.x - bb.nw.x) / width;
        const rightSideRelPosition = (objBB.se.x - bb.nw.x) / width;
        const topSideRelPosition = (objBB.nw.y - bb.nw.y) / height;
        const botSideRelPosition = (objBB.se.y - bb.nw.y) / height;
        const bounds = {
          left: deltas.left  * (1 - leftSideRelPosition) + deltas.right * leftSideRelPosition,
          right: deltas.left * (1 -rightSideRelPosition) + deltas.right * rightSideRelPosition,
          top: deltas.top    * (1 - topSideRelPosition) + deltas.bottom * topSideRelPosition,
          bottom: deltas.top * (1 - botSideRelPosition) + deltas.bottom * botSideRelPosition
        };
        obj.setDragBounds(bounds);
      });
    },
    resizeObject() {
      self.objects.forEach((obj) => {
        obj.resizeObject();
      });
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
  const group = model as GroupObjectType;
  const {id, boundingBox: bb} = group;
  return <rect
    key={id}
    className="group"
    x={bb.nw.x}
    y={bb.nw.y}
    width={Math.max(bb.se.x-bb.nw.x, 0)}
    height={Math.max(bb.se.y-bb.nw.y, 0)}
    stroke="none"
    fill="none"
    onMouseEnter={(e) => handleHover ? handleHover(e, model, true) : null}
    onMouseLeave={(e) => handleHover ? handleHover(e, model, false) : null}
    onMouseDown={(e)=> handleDrag?.(e, model)}
    pointerEvents={"visible"}
   />;
};

export function createGroup(toolbarManager: IToolbarManager, objects: string[]) {
  const props: GroupObjectSnapshotForAdd = {
    type: "group",
    x: 0,
    y: 0
  };
  const group = toolbarManager.addAndSelectObject(props) as GroupObjectType;
  toolbarManager.moveObjectsIntoGroup(group, objects);
}
