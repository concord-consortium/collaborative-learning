import { observer } from "mobx-react";
import { Instance, SnapshotIn, types, getSnapshot } from "mobx-state-tree";
import React from "react";
import { computeStrokeDashArray, DrawingTool, IDrawingComponentProps, IDrawingLayer,
  IToolbarButtonProps, StrokedObject, typeField } from "./drawing-object";
import { Point } from "../model/drawing-basic-types";
import { SvgToolModeButton } from "../components/drawing-toolbar-buttons";
import LineToolIcon from "../assets/line-icon.svg";

// simple line
export const VectorObject = StrokedObject.named("VectorObject")
  .props({
    type: typeField("vector"),
    dx: types.number,
    dy: types.number
  })
  .views(self => ({
    get boundingBox() {
      const { dx, dy } = self;
      const { x, y } = self.position;
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

export const VectorComponent = observer(function VectorComponent({model, handleHover,
  handleDrag} : IDrawingComponentProps) {
  if (model.type !== "vector") return null;
  const { id, dx, dy, stroke, strokeWidth, strokeDashArray } = model as VectorObjectType;
  const { x, y } = model.position;
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
    onMouseLeave={(e) => handleHover ? handleHover(e, model, false) : null}
    onMouseDown={(e)=> handleDrag?.(e, model)}
    />;
});

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
        this.drawingLayer.addNewDrawingObject(getSnapshot(vector));
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

export function VectorToolbarButton({toolbarManager}: IToolbarButtonProps) {
  return <SvgToolModeButton modalButton="vector" title="Line"
    toolbarManager={toolbarManager} SvgIcon={LineToolIcon} />;
}
