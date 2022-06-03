import { Instance, SnapshotIn, types } from "mobx-state-tree";
import React from "react";
import { computeStrokeDashArray } from "../model/drawing-content";
import { DrawingTool, IDrawingComponentProps, IDrawingLayer, StrokedObject, typeField } from "./drawing-object";
import { Point } from "../model/drawing-basic-types";

// simple line
export const VectorObject = StrokedObject.named("VectorObject")
  .props({
    type: typeField("vector"),
    dx: types.number,
    dy: types.number    
  })
  .views(self => ({
    get boundingBox() {
      const {x, y, dx, dy} = self;
      const nw: Point = {x: Math.min(x, x + dx), y: Math.min(y, y + dy)};
      const se: Point = {x: Math.max(x, x + dx), y: Math.max(y, y + dy)};
      return {nw, se};
    }
  }))
  .actions(self => ({
    setDeltas(dx: number, dy: number) {
      self.dx = dx;
      self.dy = dy;
    }
  }));
export interface VectorObjectType extends Instance<typeof VectorObject> {}
export interface VectorObjectSnapshot extends SnapshotIn<typeof VectorObject> {}

export function VectorComponent({model, handleHover} : IDrawingComponentProps) {
  if (model.type !== "vector") return null;
  const { id, x, y, dx, dy, stroke, strokeWidth, strokeDashArray } = model as VectorObjectType;
  return <line
    key={id}
    x1={x}
    y1={y}
    x2={x + dx}
    y2={y + dy}
    stroke={stroke}
    strokeWidth={strokeWidth}
    strokeDasharray={computeStrokeDashArray(strokeDashArray, strokeWidth)}
    onMouseEnter={(e) => handleHover ? handleHover(e, model, true) : null}
    onMouseLeave={(e) => handleHover ? handleHover(e, model, false) : null} />;
}

export class VectorDrawingTool extends DrawingTool {

  constructor(drawingLayer: IDrawingLayer) {
    super(drawingLayer);
  }

  public handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const start = this.drawingLayer.getWorkspacePoint(e);
    if (!start) return;
    const {stroke, strokeWidth, strokeDashArray} = this.settings;
    const vector = VectorObject.create({
      x: start.x,
      y: start.y,
      dx: 0,
      dy: 0,
      stroke, strokeWidth, strokeDashArray});

    const handleMouseMove = (e2: MouseEvent) => {
      e2.preventDefault();
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
    const handleMouseUp = (e2: MouseEvent) => {
      e2.preventDefault();
      if ((vector.dx !== 0) || (vector.dy !== 0)) {
        this.drawingLayer.addNewDrawingObject(vector);
      }
      this.drawingLayer.setCurrentDrawingObject(null);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    this.drawingLayer.setCurrentDrawingObject(vector);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }
}
