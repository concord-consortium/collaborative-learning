import classNames from "classnames";
import React from "react";
import DragThumbnailIcon from "../../assets/drag-thumb-icon.svg";
import LeftDragIcon from "../../assets/left-drag.svg";
import RightDragIcon from "../../assets/right-drag.svg";
import { kDividerMax, kDividerMin } from "../../models/stores/ui-types";
import "./resize-panel-divider.scss";

interface IProps {
  isResourceExpanded: boolean;
  dividerPosition: number;
  onExpandWorkspace: () => void;
  onExpandResources: () => void;
}

export const ResizePanelDivider: React.FC <IProps> =
  ({dividerPosition, onExpandWorkspace, onExpandResources}) => {
    const dividerMinLeftOffset = 39.5;
    const dividerMidLeftOffset = 21;
    const dividerMaxLeftOffset = 22;
    const tabWidth = 45;
    const dividerPositionStyle = dividerPosition  === kDividerMin
                                  ? {left: dividerMinLeftOffset}
                                  : dividerPosition === kDividerMax
                                      ? {left: `calc(${dividerPosition}% - ${tabWidth}px - ${dividerMaxLeftOffset}px)`}
                                      : {left: `calc(${dividerPosition}% - ${dividerMidLeftOffset}px)`};
    const classes = classNames("resize-panel-divider", {
                                "divider-min": dividerPosition  === kDividerMin,
                                "divider-max": dividerPosition === kDividerMax });
  return (
    <div className={classes} style={dividerPositionStyle}>
      <div className="divider" />
      <div className="drag-handles">
        {!(dividerPosition === kDividerMin) &&
          <LeftDragIcon className={`drag-left-handle ${dividerPosition === kDividerMin ? "disabled" : "" }`}
                        onClick={() => onExpandWorkspace()} />
        }
        {!(dividerPosition === kDividerMax) &&
          <RightDragIcon className={`drag-right-handle ${dividerPosition === kDividerMax ? "disabled" : ""}`}
                         onClick={() => onExpandResources()} />
        }
      </div>
      <DragThumbnailIcon className="drag-thumbnail"/>
    </div>
  );
};
