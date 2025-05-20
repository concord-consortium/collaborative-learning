import { observer } from "mobx-react";
import { Instance, SnapshotIn, types, getSnapshot } from "mobx-state-tree";
import React from "react";
import { DrawingObjectType, DrawingTool, EditableObject, IDrawingComponentProps,
  IDrawingLayer, ObjectTypeIconViewBox, SizedObject, typeField } from "./drawing-object";
import { Point } from "../model/drawing-basic-types";
import { uniqueId } from "../../../../src/utilities/js-utils";
import { WrappedSvgText } from "../components/wrapped-svg-text";
import { Transformable } from "../components/transformable";

import TextToolIcon from "../../../assets/icons/comment/comment.svg";

// Note - TextObject has a stroke color, but is not implementing StrokedObject
// because it doesn't support stroke width or dashArray.
export const TextObject = types.compose("TextObject", EditableObject, SizedObject)
  .props({
    type: typeField("text"),
    stroke: types.string,
    text: types.string
  })
  .views(self => ({
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

const TextContent: React.FC<IContentProps> = observer(({
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
});

export const TextComponent = observer(
    function TextComponent({model, readOnly, handleHover, handleDrag} : IDrawingComponentProps) {
  if (!isTextObject(model)) return null;
  const textobj = model as TextObjectType;
  const { id, stroke, text, position, transform } = textobj;
  const { width, height } = textobj.currentDims;
  const clipId = uniqueId();
  const margin = 5;

  const handleTextAreaPointerDown = (e: React.PointerEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
  };

  return (
    <Transformable type="text" position={position} transform={transform}>
      <g
        key={id}
        className="text"
        onMouseEnter={(e) => handleHover?.(e, model, true)}
        onMouseLeave={(e) => handleHover?.(e, model, false)}
        onPointerDown={(e) => handleDrag?.(e, model)}
        pointerEvents={handleHover ? "visible" : "none"}
      >
        <rect x={0} y={0}
          width={width} height={height}
          stroke={stroke} fill="#FFFFFF" opacity="80%"
          rx="5" ry="5" />
        <clipPath id={clipId}>
          <rect x={0} y={0} width={width} height={height} />
        </clipPath>
        <TextContent
          editing={model.isEditing && !readOnly}
          clip={clipId}
          text={text}
          model={textobj}
          x={0}
          y={0}
          width={width}
          height={height}
          margin={margin}
          handleTextAreaPointerDown={handleTextAreaPointerDown}
          textColor={stroke}
        />
      </g>
    </Transformable>
  );

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
