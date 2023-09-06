import { observer } from "mobx-react";
import { Instance, SnapshotIn, types, getSnapshot } from "mobx-state-tree";
import React, { useEffect, useRef } from "react";
import { DrawingObjectType, DrawingTool, EditableObject, IDrawingComponentProps, IDrawingLayer,
  IToolbarButtonProps, typeField } from "./drawing-object";
import { BoundingBoxSides, Point, ToolbarSettings } from "../model/drawing-basic-types";
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
    },
    get label() {
      return "Text";
    },
    get icon() {
      return TextToolIcon;
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
    setDragBounds(deltas: BoundingBoxSides) {
      self.dragX = self.x + deltas.left;
      self.dragY = self.y + deltas.top;
      self.dragWidth  = self.width  + deltas.right - deltas.left;
      self.dragHeight = self.height + deltas.bottom - deltas.top;
    },
    resizeObject() {
      self.repositionObject();
      self.width = self.dragWidth ?? self.width;
      self.height = self.dragHeight ?? self.height;
      self.dragWidth = self.dragHeight = undefined;
    },
    setEditing(editing: boolean) {
      self.isEditing = editing;
    }
  }));  

export interface TextObjectType extends Instance<typeof TextObject> {}
export interface TextObjectSnapshot extends SnapshotIn<typeof TextObject> {}

export function isTextObject(model: DrawingObjectType): model is TextObjectType {
  return model.type === "text";
}

export const TextComponent = observer(
    function TextComponent({model, readOnly, handleHover, handleDrag} : IDrawingComponentProps) {
  const textEditor = useRef<HTMLTextAreaElement>(null);
  if (!isTextObject(model)) return null;
  const textobj = model as TextObjectType;
  const { id, stroke, text } = textobj;
  const { x, y } = model.position;
  const { width, height } = textobj.currentDims;
  const clipId = uniqueId();
  const margin = 5;

  interface IContentProps {
    editing: boolean,
    clip: string
  }
  const Content = function({editing, clip}: IContentProps) {

    useEffect(() => {
      // Focus text area when it opens, to avoid need for user to click it again.
      if (editing) {
        setTimeout(() => textEditor.current?.focus());
      }
    }, [editing]);

    if (editing) {
      return (
        <foreignObject x={x+margin} y={y+margin} width={width-2*margin} height={height-2*margin}>
          <textarea ref={textEditor} 
            defaultValue={text}
            onBlur={(e) => handleClose(true)}
            onKeyDown={handleTextAreaKeyDown}
            onMouseDown={handleTextAreaMouseDown}>
          </textarea>
        </foreignObject>);
    } else {
      // Note that SVG text is generally 'filled', not 'stroked'.  
      // But we use the stroke color for text since we think that's more intuitive. Thus the odd-looking 'style' below.
      return(<g clipPath={'url(#'+clip+')'}>
              <WrappedSvgText text={text} 
                  x={x+margin} y={y+margin} width={width-2*margin} height={height-2*margin} 
                  style={{fill: stroke}} />
             </g>);
    }
  };

  const handleTextAreaMouseDown = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
  };

  const handleTextAreaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
      const textarea = textEditor.current;
      if (textarea) {
        model.setText(textarea.value);
      }
    }
    model.setEditing(false);
  };

  return <g 
          key={id} 
          className="text" 
          onMouseEnter={(e) => handleHover?.(e, model, true)}
          onMouseLeave={(e) => handleHover?.(e, model, false)}
          onMouseDown={(e)=> handleDrag?.(e, model)}
          pointerEvents={handleHover ? "visible" : "none"}
         >
          <rect x={x} y={y}
              width={width} height={height}
              stroke={stroke} fill="#FFFFFF" opacity="80%"
              rx="5" ry="5" /> 
          <clipPath id={clipId}>
            <rect x={x} y={y} width={width} height={height} />
          </clipPath>
          <Content clip={clipId} editing={model.isEditing && !readOnly} />
         </g>;

});

export class TextDrawingTool extends DrawingTool {

  constructor(drawingLayer: IDrawingLayer) {
    super(drawingLayer);
  }

  public handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const start = this.drawingLayer.getWorkspacePoint(e);
    if (!start) return;
    const { stroke } = this.drawingLayer.toolbarSettings();
    const text = TextObject.create({
      x: start.x,
      y: start.y,
      width: 100,
      height: 100,
      stroke,
      text: ""
    });
    const obj: TextObjectType = this.drawingLayer.addNewDrawingObject(getSnapshot(text)) as TextObjectType;
    obj.setEditing(true);
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
