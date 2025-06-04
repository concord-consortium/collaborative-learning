import React from "react";
import { observer } from "mobx-react";
import { Instance, SnapshotIn, getMembers, types } from "mobx-state-tree";
import { DrawingObjectType, IDrawingComponentProps,
  StrokedObjectType,
  isFilledObject,
  isStrokedObject,
  typeField,
  ObjectTypeIconViewBox } from "./drawing-object";
import { BoundingBox, VectorEndShape } from "../model/drawing-basic-types";
import { DrawingObjectMSTUnion, renderDrawingObject } from "../components/drawing-object-manager";
import { isVectorObject } from "./vector";
import { useReadOnlyContext } from "../../../components/document/read-only-context";
import { Transformable } from "../components/transformable";
import { SizedObject } from "./sized-object";
import { DrawingScaleProvider } from "../components/drawing-scale-context";
import { boundingBoxSidesForPoints, rotatePoint } from "../model/drawing-utils";

import GroupObjectsIcon from "../assets/group-objects-icon.svg";

export const GroupObject = SizedObject.named("GroupObject")
  .props({
    type: typeField("group"),
    objects: types.array(DrawingObjectMSTUnion),
  })
  .views(self => ({
    get label() {
      return "Group";
    },
    get icon() {
      return (<GroupObjectsIcon viewBox={ObjectTypeIconViewBox}/>);
    }
  }))
  .actions(self => ({
    setVisible(visible: boolean) {
      self.visible = visible;
      self.objects.forEach((member) => { member.setVisible(visible); });
    },
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
    /**
     * Sets up the group by computing the bounding box of its members and setting
     * that as the group's bounding box, then setting each member's position and size
     * to values relative to the group.
     * This is used when the group is created, right after the members are added.
     */
    assimilateObjects() {
      // Compute the overall bounding box of the group's members.
      const bb = self.objects.reduce((cur, obj) => {
        if (obj) {
          const objBB = obj.boundingBox;
          if (objBB.nw.x < cur.nw.x) cur.nw.x = objBB.nw.x;
          if (objBB.nw.y < cur.nw.y) cur.nw.y = objBB.nw.y;
          if (objBB.se.x > cur.se.x) cur.se.x = objBB.se.x;
          if (objBB.se.y > cur.se.y) cur.se.y = objBB.se.y;
        }
        return cur;
      }, { nw: { x: Number.MAX_VALUE, y: Number.MAX_VALUE }, se: { x: -Number.MAX_VALUE, y: -Number.MAX_VALUE } });

      self.x = bb.nw.x;
      self.y = bb.nw.y;
      self.width = bb.se.x - bb.nw.x;
      self.height = bb.se.y - bb.nw.y;

      // Compute where the four sides of each member are as a fraction of the overall group bounding box
      self.objects.forEach((obj) => {
        const objBB = obj.boundingBox;
        obj.setDragBoundsAbsolute({
          left:   (objBB.nw.x - bb.nw.x) / self.width,
          right:  (objBB.se.x - bb.nw.x) / self.width,
          top:    (objBB.nw.y - bb.nw.y) / self.height,
          bottom: (objBB.se.y - bb.nw.y) / self.height
        });
        obj.resizeObject();
      });
    },
    /**
     * Externalize the bounding box of an object that is inside the group.
     * The input is a BoundingBox inside the context of the group,
     * (so it should normally have all sides in the range [0,1]).
     * The output is the BoundingBox relative to the "outside" coordinate system
     * (the one in which the group itself lives).
     * @param internalBB The bounding box of the object inside the group.
     * @returns The adjusted bounding box of the object.
     */
    adjustInternalBoundingBox(internalBB: BoundingBox): BoundingBox {
      const groupBB = self.unrotatedBoundingBox;
      const groupWidth = groupBB.se.x - groupBB.nw.x;
      const groupHeight = groupBB.se.y - groupBB.nw.y;
      const groupRotation = self.rotation;
      const internalNW = {
        x: groupBB.nw.x + internalBB.nw.x * groupWidth,
        y: groupBB.nw.y + internalBB.nw.y * groupHeight
      };
      const internalSE = {
        x: groupBB.nw.x + internalBB.se.x * groupWidth,
        y: groupBB.nw.y + internalBB.se.y * groupHeight
      };
      const rotatedNW = rotatePoint(internalNW, groupBB.se, groupRotation);
      const rotatedSE = rotatePoint(internalSE, groupBB.se, groupRotation);
      const sides = boundingBoxSidesForPoints([rotatedNW, rotatedSE]);
      return {
        nw: { x: sides.left, y: sides.top },
        se: { x: sides.right, y: sides.bottom }
      };
    },
    /** Reverse the "assimilate" operation.
     * Sets the position and size of each member to its actual current position and size
     * without the scaling/rotation of the group.
     * This is used just before the objects are moved out of the group and the group is destroyed.
     */
    unassimilateObjects() {
      const groupBB = self.unrotatedBoundingBox;
      const groupWidth = groupBB.se.x - groupBB.nw.x;
      const groupHeight = groupBB.se.y - groupBB.nw.y;
      const groupRotation = self.rotation;

      self.objects.forEach((obj) => {
        const objBB = obj.boundingBox;
        // This is where the object would be in absolute coordinates if the group were not rotated.
        const objNW = {
          x: groupBB.nw.x + objBB.nw.x * groupWidth,
          y: groupBB.nw.y + objBB.nw.y * groupHeight
        };
        const objSE = {
          x: groupBB.nw.x + objBB.se.x * groupWidth,
          y: groupBB.nw.y + objBB.se.y * groupHeight
        };

        // Rotate the object's points to account for the group's rotation.
        const rotatedNW = rotatePoint(objNW, groupBB.se, groupRotation);
        const rotatedSE = rotatePoint(objSE, groupBB.se, groupRotation);
        // ...and then make the object resize to fit these bounds.
        const boundingBox = boundingBoxSidesForPoints([rotatedNW, rotatedSE]);
        obj.setRotation(obj.rotation + groupRotation);
        obj.setDragBoundsAbsolute(boundingBox);
        obj.resizeObject();
      });
    }
  }))
  .actions(self => ({
    afterCreate() {
      // Group models migrated from v1 to v2 will initially have a width and height of 0.
      // It would be challenging to do the object assimilation in the snapshots, so the migration
      // leaves width and height at 0 to signal that it needs to be done after object creation.
      if (self.objects.length > 0 && self.width === 0 && self.height === 0) {
        self.assimilateObjects();
      }
    }
  }));
