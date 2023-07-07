import { observer } from "mobx-react";
import { Instance, SnapshotIn, types, getSnapshot } from "mobx-state-tree";
import React, { ReactElement, useCallback } from "react";
import { computeStrokeDashArray, DrawingTool, IDrawingComponentProps, IDrawingLayer,
  IToolbarButtonProps, StrokedObject, typeField } from "./drawing-object";
import { Point } from "../model/drawing-basic-types";
import { SvgToolModeButton, buttonClasses } from "../components/drawing-toolbar-buttons";
import LineToolIcon from "../assets/line-icon.svg";
import SmallCornerTriangle from "../../../assets/icons/small-corner-triangle.svg";
import { Tooltip } from "react-tippy";
import { useTooltipOptions } from "../../../hooks/use-tooltip-options";
import { useTouchHold } from "../../../hooks/use-touch-hold";

// simple line
export const VectorObject = StrokedObject.named("VectorObject")
  .props({
    type: typeField("vector"),
    dx: types.number,
    dy: types.number
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
    }
  }));
export interface VectorObjectType extends Instance<typeof VectorObject> {}
export interface VectorObjectSnapshot extends SnapshotIn<typeof VectorObject> {}

export const VectorComponent = observer(function VectorComponent({model, handleHover,
  handleDrag} : IDrawingComponentProps) {
  if (model.type !== "vector") return null;
  const { id, x, y, dx, dy, stroke, strokeWidth, strokeDashArray } = model as VectorObjectType;
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

export const VectorToolbarButton: React.FC<IToolbarButtonProps> = observer(({
  toolbarManager, togglePaletteState, clearPaletteState
}) => {
  // Mostly copied from SvgToolModeButton
  const modalButton = "vector";
  const handleClick = () => toolbarManager.setSelectedButton(modalButton);
  const { selectedButton, toolbarSettings } = toolbarManager;
  const selected = selectedButton === modalButton;
  const _settings = toolbarSettings;

  // Mostly copied from SvgToolbarButton 
  const { fill, stroke, strokeWidth, strokeDashArray } = _settings;
  const tooltipOptions = useTooltipOptions();

  // Adapted from image.tsx
  const handleButtonClick = useCallback(() => {
    toolbarManager.setSelectedButton(modalButton);
    //togglePaletteState("showVectorOptions", false);
  }, [toolbarManager, togglePaletteState]);

  const handleButtonTouchHold = useCallback(() => {
    toolbarManager.setSelectedButton(modalButton);
    //togglePaletteState("showVectorOptions");
    console.log('FIXME this would toggle vector options');
  }, [toolbarManager, togglePaletteState]);

  const { didTouchHold, ...handlers } = useTouchHold(handleButtonTouchHold, handleButtonClick);

  const handleExpandCollapseClick = (e: React.MouseEvent) => {
    if (!didTouchHold()) {
      handleButtonTouchHold();
      e.stopPropagation();
    }
  };

  return (
    <Tooltip title="Line" {...tooltipOptions}>
      <button type="button" className={buttonClasses({ modalButton, selected })} {...handlers}>
        <LineToolIcon fill={fill} stroke={stroke} strokeWidth={strokeWidth}
          strokeDasharray={computeStrokeDashArray(strokeDashArray, strokeWidth)} />
        <div className="expand-collapse" onClick={handleExpandCollapseClick}>
          <SmallCornerTriangle />
        </div>
      </button>
    </Tooltip>);
});
