import { observer } from "mobx-react";
import { Instance, SnapshotIn, types, getSnapshot } from "mobx-state-tree";
import React from "react";
import { DrawingObject, DrawingObjectType, DrawingTool, IDrawingComponentProps, IDrawingLayer,
  IToolbarButtonProps, typeField } from "./drawing-object";
import { Point, ToolbarSettings } from "../model/drawing-basic-types";
import TextToolIcon from "../../../assets/icons/comment/comment.svg";
import { SvgToolModeButton } from "../components/drawing-toolbar-buttons";

export const TextObject = DrawingObject.named("TextObject")
  .props({
    type: typeField("text"),
    width: types.number,
    height: types.number,
    stroke: types.string,
    text: types.string
  })
  .views(self => ({
    get boundingBox() {
      const {width, height} = self;
      const { x, y } = self.position;
      const nw: Point = {x, y};
      const se: Point = {x: x + width, y: y + height};
      return {nw, se};
    }
  }))
  .actions(self => ({
    setStroke(stroke: string){ 
      self.stroke = stroke; 
    },
    resize(start: Point, end: Point) {
      self.x = Math.min(start.x, end.x);
      self.y = Math.min(start.y, end.y);
      self.width = Math.max(start.x, end.x) - self.x;
      self.height = Math.max(start.y, end.y) - self.y;
    }
  }));

export interface TextObjectType extends Instance<typeof TextObject> {}
export interface TextObjectSnapshot extends SnapshotIn<typeof TextObject> {}

export function isTextObject(model: DrawingObjectType): model is TextObjectType {
  return model.type === "text";
}

export const TextComponent = observer(
    function TextComponent({model, handleHover, handleDrag} : IDrawingComponentProps) {
  if (!isTextObject(model)) return null;
  const { id, width, height, stroke, text } = model as TextObjectType;
  const { x, y } = model.position;
  return <g 
          key={id} 
          className="text" 
          pointerEvents={"visible"} //allows user to select inside of an unfilled object
          onMouseEnter={(e) => handleHover ? handleHover(e, model, true) : null}
          onMouseLeave={(e) => handleHover ? handleHover(e, model, false) : null}
          onMouseDown={(e)=> handleDrag?.(e, model)}
         >
          <rect
            key={id}
            x={x} y={y}
            width={width} height={height}
            stroke={stroke} fill="#FFFFFF" opacity="80%"
            rx="5" ry="5"
            />;
          <foreignObject
            x={x+5} y={y+5}
            width={width-10}
            height={height-10}>
              <p style={{color: stroke}}>
                {text}
              </p>
          </foreignObject>
         </g>;

});

export class TextDrawingTool extends DrawingTool {

  constructor(drawingLayer: IDrawingLayer) {
    super(drawingLayer);
  }

  public handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const start = this.drawingLayer.getWorkspacePoint(e);
    if (!start) return;
    const {stroke } = this.settings;
    const text = TextObject.create({
      x: start.x,
      y: start.y,
      width: 100,
      height: 100,
      stroke,
      text: "The five boxing wizards jump quickly."
    });
    this.drawingLayer.addNewDrawingObject(getSnapshot(text));
  }
}

export function TextToolbarButton({toolbarManager}: IToolbarButtonProps) {
  const buttonSettings: ToolbarSettings = {
    stroke: toolbarManager.toolbarSettings.stroke,
    fill: toolbarManager.toolbarSettings.stroke,
    strokeWidth: 0,
    strokeDashArray: ""
  };
  return <SvgToolModeButton modalButton="text" title="Text"
    toolbarManager={toolbarManager} SvgIcon={TextToolIcon}  settings={buttonSettings}/>;
}
