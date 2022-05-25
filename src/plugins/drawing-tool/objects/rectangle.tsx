import { Instance, types } from "mobx-state-tree";
import React from "react";
import { computeStrokeDashArray } from "../model/drawing-content";
import { Point } from "../model/drawing-objects";
import { FilledObject, StrokedObject, typeField } from "../model/drawing-objects2";
import { DrawingTool, IDrawingComponentProps, IDrawingLayer } from "./drawing-object-types";

export const RectangleObject = types.compose("RectangleObject", StrokedObject, FilledObject)
  .props({
    type: typeField("rectangle"),
    width: types.number,
    height: types.number,
  })
  .views(self => ({
    get boundingBox() {
      const {x, y, width, height} = self;
      const nw: Point = {x, y};
      const se: Point = {x: x + width, y: y + height};
      return {nw, se};
    }
  }))
  .actions(self => ({
    resize(start: Point, end: Point, makeSquare: boolean) {
      self.x = Math.min(start.x, end.x);
      self.y = Math.min(start.y, end.y);
      self.width = Math.max(start.x, end.x) - self.x;
      self.height = Math.max(start.y, end.y) - self.y;
      if (makeSquare) {
        let {x, y} = self;
        const {width, height} = self;
        const squareSize = Math.max(width, height);

        if (x === start.x) {
          if (y !== start.y) {
            y = start.y - squareSize;
          }
        }
        else {
          x = start.x - squareSize;
          if (y !== start.y) {
            y = start.y - squareSize;
          }
        }

        self.x = x;
        self.y = y;
        self.width = self.height = squareSize;
      }
    }
  }));
export interface RectangleObjectType extends Instance<typeof RectangleObject> {}

export function RectangleComponent({model, handleHover} : IDrawingComponentProps) {
  if (model.type !== "rectangle") return null;
  const { id, x, y, width, height, stroke, strokeWidth, strokeDashArray, fill } = model as RectangleObjectType;
  return <rect
    key={id}
    x={x}
    y={y}
    width={width}
    height={height}
    stroke={stroke}
    fill={fill}
    strokeWidth={strokeWidth}
    strokeDasharray={computeStrokeDashArray(strokeDashArray, strokeWidth)}
    onMouseEnter={(e) => handleHover ? handleHover(e, model, true) : null}
    onMouseLeave={(e) => handleHover ? handleHover(e, model, false) : null} />;

}

export class RectangleDrawingTool extends DrawingTool {

  constructor(drawingLayer: IDrawingLayer) {
    super(drawingLayer);
  }

  public handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const start = this.drawingLayer.getWorkspacePoint(e);
    if (!start) return;
    const {stroke, fill, strokeWidth, strokeDashArray} = this.settings;
    const rectangle = RectangleObject.create({
      x: start.x,
      y: start.y,
      width: 0,
      height: 0,
      stroke, fill, strokeWidth, strokeDashArray
    });

    const handleMouseMove = (e2: MouseEvent) => {
      e2.preventDefault();
      const end = this.drawingLayer.getWorkspacePoint(e2);
      if (!end) return;
      const makeSquare = e2.ctrlKey || e2.altKey || e2.shiftKey;
      rectangle.resize(start, end, makeSquare);
      this.drawingLayer.setCurrentDrawingObject(rectangle);
    };
    const handleMouseUp = (e2: MouseEvent) => {
      e2.preventDefault();
      if ((rectangle.width > 0) && (rectangle.height > 0)) {
        this.drawingLayer.addNewDrawingObject(rectangle);
      }
      this.drawingLayer.setCurrentDrawingObject(null);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    this.drawingLayer.setCurrentDrawingObject(rectangle);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }
}
