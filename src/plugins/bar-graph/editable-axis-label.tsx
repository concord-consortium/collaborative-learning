import React, { useEffect } from 'react';
import { Text } from '@visx/text';
import { getBBox } from './bar-graph-utils';
import { useReadOnlyContext } from '../../components/document/read-only-context';

const paddingX = 5, paddingY = 10;

interface IProps {
  x: number;
  y: number;
  text?: string;
  setText: (text: string) => void;
}

const EditableAxisLabel: React.FC<IProps> = ({text, x, y, setText}) => {

  const readOnly = useReadOnlyContext();
  const textRef = React.useRef<SVGGElement|null>(null);
  const [boundingBox, setBoundingBox] = React.useState<DOMRect | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [displayText, setDisplayText] = React.useState<string>(text || "Y axis");
  const [editText, setEditText] = React.useState<string>(text || "Y axis");

  useEffect(() => {
    if (textRef.current) {
      const bb = getBBox(textRef.current);
      setBoundingBox(bb);
    }
  }, [x, y, displayText, textRef]);

  const handleClose = (accept: boolean) => {
    setEditing(false);
    if (accept && editText) {
      const trimmed = editText.trim();
      setDisplayText(trimmed);
      setText(trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
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

  if (editing) {
    return (
      <foreignObject data-testid="axis-label-editor" x={x} y={y} width={500} height={30}>
        <input
          type="text"
          className="focusable"
          value={editText}
          size={editText.length + 5}
          onKeyDown={handleKeyDown}
          onBlur={() => handleClose(true)}
          onChange={(e) => setEditText(e.target.value)}
        />
      </foreignObject>
    );
  }

  return (
    <g>
      {boundingBox &&
        <rect
          data-testid="axis-label-button"
          x={boundingBox.x - paddingX}
          y={boundingBox.y - paddingY}
          width={boundingBox.width + 2*paddingX}
          height={boundingBox.height + 2*paddingY}
          rx={paddingX}
          ry={paddingX}
          stroke="#949494"
          strokeWidth={1.5}
          fill="none"
          pointerEvents={editing ? "none" : "all"}
          onClick={() => { if (!readOnly) setEditing(true); }}
        />}
      <g ref={textRef}>
        <Text
          x={x+paddingX}
          y={y}
          angle={-90}
          textAnchor="middle"
          verticalAnchor="start"
          className="editable-axis-label"
          fontFamily="Lato"
          fontSize={14}
          pointerEvents="none"
        >
          {displayText}
        </Text>
      </g>
    </g>
  );
};

export default EditableAxisLabel;
