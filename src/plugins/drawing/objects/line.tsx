import { observer } from "mobx-react";
import { Instance, SnapshotIn, types, getSnapshot } from "mobx-state-tree";
import React from "react";
import { SelectionBox } from "../components/selection-box";
import { computeStrokeDashArray, DeltaPoint, DrawingTool, IDrawingComponentProps, IDrawingLayer,
  IToolbarButtonProps, StrokedObject, typeField } from "./drawing-object";
import { BoundingBoxDelta, Point } from "../model/drawing-basic-types";
import { SvgToolModeButton } from "../components/drawing-toolbar-buttons";
import FreehandToolIcon from "../assets/freehand-icon.svg";

function* pointIterator(line: LineObjectType): Generator<Point, string, unknown> {
  const { x, y } = line.position;
  const points = line.deltaPoints;
  let currentX = x;
  let currentY = y;
  const scaleX = line.dragScaleX ?? 1;
  const scaleY = line.dragScaleY ?? 1;
  yield { x: currentX, y: currentY };
  for (const {dx, dy} of points) {
    currentX += dx * scaleX;
    currentY += dy * scaleY;
    yield {x: currentX, y: currentY};
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
  .volatile(self => ({
    dragScaleX: undefined as number | undefined,
    dragScaleY: undefined as number | undefined
  }))
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
      const {x, y} = self.position;
      const nw: Point = {x, y};
      const se: Point = {x, y};
      for (const point of pointIterator(self as LineObjectType)){
        nw.x = Math.min(nw.x, point.x);
        nw.y = Math.min(nw.y, point.y);
        se.x = Math.max(se.x, point.x);
        se.y = Math.max(se.y, point.y);
      }
      return {nw, se};
    }}))
  .actions(self => ({
    addPoint(point: Instance<typeof DeltaPoint>) {
      self.deltaPoints.push(point);
    },

    setDragBounds(deltas: BoundingBoxDelta) {
      self.dragX = self.dragY = self.dragScaleX = self.dragScaleY = undefined;
      const bbox = self.boundingBox;
      const left = bbox.nw.x;
      const top = bbox.nw.y;
      const width = bbox.se.x - bbox.nw.x;
      const height = bbox.se.y - bbox.nw.y;
      const newWidth  = width -  deltas.left + deltas.right;
      const newHeight = height - deltas.top + deltas.bottom;
      const widthFactor = newWidth/width;
      const heightFactor = newHeight/height;

      // x,y get moved to a scaled position within the new bounds
      const newLeft = left+deltas.left;
      self.dragX = newLeft + (self.x-left)*widthFactor;
      const newTop = top+deltas.top;
      self.dragY = newTop  + (self.y-top)*heightFactor;

      self.dragScaleX = widthFactor;
      self.dragScaleY = heightFactor;
    },
    resizeObject() {
      self.repositionObject();

      // The delta points get permanently scaled by the x & y scale factors
      const scaleX = self.dragScaleX ?? 1;
      const scaleY = self.dragScaleY ?? 1;
      for (const p of self.deltaPoints) {
        p.dx *= scaleX;
        p.dy *= scaleY;
      }
      self.dragScaleX = self.dragScaleY = undefined;
    }
  }));
export interface LineObjectType extends Instance<typeof LineObject> {}
export interface LineObjectSnapshot extends SnapshotIn<typeof LineObject> {}

export const LineComponent = observer(function LineComponent({model, handleHover, handleDrag}
  : IDrawingComponentProps) {
  if (model.type !== "line") return null;
  const line = model as LineObjectType;
  const { id, deltaPoints, stroke, strokeWidth, strokeDashArray } = line;
  const { x, y } = line.position;
  const scaleX = line.dragScaleX ?? 1;
  const scaleY = line.dragScaleY ?? 1;
  const commands = `M ${x} ${y} ${deltaPoints.map((point) => `l ${point.dx*scaleX} ${point.dy*scaleY}`).join(" ")}`;
  return <path
    key={id}
    d={commands}
    stroke={stroke}
    fill="none"
    strokeWidth={strokeWidth}
    strokeDasharray={computeStrokeDashArray(strokeDashArray, strokeWidth)}
    onMouseEnter={(e) => handleHover ? handleHover(e, model, true) : null}
    onMouseLeave={(e) => handleHover ? handleHover(e, model, false) : null}
    onMouseDown={(e)=> handleDrag?.(e, model)}
    pointerEvents={handleHover ? "visible" : "none"}
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
    const {stroke, strokeWidth, strokeDashArray} = this.drawingLayer.toolbarSettings();
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
  return <SvgToolModeButton modalButton="line" 
    title="Freehand" toolbarManager={toolbarManager} SvgIcon={FreehandToolIcon} />;
}
