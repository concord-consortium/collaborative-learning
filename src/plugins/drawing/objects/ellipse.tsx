import { observer } from "mobx-react";
import { Instance, SnapshotIn, types, getSnapshot } from "mobx-state-tree";
import React from "react";
import { computeStrokeDashArray, DrawingObjectType, DrawingTool, FilledObject, IDrawingComponentProps, IDrawingLayer,
  ObjectTypeIconViewBox, StrokedObject, typeField } from "./drawing-object";
import { BoundingBoxSides, Point } from "../model/drawing-basic-types";
import EllipseToolIcon from "../assets/ellipse-icon.svg";
import { Transformable } from "../components/transformable";

export const EllipseObject = types.compose("EllipseObject", StrokedObject, FilledObject)
  .props({
    type: typeField("ellipse"),
    // X and Y radius of the ellipse.
    rx: types.number,
    ry: types.number,
  })
  .volatile(self => ({
    dragRx: undefined as number | undefined,
    dragRy: undefined as number | undefined
  }))
  .views(self => ({
    get boundingBox() {
      // The position of the ellipse is its center.
      const {x, y} = self.position;
      const rx = self.dragRx ?? self.rx;
      const ry = self.dragRy ?? self.ry;
      const nw: Point = {x: x - rx, y: y - ry};
      const se: Point = {x: x + rx, y: y + ry};
      return {nw, se};
    },
    get label() {
      return (self.rx === self.ry) ? "Circle" : "Ellipse";
    },
    get icon() {
      return (<EllipseToolIcon viewBox={ObjectTypeIconViewBox}
        fill={self.fill}
        stroke={self.stroke} strokeWidth={self.strokeWidth} strokeDasharray={self.strokeDashArray}/>);
    }
  }))
  .actions(self => ({
    resize(start: Point, end: Point, makeCircle: boolean) {
      self.rx = Math.abs(start.x - end.x);
      self.ry = Math.abs(start.y - end.y);
      if (makeCircle) {
        self.rx = self.ry = Math.max(self.rx, self.ry);
      }
    },
    setDragBounds(deltas: BoundingBoxSides) {
      self.dragX = self.x + deltas.left/2 + deltas.right/2;
      self.dragY = self.y + deltas.top/2 + deltas.bottom/2;
      self.dragRx  = self.rx  + deltas.right/2 - deltas.left/2;
      self.dragRy = self.ry + deltas.bottom/2 - deltas.top/2;
    },
    setDragBoundsAbsolute(bounds: BoundingBoxSides) {
      self.dragRx = (bounds.right - bounds.left) / 2;
      self.dragRy = (bounds.bottom - bounds.top) / 2;
      self.dragX = bounds.left + self.dragRx;
      self.dragY = bounds.top + self.dragRy;
    },
    resizeObject() {
      self.repositionObject();
      self.rx = self.dragRx ?? self.rx;
      self.ry = self.dragRy ?? self.ry;
      self.dragRx = self.dragRy = undefined;
    }
  }));
export interface EllipseObjectType extends Instance<typeof EllipseObject> {}
export interface EllipseObjectSnapshot extends SnapshotIn<typeof EllipseObject> {}

export function isEllipseObject(model: DrawingObjectType): model is EllipseObjectType {
  return model.type === "ellipse";
}

export const EllipseComponent = observer(function EllipseComponent({model, handleHover,
  handleDrag} : IDrawingComponentProps) {
  if (!isEllipseObject(model)) return null;
  const { id, stroke, strokeWidth, strokeDashArray, fill } = model;
  const rx = model.dragRx ?? model.rx;
  const ry = model.dragRy ?? model.ry;
  return (
    <Transformable type="ellipse" key={id} position={model.position} transform={model.transform}>
      <ellipse
        className="drawing-object"
        cx={0}
        cy={0}
        rx={rx}
        ry={ry}
        stroke={stroke}
        fill={fill}
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

export class EllipseDrawingTool extends DrawingTool {

  constructor(drawingLayer: IDrawingLayer) {
    super(drawingLayer);
  }

  public handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Select the drawing tile, but don't propagate event to do normal Cmd-click procesing.
    this.drawingLayer.selectTile(false);
    e.stopPropagation();

    // Ellipse tool only responds to one finger at a time.
    if (!e.isPrimary) return;

    const start = this.drawingLayer.getWorkspacePoint(e);
    if (!start) return;
    const {stroke, fill, strokeWidth, strokeDashArray} = this.drawingLayer.toolbarSettings();
    const ellipse = EllipseObject.create({
      x: start.x,
      y: start.y,
      rx: 0,
      ry: 0,
      stroke, fill, strokeWidth, strokeDashArray
    });

    const handlePointerMove = (e2: PointerEvent) => {
      e2.preventDefault();
      if (!e2.isPrimary) return;

      const end = this.drawingLayer.getWorkspacePoint(e2);
      if (!end) return;
      const makeCircle = e2.ctrlKey || e2.altKey || e2.shiftKey;
      ellipse.resize(start, end, makeCircle);
      this.drawingLayer.setCurrentDrawingObject(ellipse);
    };
    const handlePointerUp = (e2: PointerEvent) => {
      e2.preventDefault();
      if ((ellipse.rx > 0) && (ellipse.ry > 0)) {
        this.drawingLayer.addNewDrawingObject(getSnapshot(ellipse));
      }
      this.drawingLayer.setCurrentDrawingObject(null);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    this.drawingLayer.setCurrentDrawingObject(ellipse);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }
}
