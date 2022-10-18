import { observer } from "mobx-react";
import { Instance, SnapshotIn, types, getSnapshot } from "mobx-state-tree";
import React from "react";
import { computeStrokeDashArray, DrawingObjectType, DrawingTool, FilledObject, IDrawingComponentProps, IDrawingLayer,
  IToolbarButtonProps, StrokedObject, typeField } from "./drawing-object";
import { Point } from "../model/drawing-basic-types";
import { SvgToolModeButton } from "../components/drawing-toolbar-buttons";
import EllipseToolIcon from "../assets/ellipse-icon.svg";

export const EllipseObject = types.compose("EllipseObject", StrokedObject, FilledObject)
  .props({
    type: typeField("ellipse"),
    rx: types.number,
    ry: types.number,
  })
  .views(self => ({
    get boundingBox() {
      const {x, y, rx, ry} = self;
      const nw: Point = {x: x - rx, y: y - ry};
      const se: Point = {x: x + rx, y: y + ry};
      return {nw, se};
    }
  }))
  .actions(self => ({
    resize(start: Point, end: Point, makeCircle: boolean) {
      self.rx = Math.abs(start.x - end.x);
      self.ry = Math.abs(start.y - end.y);
      if (makeCircle) {
        self.rx = self.ry = Math.max(self.rx, self.ry);
      }
    }
  }));
export interface EllipseObjectType extends Instance<typeof EllipseObject> {}
export interface EllipseObjectSnapshot extends SnapshotIn<typeof EllipseObject> {}

function isEllipseObject(model: DrawingObjectType): model is EllipseObjectType {
  return model.type === "ellipse";
}

export const EllipseComponent = observer(function EllipseComponent({model, handleHover,
  handleDrag} : IDrawingComponentProps) {
  if (!isEllipseObject(model)) return null;
  const { id, x, y, rx, ry, stroke, strokeWidth, strokeDashArray, fill } = model;
  return <ellipse
    key={id}
    cx={x}
    cy={y}
    rx={rx}
    ry={ry}
    stroke={stroke}
    fill={fill}
    strokeWidth={strokeWidth}
    strokeDasharray={computeStrokeDashArray(strokeDashArray, strokeWidth)}
    onMouseEnter={(e) => handleHover ? handleHover(e, model, true) : null}
    onMouseLeave={(e) => handleHover ? handleHover(e, model, false) : null}
    onMouseDown={(e)=> handleDrag?.(e, model)}
    pointerEvents={"visible"}
    />;
});

export class EllipseDrawingTool extends DrawingTool {

  constructor(drawingLayer: IDrawingLayer) {
    super(drawingLayer);
  }

  public handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const start = this.drawingLayer.getWorkspacePoint(e);
    if (!start) return;
    const {stroke, fill, strokeWidth, strokeDashArray} = this.settings;
    const ellipse = EllipseObject.create({
      x: start.x,
      y: start.y,
      rx: 0,
      ry: 0,
      stroke, fill, strokeWidth, strokeDashArray
    });

    const handleMouseMove = (e2: MouseEvent) => {
      e2.preventDefault();
      const end = this.drawingLayer.getWorkspacePoint(e2);
      if (!end) return;
      const makeCircle = e2.ctrlKey || e2.altKey || e2.shiftKey;
      ellipse.resize(start, end, makeCircle);
      this.drawingLayer.setCurrentDrawingObject(ellipse);
    };
    const handleMouseUp = (e2: MouseEvent) => {
      e2.preventDefault();
      if ((ellipse.rx > 0) && (ellipse.ry > 0)) {
        this.drawingLayer.addNewDrawingObject(getSnapshot(ellipse));
      }
      this.drawingLayer.setCurrentDrawingObject(null);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    this.drawingLayer.setCurrentDrawingObject(ellipse);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }
}

export function EllipseToolbarButton({toolbarManager}: IToolbarButtonProps) {
  return <SvgToolModeButton modalButton="ellipse" title="Ellipse"
      toolbarManager={toolbarManager} SvgIcon={EllipseToolIcon} />;
}
