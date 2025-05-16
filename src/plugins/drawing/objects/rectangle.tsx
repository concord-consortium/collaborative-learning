import { observer } from "mobx-react";
import { Instance, SnapshotIn, types, getSnapshot } from "mobx-state-tree";
import React from "react";
import { computeStrokeDashArray, DrawingTool, FilledObject, IDrawingComponentProps,
  IDrawingLayer, ObjectTypeIconViewBox, SizedObject, StrokedObject, typeField } from "./drawing-object";
import { Point } from "../model/drawing-basic-types";
import RectToolIcon from "../assets/rectangle-icon.svg";
import { Transformable } from "../components/transformable";

// Note: SizedObject must be listed last because it overrides the default implementation
// of the boundingBox property.
export const RectangleObject = types.compose("RectangleObject", StrokedObject, FilledObject, SizedObject)
  .props({
    type: typeField("rectangle")
  })
  .views(self => ({
    get label() {
      return self.width===self.height ? "Square" : "Rectangle";
    },
    get icon() {
      return (<RectToolIcon viewBox={ObjectTypeIconViewBox}
        fill={self.fill}
        stroke={self.stroke} strokeWidth={self.strokeWidth} strokeDasharray={self.strokeDashArray} />);
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
export interface RectangleObjectSnapshot extends SnapshotIn<typeof RectangleObject> {}
export interface RectangleObjectSnapshotForAdd extends SnapshotIn<typeof RectangleObject> {type: string}

export const RectangleComponent = observer(function RectangleComponent({model, handleHover,
  handleDrag} : IDrawingComponentProps) {
  if (model.type !== "rectangle") return null;
  const rect = model as RectangleObjectType;
  const { id, stroke, strokeWidth, strokeDashArray, fill } = rect;
  const { x, y } = rect.position;
  const { width, height } = rect.currentDims;
  return (
    <Transformable key={id} position={rect.position} transform={rect.transform}>
      <rect
        className="drawing-object rectangle"
        x={0}
        y={0}
        width={width}
        height={height}
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

export class RectangleDrawingTool extends DrawingTool {

  constructor(drawingLayer: IDrawingLayer) {
    super(drawingLayer);
  }

  public handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Select the drawing tile, but don't propagate event to do normal Cmd-click procesing.
    this.drawingLayer.selectTile(false);
    e.stopPropagation();

    // Rectangle tool only responds to one finger at a time.
    if (!e.isPrimary) return;

    const start = this.drawingLayer.getWorkspacePoint(e);
    if (!start) return;
    const {stroke, fill, strokeWidth, strokeDashArray} = this.drawingLayer.toolbarSettings();
    const rectangle = RectangleObject.create({
      x: start.x,
      y: start.y,
      width: 0,
      height: 0,
      stroke, fill, strokeWidth, strokeDashArray
    });

    const handlePointerMove = (e2: PointerEvent) => {
      e2.preventDefault();

      if (!e2.isPrimary) return;

      const end = this.drawingLayer.getWorkspacePoint(e2);
      if (!end) return;
      const makeSquare = e2.ctrlKey || e2.altKey || e2.shiftKey;
      rectangle.resize(start, end, makeSquare);
      this.drawingLayer.setCurrentDrawingObject(rectangle);
    };
    const handlePointerUp = (e2: PointerEvent) => {
      e2.preventDefault();
      if (!e2.isPrimary) return;

      if ((rectangle.width > 0) && (rectangle.height > 0)) {
        this.drawingLayer.addNewDrawingObject(getSnapshot(rectangle));
      }
      this.drawingLayer.setCurrentDrawingObject(null);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    this.drawingLayer.setCurrentDrawingObject(rectangle);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }
}

