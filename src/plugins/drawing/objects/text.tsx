import { observer } from "mobx-react";
import { Instance, SnapshotIn, types, getSnapshot } from "mobx-state-tree";
import React, {  } from "react";
import { DrawingObjectType, DrawingTool, EditableObject, IDrawingComponentProps, IDrawingLayer,
  IToolbarButtonProps, typeField } from "./drawing-object";
import { BoundingBoxDelta, Point, ToolbarSettings } from "../model/drawing-basic-types";
import TextToolIcon from "../../../assets/icons/comment/comment.svg";
import { SvgToolModeButton } from "../components/drawing-toolbar-buttons";
import { uniqueId } from "../../../../src/utilities/js-utils";
import { WrappedSvgText } from "../components/wrapped-svg-text";

export const TextObject = EditableObject.named("TextObject")
  .props({
    type: typeField("text"),
    width: types.number,
    height: types.number,
    stroke: types.string,
    text: types.string
  })
  .volatile(self => ({
    dragWidth: undefined as number | undefined,
    dragHeight: undefined as number | undefined
  }))
  .views(self => ({
    get currentDims() {
      const { width, height, dragWidth, dragHeight } = self;
      return {
        width: dragWidth ?? width,
        height: dragHeight ?? height
      };
    }
  }))
  .views(self => ({
    get boundingBox() {
      const { x, y } = self.position;
      const { width, height } = self.currentDims;
      const nw: Point = {x, y};
      const se: Point = {x: x + width, y: y + height};
      return {nw, se};
    }
  }))
  .actions(self => ({
    setStroke(stroke: string){ 
      self.stroke = stroke; 
    },
    setText(text: string) {
      self.text = text;
    },
    resize(start: Point, end: Point) {
      self.x = Math.min(start.x, end.x);
      self.y = Math.min(start.y, end.y);
      self.width = Math.max(start.x, end.x) - self.x;
      self.height = Math.max(start.y, end.y) - self.y;
    },
    setDragBounds(deltas: BoundingBoxDelta) {
      self.dragX = self.x + deltas.left;
      self.dragY = self.y + deltas.top;
      self.dragWidth  = self.width  + deltas.right - deltas.left;
      self.dragHeight = self.height + deltas.bottom - deltas.top;
    },
    adoptDragBounds() {
      self.adoptDragPosition();
      self.width = self.dragWidth ?? self.width;
      self.height = self.dragHeight ?? self.height;
      self.dragWidth = self.dragHeight = undefined;
    },
    setEditing(editing: boolean) {
      console.log('Editing state is now', editing);
      self.isEditing = editing;
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
  const textobj = model as TextObjectType;
  const { id, stroke, text } = textobj;
  const { x, y } = model.position;
  const { width, height } = textobj.currentDims;
  const textareaId = uniqueId();
  const margin = 5;

  interface IContentProps {
    editing: boolean,
    clip: string
  }
  const Content = function({editing, clip}: IContentProps) {
    if (editing) {
      return (
        <foreignObject x={x+margin} y={y+margin} width={width-2*margin} height={height-2*margin}>
          <textarea id={textareaId}
            style={{width: "100%", height: "100%", resize: "none"}} 
            defaultValue={text}
            onKeyDown={handleKeyDown}
            onMouseDown={handleMouseDown}>
          </textarea>
        </foreignObject>);
    } else {
      return(<g clipPath={'url(#'+clip+')'}>
              <WrappedSvgText text={text} 
                  x={x+margin} y={y+margin} width={width-2*margin} height={height-2*margin} 
                  style={{color: stroke}} />
            </g>);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    const { key } = e;
    switch (key) {
      case "Escape":
        handleClose(false);
        break;
      case "Enter":
      case "Tab":
        handleClose(true);
        break;
    }
  };

  const handleClose = (accept: boolean) => {
    if (accept) {
      const textarea = document.getElementById(textareaId);
      if (textarea instanceof HTMLTextAreaElement) {
        console.log('Content now: ', textarea.value);
        model.setText(textarea.value);
      } else {
        console.log('Lost track of my textarea: ', textarea);
      }
    }
    model.setEditing(false);
  };

  return <g 
          key={id} 
          className="text" 
          pointerEvents={"visible"} //allows user to select inside of an unfilled object
          onMouseEnter={(e) => handleHover ? handleHover(e, model, true) : null}
          onMouseLeave={(e) => handleHover ? handleHover(e, model, false) : null}
          onMouseDown={(e)=> handleDrag?.(e, model)}
         >
          <rect x={x} y={y}
              width={width} height={height}
              stroke={stroke} fill="#FFFFFF" opacity="80%"
              rx="5" ry="5" /> 
          <clipPath id={id+'clip'}>
            <rect x={x} y={y} width={width} height={height} />
          </clipPath>
          <Content clip={id+'clip'} editing={model.isEditing} />
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
      text: ""
    });
    const obj = this.drawingLayer.addNewDrawingObject(getSnapshot(text));
    if (obj && isTextObject(obj)) {
      console.log('text obj: ', obj);
      obj.setEditing(true);  
    } else {
      console.error('Object returned from add is not of the expected type');
    }
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
