import { Instance, SnapshotIn, types } from "mobx-state-tree";
import React from "react";
import { SelectionBox } from "../components/drawing-object";
import { computeStrokeDashArray } from "../model/drawing-content";
import { DeltaPoint, Point, StrokedObject, typeField } from "../model/drawing-objects";
import { DrawingTool, IDrawingComponentProps, IDrawingLayer } from "./drawing-object-types";

// polyline
export const LineObject = StrokedObject.named("LineObject")
  .props({
    type: typeField("line"),
    deltaPoints: types.array(DeltaPoint)
  })
  .views(self => ({
    inSelection(selectionBox: SelectionBox) {
      const {x, y, deltaPoints} = self;
      for (const {dx, dy} of deltaPoints) {
        const point: Point = {x: x + dx, y: y + dy};
        if (selectionBox.contains(point)) {
          return true;
        }
      }
      return false;  
    },

    get boundingBox() {
      const {x, y, deltaPoints} = self;
      const nw: Point = {x, y};
      const se: Point = {x, y};
      let lastPoint: Point = {x, y};
      deltaPoints.forEach((dp) => {
        nw.x = Math.min(nw.x, lastPoint.x + dp.dx);
        nw.y = Math.min(nw.y, lastPoint.y + dp.dy);
        se.x = Math.max(se.x, lastPoint.x + dp.dx);
        se.y = Math.max(se.y, lastPoint.y + dp.dy);
        lastPoint = {x: lastPoint.x + dp.dx, y: lastPoint.y + dp.dy};
      });
      return {nw, se};  
    }
  }))
  .actions(self => ({
    addPoint(point: Instance<typeof DeltaPoint>) {
      self.deltaPoints.push(point);
    }
  }));
export interface LineObjectType extends Instance<typeof LineObject> {}
export interface LineObjectSnapshot extends SnapshotIn<typeof LineObject> {}

export function LineComponent({model, handleHover} : IDrawingComponentProps) {
  if (model.type !== "line") return null;
  const { id, x, y, deltaPoints, stroke, strokeWidth, strokeDashArray } = model as LineObjectType;
  const commands = `M ${x} ${y} ${deltaPoints.map((point) => `l ${point.dx} ${point.dy}`).join(" ")}`;
  return <path
    key={id}
    d={commands}
    stroke={stroke}
    fill="none"
    strokeWidth={strokeWidth}
    strokeDasharray={computeStrokeDashArray(strokeDashArray, strokeWidth)}
    onMouseEnter={(e) => handleHover ? handleHover(e, model, true) : null}
    onMouseLeave={(e) => handleHover ? handleHover(e, model, false) : null} />;
}

export class LineDrawingTool extends DrawingTool {

  constructor(drawingLayer: IDrawingLayer) {
    super(drawingLayer);
    this.drawingLayer = drawingLayer;
  }

  public handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const start = this.drawingLayer.getWorkspacePoint(e);
    if (!start) return;
    const {stroke, strokeWidth, strokeDashArray} = this.settings;
    const line = LineObject.create({x: start.x, y: start.y,
      deltaPoints: [], stroke, strokeWidth, strokeDashArray});

    let lastPoint = start;
    const addPoint = (e2: MouseEvent|React.MouseEvent<HTMLDivElement>) => {
      const p = this.drawingLayer.getWorkspacePoint(e2);
      if (!p) return;
      if ((p.x >= 0) && (p.y >= 0)) {
        line.addPoint({dx: p.x - lastPoint.x, dy: p.y - lastPoint.y});
        lastPoint = p;
        this.drawingLayer.setCurrentDrawingObject(line);
      }
    };

    const handleMouseMove = (e2: MouseEvent) => {
      e2.preventDefault();
      addPoint(e2);
    };
    const handleMouseUp = (e2: MouseEvent) => {
      e2.preventDefault();
      if (line.deltaPoints.length > 0) {
        addPoint(e2);
        this.drawingLayer.addNewDrawingObject(line);
      }
      this.drawingLayer.setCurrentDrawingObject(null);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    this.drawingLayer.setCurrentDrawingObject(line);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }
}
