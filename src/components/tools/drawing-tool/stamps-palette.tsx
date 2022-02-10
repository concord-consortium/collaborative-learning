import classNames from "classnames";
import React from "react";
import { StampModelType } from "../../../models/tools/drawing/stamp";
import { StampButton } from "./stamp-button";

interface IProps {
  stamps: StampModelType[];
  selectedStampIndex?: number;
  onSelectStampIndex: (index: number) => void;
}
export const StampsPalette: React.FC<IProps> = ({
  stamps, selectedStampIndex, onSelectStampIndex
}) => {
  const oneRow = stamps.length <= 6;
  return (
    <div className={classNames("toolbar-palette", "stamps", { "one-row": oneRow })}>
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
