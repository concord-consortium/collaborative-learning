import React from "react";
import { DrawingContentModelType } from "../../../models/tools/drawing/drawing-content";

interface IProps {
  drawingContent: DrawingContentModelType;
  onSelectStamp: (index: number) => void;
}

export const DrawingStampSelection: React.FC<IProps> = ({ drawingContent, onSelectStamp }) => {
  const {stamps, currentStamp} = drawingContent;

  const handleClick = (index: number) => {
    onSelectStamp(index);
  };
  return (
    <div className="settings stamps">
      <div className="title"><span className="icon icon-menu" /> Stamps</div>
      <div>
        {
          stamps.map((stamp, i) => {
            const className = (currentStamp && stamp.url === currentStamp.url) ? "selected" : "";
            return <img key={stamp.url} src={stamp.url} className={className} onClick={() => handleClick(i)} />;
          })
        }
      </div>
    </div>
  );
};
