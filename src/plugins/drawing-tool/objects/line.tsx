import { observer } from "mobx-react";
import { Instance, SnapshotIn, types, getSnapshot } from "mobx-state-tree";
import React from "react";
import { SelectionBox } from "../components/selection-box";
import { computeStrokeDashArray, DeltaPoint, DrawingTool, IDrawingComponentProps, IDrawingLayer,
  IToolbarButtonProps, StrokedObject, typeField } from "./drawing-object";
import { Point } from "../model/drawing-basic-types";
import { SvgToolModeButton } from "../components/drawing-toolbar-buttons";
import FreehandToolIcon from "../assets/freehand-icon.svg";

function* pointIterator(line: LineObjectType): Generator<Point, string, unknown> {
  const {x, y, deltaPoints} = line;
  let currentX = x;
  let currentY = y;
  for (const {dx, dy} of deltaPoints) {
    const point: Point = {x: currentX, y: currentY};
    yield point;
    currentX += dx;
    currentY += dy;
  }
  // Due to some conflict between TS and ESLint it is necessary to return
  // a value here. As far as I can tell this value is not used.
  return "done";
}

// polyline
export const LineObject = StrokedObject.named("LineObject")
  .props({
    type: typeField("line"),
    deltaPoints: types.array(DeltaPoint)
  })
  .views(self => ({
    inSelection(selectionBox: SelectionBox) {
      for (const point of pointIterator(self as LineObjectType)){
        if (selectionBox.contains(point)) {
          return true;
        }
      }
      return false;
    },

    get boundingBox() {
      const {x, y} = self;
      const nw: Point = {x, y};
      const se: Point = {x, y};
      for (const point of pointIterator(self as LineObjectType)){
        nw.x = Math.min(nw.x, point.x);
        nw.y = Math.min(nw.y, point.y);
        se.x = Math.max(se.x, point.x);
        se.y = Math.max(se.y, point.y);
      }
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

export const LineComponent = observer(function LineComponent({model, handleHover, handleDrag}
  : IDrawingComponentProps) {
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
    onMouseLeave={(e) => handleHover ? handleHover(e, model, false) : null}
    onMouseDown={(e)=> {
      if (handleDrag !== undefined){
        handleDrag(e, model);
      }
    }}
    pointerEvents={"visible"}
    />;
});

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
      if (p && (p.x >= 0) && (p.y >= 0)) {
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
        this.drawingLayer.addNewDrawingObject(getSnapshot(line));
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

export function LineToolbarButton({toolbarManager}: IToolbarButtonProps) {
  return <SvgToolModeButton modalButton="line" settings={{ fill: toolbarManager.stroke }}
    title="Freehand" toolbarManager={toolbarManager} SvgIcon={FreehandToolIcon} />;
}
