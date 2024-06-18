import React from "react";
import { StampModelType } from "../model/stamp";
import { StampButton } from "./stamp-button";

interface IProps {
  stamps: StampModelType[];
  selectedStampIndex?: number;
  onSelectStampIndex: (index: number) => void;
}

export const StampsPalette: React.FC<IProps> = ({ stamps, selectedStampIndex, onSelectStampIndex }) => {
  return (
    <div className="toolbar-palette stamps">
      <div className="palette-buttons">
        {stamps.map((stamp, i) =>
          <StampButton key={stamp.url} stamp={stamp}
            isSelected={i === selectedStampIndex}
            onSelectStamp={() => onSelectStampIndex(i)} />
        )}
      </div>
    </div>
  );
};
