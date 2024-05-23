import classNames from "classnames";
import React from "react";
import { StampModelType } from "../model/stamp";
import { StampButton } from "./stamp-button";

interface IProps {
  stamps: StampModelType[];
  selectedStampIndex?: number;
  onSelectStampIndex: (index: number) => void;
}
export const StampsPalette: React.FC<IProps> = ({ stamps, selectedStampIndex, onSelectStampIndex }) => {
  const rowClass = classNames(
    "toolbar-palette", "stamps",
    {
      "one-row": stamps.length <= 6,
      "two-rows": stamps.length > 6 && stamps.length <= 12,
      "three-rows": stamps.length > 12 && stamps.length <= 18,
      "four-rows": stamps.length > 18
    }
  );

  return (
    <div className={rowClass}>
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