export interface GroupObjectType extends Instance<typeof GroupObject> {}
export interface GroupObjectSnapshot extends SnapshotIn<typeof GroupObject> {}
export interface GroupObjectSnapshotForAdd extends SnapshotIn<typeof GroupObject> {type: string}

export function isGroupObject(model: DrawingObjectType): model is GroupObjectType {
  return model.type === "group";
}

function renderChildDrawingObjects(group: GroupObjectType, readOnly: boolean) {
  return group.objects.map((object) => {
    return renderDrawingObject(object, readOnly, undefined, undefined);
  });
}

export const GroupComponent = observer(function GroupComponent(
    {model, handleHover, handleDrag} : IDrawingComponentProps) {
  const readOnly = useReadOnlyContext();
  if (!isGroupObject(model)) return null;
  const group = model as GroupObjectType;
  const {id, currentDims} = group;

  return (
    <Transformable type="group" key={id} transform={group.transform} setAnimating={group.setAnimating}>
      <DrawingScaleProvider scale={{ scaleX: currentDims.width, scaleY: currentDims.height }}>
        <g className="group"
           transform={`scale(${currentDims.width}, ${currentDims.height})`}>
          {renderChildDrawingObjects(group, readOnly)}
          {/* A rectangle that is invisible, but reacts to mouse events for the group*/}
          <rect
            key={id}
            className="group-rect"
            x={0}
            y={0}
            width={1}
            height={1}
            stroke="none" strokeWidth={0}
            fill="none"
            onMouseEnter={(e) => handleHover ? handleHover(e, model, true) : null}
            onMouseLeave={(e) => handleHover ? handleHover(e, model, false) : null}
            onPointerDown={(e) => handleDrag?.(e, model)}
            pointerEvents={"visible"}
          />
        </g>
      </DrawingScaleProvider>
    </Transformable>
  );
});

