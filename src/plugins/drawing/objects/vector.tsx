import { observer } from "mobx-react";
import { Instance, SnapshotIn, types, getSnapshot } from "mobx-state-tree";
import React from "react";
import {
  computeStrokeDashArray, DrawingObjectType, DrawingTool, IDrawingComponentProps,
  IDrawingLayer, ObjectTypeIconViewBox, StrokedObject, typeField
} from "./drawing-object";
import { BoundingBoxSides, Point, VectorEndShape,
  endShapesForVectorType, getVectorTypeIcon, vectorTypeForEndShapes }
  from "../model/drawing-basic-types";
import { Transformable } from "../components/transformable";

// Line or arrow
export const VectorObject = StrokedObject.named("VectorObject")
  .props({
    type: typeField("vector"),
    dx: types.number,
    dy: types.number,
    headShape: types.maybe(types.enumeration<VectorEndShape>("EndShape", Object.values(VectorEndShape))),
    tailShape: types.maybe(types.enumeration<VectorEndShape>("EndShape", Object.values(VectorEndShape)))
  })
  .volatile(self => ({
    dragDx: undefined as number | undefined,
    dragDy: undefined as number | undefined
  }))
  .views(self => ({
    get boundingBox() {
      const { x, y } = self.position;
      const dx = self.dragDx ?? self.dx;
      const dy = self.dragDy ?? self.dy;
      const nw: Point = {x: Math.min(x, x + dx), y: Math.min(y, y + dy)};
      const se: Point = {x: Math.max(x, x + dx), y: Math.max(y, y + dy)};
      return {nw, se};
    },
    get label() {
      return  (self.headShape || self.tailShape) ? "Arrow" : "Line";
    },
    get icon() {
      const Icon = getVectorTypeIcon(vectorTypeForEndShapes(self.headShape, self.tailShape));
      return (<Icon viewBox={ObjectTypeIconViewBox} stroke={self.stroke} fill={self.stroke} />);
    }
  }))
  .actions(self => ({
    setDeltas(dx: number, dy: number) {
      self.dx = dx;
      self.dy = dy;
    },
    setEndShapes(headShape?: VectorEndShape, tailShape? : VectorEndShape) {
      self.headShape = headShape;
      self.tailShape = tailShape;
    },
    setDragBounds(deltas: BoundingBoxSides) {
      if (self.dx > 0) {
        // x,y point is towards the left
        self.dragX = self.x + deltas.left;
        self.dragDx = self.dx + deltas.right - deltas.left;
      } else {
        // x,y point is towards the right
        self.dragX = self.x + deltas.right;
        self.dragDx = self.dx - deltas.right + deltas.left;
      }

      if (self.dy > 0) {
        // x,y point is towards the top
        self.dragY = self.y + deltas.top;
        self.dragDy = self.dy + deltas.bottom - deltas.top;
      } else {
        // x,y point is towards the bottom
        self.dragY = self.y + deltas.bottom;
        self.dragDy = self.dy - deltas.bottom + deltas.top;
      }
    },
    resizeObject() {
      self.repositionObject();
      self.dx = self.dragDx ?? self.dx;
      self.dy = self.dragDy ?? self.dy;
      self.dragDx = self.dragDy = undefined;
    }
  }));
export interface VectorObjectType extends Instance<typeof VectorObject> {}
export interface VectorObjectSnapshot extends SnapshotIn<typeof VectorObject> {}

export function isVectorObject(model: DrawingObjectType): model is VectorObjectType {
  return model.type === "vector";
}
export const VectorComponent = observer(function VectorComponent({model, handleHover,
  handleDrag} : IDrawingComponentProps) {
  if (!isVectorObject(model)) return null;
  const vector = model as VectorObjectType;
  const { id, headShape, tailShape, stroke, strokeWidth, strokeDashArray } = vector;
  const dx = vector.dragDx ?? vector.dx;
  const dy = vector.dragDy ?? vector.dy;
  const line = <line
    x1={0}
    y1={0}
    x2={dx}
    y2={dy}
    />;
    // Angle of this line as SVG likes to measure it (degrees clockwise from vertical)
    const angle = 90-Math.atan2(-dy, dx)*180/Math.PI;
    const head = headShape ? placeEndShape(headShape, dx, dy, angle) : null;
    const tail = tailShape ? placeEndShape(tailShape, 0, 0, angle+180) : null; // tail points backwards
    // Set fill to stroke since arrowheads should be drawn in stroke color
  return (
    <Transformable key={id} position={model.position} transform={model.transform}>
      <g
        className="vector"
        stroke={stroke}
        fill={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={computeStrokeDashArray(strokeDashArray, strokeWidth)}
        onMouseEnter={(e) => handleHover ? handleHover(e, model, true) : null}
        onMouseLeave={(e) => handleHover ? handleHover(e, model, false) : null}
        onPointerDown={(e) => handleDrag?.(e, model)}
        pointerEvents={handleHover ? "visible" : "none"}
      >
        {line}{head}{tail}
      </g>
    </Transformable>
  );
});

// Render a VectorEndShape at the given x, y, and rotational angle.
function placeEndShape(shape: VectorEndShape, x: number, y: number, angle: number) {
  return <g transform={`translate(${x} ${y}) rotate(${angle})`}>{drawEndShape(shape)}</g>;
}

// This defines what the VectorEndShapes actually are.
// Shapes created here should be vertical (as for an line pointed straight up)
// The origin of this shape will be placed on the end of the line.
function drawEndShape(shape: VectorEndShape) {
  if (shape === VectorEndShape.triangle) {
    return <polygon points="0 0 4.5 9 -4.5 9 0 0"/>;
  }
  return null;
}

export class VectorDrawingTool extends DrawingTool {

  constructor(drawingLayer: IDrawingLayer) {
    super(drawingLayer);
  }

  public handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Select the drawing tile, but don't propagate event to do normal Cmd-click procesing.
    this.drawingLayer.selectTile(false);
    e.stopPropagation();

    // Vector tool only responds to one finger at a time.
    if (!e.isPrimary) return;

    const start = this.drawingLayer.getWorkspacePoint(e);
    if (!start) return;
    const {stroke, strokeWidth, strokeDashArray, vectorType} = this.drawingLayer.toolbarSettings();
    const [headShape, tailShape] = endShapesForVectorType(vectorType);
    const vector = VectorObject.create({
      x: start.x,
      y: start.y,
      dx: 0,
      dy: 0,
      headShape, tailShape, stroke, strokeWidth, strokeDashArray});

    const handlePointerMove = (e2: PointerEvent) => {
      e2.preventDefault();

      if (!e2.isPrimary) return;

      const end = this.drawingLayer.getWorkspacePoint(e2);
      if (!end) return;
      let dx = end.x - start.x;
      let dy = end.y - start.y;
      if (e2.ctrlKey || e2.altKey || e2.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) {
          dy = 0;
        } else {
          dx = 0;
        }
      }
      vector.setDeltas(dx, dy);
      this.drawingLayer.setCurrentDrawingObject(vector);
    };
    const handlePointerUp = (e2: PointerEvent) => {
      e2.preventDefault();

      if (!e2.isPrimary) return;

      if ((vector.dx !== 0) || (vector.dy !== 0)) {
        this.drawingLayer.addNewDrawingObject(getSnapshot(vector));
      }
      this.drawingLayer.setCurrentDrawingObject(null);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    this.drawingLayer.setCurrentDrawingObject(vector);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }
}

