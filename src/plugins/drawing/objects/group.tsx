import React from "react";
import { observer } from "mobx-react";
import { Instance, SnapshotIn, getMembers, isAlive, types } from "mobx-state-tree";
import { DrawingObject, DrawingObjectType, IDrawingComponentProps, 
  StrokedObjectType, 
  isFilledObject, 
  isStrokedObject, 
  typeField } from "./drawing-object";
import { BoundingBoxSides, VectorEndShape } from "../model/drawing-basic-types";
import { DrawingObjectMSTUnion } from "../components/drawing-object-manager";
import { isVectorObject } from "./vector";
import GroupObjectsIcon from "../assets/group-objects-icon.svg";

// An "extent" represents the position of each side of a member object's bounding box,
// as a fraction of the group's overall bounding box.
// The members' extents are stored when the group is created and never changed.
// This avoids objects getting distorted by rounding error if the group is 
// resized to, say, 1 pixel and then expanded again.
const Extents = types.model("Extents")
.props({
  top: types.number,
  right: types.number,
  bottom: types.number,
  left: types.number
});

export const GroupObject = DrawingObject.named("GroupObject")
  .props({
    type: typeField("group"),
    objects: types.array(types.late(() => DrawingObjectMSTUnion)),
    objectExtents: types.map(Extents)
  })
  .views(self => ({
    get boundingBox() {
      if (!isAlive(self) || !self.objects.length) return { nw: { x: 0, y: 0 }, se: { x: 0, y: 0 } };
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
    get label() {
      return "Group";
    },
    get icon() {
      return (<GroupObjectsIcon viewBox="0 0 36 34"/>);
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
        if (getMembers(member).actions.includes("setStrokeDashArray")) { 
          (member as StrokedObjectType).setStrokeDashArray(strokeDashArray); 
        }
      });
    },
    setStrokeWidth(strokeWidth: number) {
      self.objects.forEach((member) => {
        if (getMembers(member).actions.includes("setStrokeWidth")) { 
          (member as StrokedObjectType).setStrokeWidth(strokeWidth); 
        }
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
    computeExtents() {
      // Pre-compute where the four sides of each member are,
      // as a fraction of the overall group bounding box.
      const bb = self.boundingBox;
      const width = bb.se.x - bb.nw.x;
      const height = bb.se.y - bb.nw.y;
      self.objectExtents.clear();
      self.objects.forEach((obj) => {
        const objBB = obj.boundingBox;
        self.objectExtents.set(obj.id, {
          left:   (objBB.nw.x - bb.nw.x) / width,
          right:  (objBB.se.x - bb.nw.x) / width,
          top:    (objBB.nw.y - bb.nw.y) / height,
          bottom: (objBB.se.y - bb.nw.y) / height
        });
      });
    },
    setDragBounds(deltas: BoundingBoxSides) {
      // Each contained object gets adjusted in proportion to its 
      // size relative to the whole group's size.
      self.objects.forEach((obj) => {
        // How much to adjust each side of the object.
        const extent = self.objectExtents.get(obj.id);
        if (!extent) {
          console.error('Unexpected group member appeared: ', obj);
          return;
        }
        const bounds = {
          left:  deltas.left * (1 - extent.left)   +  deltas.right * extent.left,
          right: deltas.left * (1 - extent.right)  +  deltas.right * extent.right,
          top:    deltas.top * (1 - extent.top)    + deltas.bottom * extent.top,
          bottom: deltas.top * (1 - extent.bottom) + deltas.bottom * extent.bottom
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

export const GroupComponent = observer(function GroupComponent(
    {model, handleHover, handleDrag} : IDrawingComponentProps) {
  if (!isGroupObject(model)) return null;
  const group = model as GroupObjectType;
  const {id, boundingBox: bb} = group;
  // Renders as a rectangle that is invisible, but reacts to mouse events
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
});

