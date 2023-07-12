import { observer } from "mobx-react";
import { Instance, SnapshotIn, types, getSnapshot } from "mobx-state-tree";
import React, { useCallback } from "react";
import { computeStrokeDashArray, DrawingObjectType, DrawingTool, IDrawingComponentProps, IDrawingLayer,
  IToolbarButtonProps, StrokedObject, typeField } from "./drawing-object";
import { Point, VectorEndShape } from "../model/drawing-basic-types";
import { buttonClasses } from "../components/drawing-toolbar-buttons";
import SmallCornerTriangle from "../../../assets/icons/small-corner-triangle.svg";
import { Tooltip } from "react-tippy";
import { useTooltipOptions } from "../../../hooks/use-tooltip-options";
import { useTouchHold } from "../../../hooks/use-touch-hold";
import { VectorTypeIcon } from "../components/vector-type-button";
import { VectorType, endShapesForVectorType } from "../components/vector-palette";

// Line or arrow
export const VectorObject = StrokedObject.named("VectorObject")
  .props({
    type: typeField("vector"),
    dx: types.number,
    dy: types.number,
    headShape: types.maybe(types.enumeration<VectorEndShape>("EndShape", Object.values(VectorEndShape))),
    tailShape: types.maybe(types.enumeration<VectorEndShape>("EndShape", Object.values(VectorEndShape)))
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
    },
    setEndShapes(headShape?: VectorEndShape, tailShape? : VectorEndShape) {
      self.headShape = headShape;
      self.tailShape = tailShape;
    }
  }));
export interface VectorObjectType extends Instance<typeof VectorObject> {}
export interface VectorObjectSnapshot extends SnapshotIn<typeof VectorObject> {}

export function isVectorObject(model: DrawingObjectType): model is VectorObjectType {
  return model.type === "vector";
}
export const VectorComponent = observer(function VectorComponent({model, handleHover,
  handleDrag} : IDrawingComponentProps) {
  if (model.type !== "vector") return null;
  const { id, x, y, dx, dy, stroke, strokeWidth, strokeDashArray, headShape, tailShape,  } = model as VectorObjectType;
  const line = <line
    x1={x}
    y1={y}
    x2={x + dx}
    y2={y + dy}
    />;
    // Angle of this line as SVG likes to measure it (degrees clockwise from vertical)
    const angle = 90-Math.atan2(-dy, dx)*180/Math.PI;
    const head = headShape ? placeEndShape(headShape, x+dx, y+dy, angle) : null;
    const tail = tailShape ? placeEndShape(tailShape, x, y, angle+180) : null; // tail points backwards
    // Set fill to stroke since arrowheads should be drawn in stroke color
  return <g key={id}
            stroke={stroke}
            fill={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={computeStrokeDashArray(strokeDashArray, strokeWidth)}
            onMouseEnter={(e) => handleHover ? handleHover(e, model, true) : null}
            onMouseLeave={(e) => handleHover ? handleHover(e, model, false) : null}
            onMouseDown={(e) => handleDrag?.(e, model)}
          >
            {line}{head}{tail}
         </g>;
});

// Render a VectorEndShape at the given x, y, and rotational angle.
function placeEndShape(shape: VectorEndShape, x: number, y: number, angle: number) {
  return <g transform={`translate(${x} ${y}) rotate(${angle})`}>{drawEndShape(shape)}</g>;
}

// This defines what the VectorEndShapes actually are.
// Shapes created here should be vertical (as for an line pointed straight up)
// The origin of this shape will be placed on the end of the line.
function drawEndShape(shape: VectorEndShape) {
  if (shape === VectorEndShape.triangle) {
    return <polygon points="0 0 4.5 9 -4.5 9 0 0"/>;
  }
  return null;
}

export class VectorDrawingTool extends DrawingTool {

  constructor(drawingLayer: IDrawingLayer) {
    super(drawingLayer);
  }

  public handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const start = this.drawingLayer.getWorkspacePoint(e);
    if (!start) return;
    const {stroke, strokeWidth, strokeDashArray, vectorType} = this.settings;
    const [headShape, tailShape] = endShapesForVectorType(vectorType);
    const vector = VectorObject.create({
      x: start.x,
      y: start.y,
      dx: 0,
      dy: 0,
      headShape, tailShape, stroke, strokeWidth, strokeDashArray});

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

export const VectorToolbarButton: React.FC<IToolbarButtonProps> = observer(({
  toolbarManager, togglePaletteState, clearPaletteState
}) => {
  const modalButton = "vector";
  const { selectedButton, toolbarSettings } = toolbarManager;
  const selected = selectedButton === modalButton;
  const _settings = toolbarSettings;

  const tooltipOptions = useTooltipOptions();

  // Adapted from image.tsx
  const handleButtonClick = useCallback(() => {
    toolbarManager.setSelectedButton(modalButton);
    togglePaletteState('showVectors', false);
  }, [toolbarManager, togglePaletteState]);

  const handleButtonTouchHold = useCallback(() => {
    // Do not set the vector button as the selected tool yet.
    // The user might be opening the palette just to change the type of existing, selected vectors.
    togglePaletteState('showVectors');
  }, [toolbarManager, togglePaletteState]);

  const { didTouchHold, ...handlers } = useTouchHold(handleButtonTouchHold, handleButtonClick);

  const handleExpandCollapseClick = (e: React.MouseEvent) => {
    if (!didTouchHold()) {
      handleButtonTouchHold();
      e.stopPropagation();
    }
  };

  const vectorTypeIcon = _settings.vectorType || VectorType.line;

  return (
    <Tooltip title="Line" {...tooltipOptions}>
      <button type="button" className={buttonClasses({ modalButton, selected })} {...handlers}>
        <VectorTypeIcon vectorType={vectorTypeIcon} settings={_settings} />
        <div className="expand-collapse" onClick={handleExpandCollapseClick}>
          <SmallCornerTriangle />
        </div>
      </button>
    </Tooltip>);
});
