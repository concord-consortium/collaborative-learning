import React, { useEffect } from 'react';
import { Text } from '@visx/text';

const paddingX = 5, paddingY = 10;

interface Props {
  x: number;
  y: number;
  text?: string;
}

const EditableAxisLabel: React.FC<Props> = ({text, x, y}) => {

  const textRef = React.useRef<SVGGElement|null>(null);
  const [boundingBox, setBoundingBox] = React.useState<DOMRect | null>(null);

  useEffect(() => {
    if (textRef.current) {
      const bb = textRef.current.getBBox();
      console.log(bb);
      setBoundingBox(bb);
    }
  }, [textRef]);

  return (
    <g>
      {boundingBox &&
        <rect
          x={boundingBox.x - paddingX}
          y={boundingBox.y - paddingY}
          width={boundingBox.width + 2*paddingX}
          height={boundingBox.height + 2*paddingY}
          rx={paddingX}
          ry={paddingX}
          stroke="#949494"
          strokeWidth={1.5}
          fill="none" />}
      <g ref={textRef}>
        <Text
          x={x+paddingX}
          y={y}
          angle={-90}
          textAnchor="middle"
          verticalAnchor="start"
          className="editable-axis-label"
          fontFamily="Lato"
          fontSize={14}>
          {text}
        </Text>
      </g>
    </g>
  );
};

export default EditableAxisLabel;
