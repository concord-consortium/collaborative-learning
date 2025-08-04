import { observer } from "mobx-react";
import { Instance, SnapshotIn, types, getSnapshot } from "mobx-state-tree";
import React from "react";
import { SelectionBox } from "../components/selection-box";
import { computeStrokeDashArray, DeltaPoint, DrawingTool, FilledObject, IDrawingComponentProps,
   IDrawingLayer, StrokedObject, typeField } from "./drawing-object";
import { BoundingBoxSides, Point } from "../model/drawing-basic-types";
import { Transformable } from "../components/transformable";


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

function* undraggedPointIterator(line: LineObjectType): Generator<Point, string, unknown> {
  const { x, y } = line;
  const points = line.deltaPoints;
  let currentX = x;
  let currentY = y;
  yield { x: currentX, y: currentY };
  for (const {dx, dy} of points) {
    currentX += dx;
    currentY += dy;
    yield {x: currentX, y: currentY};
  }
  // Due to some conflict between TS and ESLint it is necessary to return
  // a value here. As far as I can tell this value is not used.
  return "done";
}

// polyline
export const LineObject = types.compose("LineObject", StrokedObject, FilledObject)
  .props({
    type: typeField("line"),
    deltaPoints: types.array(DeltaPoint)
  })
  .volatile(self => ({
    dragScaleX: undefined as number | undefined,
    dragScaleY: undefined as number | undefined
  }))
  .preProcessSnapshot(snap => {
    if (typeof snap.fill !== 'string') {
      const snapClone = { ...snap };
      snapClone.fill = "none";
      return snapClone;
    }
    return snap;
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

    get undraggedUnrotatedBoundingBox() {
      const {x, y} = self;
      const nw: Point = {x, y};
      const se: Point = {x, y};
      for (const point of undraggedPointIterator(self as LineObjectType)) {
        nw.x = Math.min(nw.x, point.x);
        nw.y = Math.min(nw.y, point.y);
        se.x = Math.max(se.x, point.x);
        se.y = Math.max(se.y, point.y);
      }
      return {nw, se};
    },

    get unrotatedBoundingBox() {
      // The position of the line is its start point.
      // Other points are stored as deltas from the start point.
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
    },

    get label() {
      return "Freehand";
    }

  }))
  .actions(self => ({
    addPoint(point: Instance<typeof DeltaPoint>) {
      self.deltaPoints.push(point);
    },

    setUnrotatedDragBounds(bounds: BoundingBoxSides) {
      self.dragX = self.dragY = self.dragScaleX = self.dragScaleY = undefined;
      const bbox = self.unrotatedBoundingBox;
      const left = bbox.nw.x;
      const top = bbox.nw.y;
      const width = bbox.se.x - bbox.nw.x;
      const height = bbox.se.y - bbox.nw.y;
      const newWidth  = bounds.right - bounds.left;
      const newHeight = bounds.bottom - bounds.top;
      const widthFactor = width ? newWidth/width : 1;
      const heightFactor = height ? newHeight/height : 1;

      // x,y (position of start point) get moved to a scaled position within the new bounds
      self.dragX = bounds.left + (self.x-left)*widthFactor;
      self.dragY = bounds.top  + (self.y-top)*heightFactor;

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
  }))
  .preProcessSnapshot(sn => {
    const snClone = { ...sn };
    if (typeof snClone.x !== 'number') {
      snClone.x = 0;
    }
    if (typeof snClone.y !== 'number') {
      snClone.y = 0;
    }
    snClone.deltaPoints = snClone.deltaPoints?.filter((point) => {
      return (typeof point.dx === 'number' && typeof point.dy === 'number');
    });
    return snClone;
  });
export interface LineObjectType extends Instance<typeof LineObject> {}
export interface LineObjectSnapshot extends SnapshotIn<typeof LineObject> {}

export const LineComponent = observer(function LineComponent({model, handleHover, handleDrag}
  : IDrawingComponentProps) {
  if (model.type !== "line") return null;
  const line = model as LineObjectType;
  const { id, deltaPoints, stroke, fill, strokeWidth, strokeDashArray } = line;
  const scaleX = line.dragScaleX ?? 1;
  const scaleY = line.dragScaleY ?? 1;
  const commands = `M 0 0 ${deltaPoints.map((point) => `l ${point.dx*scaleX} ${point.dy*scaleY}`).join(" ")}`;

  return (
    <Transformable type="line" key={id} transform={line.transform} setAnimating={line.setAnimating}>
      <path
        data-object-id={id}
        className="drawing-object"
        d={commands}
        stroke={stroke}
        fill={fill}
        fillRule="nonzero"
        strokeWidth={strokeWidth}
        strokeDasharray={computeStrokeDashArray(strokeDashArray, strokeWidth)}
        onMouseEnter={(e) => handleHover ? handleHover(e, model, true) : null}
        onMouseLeave={(e) => handleHover ? handleHover(e, model, false) : null}
        onPointerDown={(e)=> handleDrag?.(e, model)}
        pointerEvents={handleHover ? "visible" : "none"}
      />
    </Transformable>
  );
});

export class LineDrawingTool extends DrawingTool {

  constructor(drawingLayer: IDrawingLayer) {
    super(drawingLayer);
    this.drawingLayer = drawingLayer;
  }

  public handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Select the drawing tile, but don't propagate event to do normal Cmd-click procesing.
    this.drawingLayer.selectTile(false);
    e.stopPropagation();

    // Line tool only responds to one finger at a time.
    if (!e.isPrimary) return;

    const start = this.drawingLayer.getWorkspacePoint(e);
    if (!start) return;
    const {stroke, strokeWidth, strokeDashArray, fill} = this.drawingLayer.toolbarSettings();
    const line = LineObject.create({x: start.x, y: start.y,
      deltaPoints: [], stroke, strokeWidth, strokeDashArray, fill});

    let lastPoint = start;
    const addPoint = (e2: PointerEvent|React.PointerEvent<HTMLDivElement>) => {
      const p = this.drawingLayer.getWorkspacePoint(e2);
      if (p && (p.x >= 0) && (p.y >= 0)) {
        line.addPoint({dx: p.x - lastPoint.x, dy: p.y - lastPoint.y});
        lastPoint = p;
        this.drawingLayer.setCurrentDrawingObject(line);
      }
    };

    const handlePointerMove = (e2: PointerEvent) => {
      e2.preventDefault();
      if (!e2.isPrimary) return;
      addPoint(e2);
    };
    const handlePointerUp = (e2: PointerEvent) => {
      e2.preventDefault();
      if (!e2.isPrimary) return;

      if (line.deltaPoints.length > 0) {
        addPoint(e2);
        this.drawingLayer.addNewDrawingObject(getSnapshot(line), { keepToolActive: true });
      }
      this.drawingLayer.setCurrentDrawingObject(null);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    this.drawingLayer.setCurrentDrawingObject(line);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }
}
