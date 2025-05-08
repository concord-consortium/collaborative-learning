import { observer } from "mobx-react";
import { Instance, SnapshotIn, types, getSnapshot } from "mobx-state-tree";
import React from "react";
import { DrawingObjectType, DrawingTool, EditableObject, IDrawingComponentProps,
  IDrawingLayer, ObjectTypeIconViewBox, typeField } from "./drawing-object";
import { BoundingBoxSides, Point } from "../model/drawing-basic-types";
import TextToolIcon from "../../../assets/icons/comment/comment.svg";
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
      return (<TextToolIcon viewBox={ObjectTypeIconViewBox} fill={self.stroke} />);
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

// Content component for editing and displaying text objects
interface IContentProps {
  editing: boolean;
  clip: string;
  text: string;
  model: TextObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  margin: number;
  handleTextAreaPointerDown: (e: React.PointerEvent<HTMLTextAreaElement>) => void;
  textColor: string;
}

const TextContent: React.FC<IContentProps> = ({
  editing, clip, text, model,
  x, y, width, height, margin,
  handleTextAreaPointerDown, textColor
}) => {
  // Local ref for textarea
  const textEditor = React.useRef<HTMLTextAreaElement>(null);

  // Local state for controlled textarea
  const [originalText, setOriginalText] = React.useState(text);
  const [currentText, setCurrentText] = React.useState(text);

  // When editing starts, initialize both original and current text
  React.useEffect(() => {
    if (editing) {
      setOriginalText(text);
      setCurrentText(text);
    }
  }, [editing, text]);

  // Focus text area when it opens, to avoid need for user to click it again.
  React.useEffect(() => {
    if (editing) {
      setTimeout(() => textEditor.current?.focus());
    }
  }, [editing]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentText(e.target.value);
  };

  const handleAccept = () => {
    model.setText(currentText);
    model.setEditing(false);
  };

  const handleCancel = () => {
    setCurrentText(originalText); // Not strictly necessary, but keeps state in sync
    model.setEditing(false);
  };

  const handleTextAreaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    const { key } = e;
    switch (key) {
      case "Escape":
        handleCancel();
        break;
      case "Enter":
      case "Tab":
        handleAccept();
        break;
    }
  };

  const handleBlur = () => {
    handleAccept();
  };

  if (editing) {
    return (
      <foreignObject x={x+margin} y={y+margin} width={width-2*margin} height={height-2*margin}>
        <textarea ref={textEditor}
          value={currentText}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleTextAreaKeyDown}
          onPointerDown={handleTextAreaPointerDown}>
        </textarea>
      </foreignObject>
    );
  } else {
    return(
      <g clipPath={'url(#'+clip+')'}>
        <WrappedSvgText text={text}
            x={x+margin} y={y+margin} width={width-2*margin} height={height-2*margin}
            style={{fill: textColor}} />
      </g>
    );
  }
};

export const TextComponent = observer(
    function TextComponent({model, readOnly, handleHover, handleDrag} : IDrawingComponentProps) {
  if (!isTextObject(model)) return null;
  const textobj = model as TextObjectType;
  const { id, stroke, text } = textobj;
  const { x, y } = model.position;
  const { width, height } = textobj.currentDims;
  const clipId = uniqueId();
  const margin = 5;

  const handleTextAreaPointerDown = (e: React.PointerEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
  };

  return <g
          key={id}
          className="text"
          onMouseEnter={(e) => handleHover?.(e, model, true)}
          onMouseLeave={(e) => handleHover?.(e, model, false)}
          onPointerDown={(e)=> handleDrag?.(e, model)}
          pointerEvents={handleHover ? "visible" : "none"}
         >
          <rect x={x} y={y}
              width={width} height={height}
              stroke={stroke} fill="#FFFFFF" opacity="80%"
              rx="5" ry="5" />
          <clipPath id={clipId}>
            <rect x={x} y={y} width={width} height={height} />
          </clipPath>
          <TextContent
            editing={model.isEditing && !readOnly}
            clip={clipId}
            text={text}
            model={textobj}
            x={x}
            y={y}
            width={width}
            height={height}
            margin={margin}
            handleTextAreaPointerDown={handleTextAreaPointerDown}
            textColor={stroke}
          />
         </g>;

});

export class TextDrawingTool extends DrawingTool {

  constructor(drawingLayer: IDrawingLayer) {
    super(drawingLayer);
  }

  public handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Select the drawing tile, but don't propagate event to do normal Cmd-click procesing.
    this.drawingLayer.selectTile(false);
    e.stopPropagation();
    if (!e.isPrimary) return;

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
