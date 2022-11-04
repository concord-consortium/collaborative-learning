import classNames from "classnames";
import React from "react";
import { observer } from "mobx-react";
import { StampModelType } from "../model/stamp";
import { gImageMap } from "../../../models/image-map";

interface IProps {
  stamp: StampModelType;
  isSelected: boolean;
  onSelectStamp: () => void;
}
export const StampButton: React.FC<IProps> = observer(({ stamp, isSelected, onSelectStamp }) => {

  // TODO if stamps can be uploaded by users and shared with tiles that care about
  // filenames, then we need to start storing the file name in the stamp and passing
  // it through to getImageEntry
  const entry = gImageMap.getImageEntry(stamp.url);
  return (
    <div className={classNames("stamp-button", { select: isSelected })} onClick={() => onSelectStamp()}>
      <img src={entry?.displayUrl} draggable="false" />
      <svg className={`highlight ${isSelected ? "select" : ""}`}
            xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" width="30" height="30">
        <rect x="1" y="1" width="28" height="28" strokeWidth="2" fill="none"/>
      </svg>
    </div>
  );
});
StampButton.displayName = "StampButton";
