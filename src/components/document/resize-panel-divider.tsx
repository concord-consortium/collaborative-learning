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
  ({isResourceExpanded, dividerPosition, onExpandWorkspace, onExpandResources}) => {
    const dividerLeftOffset = 22;
    const tabWidth = 45;
    const dividerPositionStyle = dividerPosition  === kDividerMin
                                  ? {left: dividerLeftOffset}
                                  : dividerPosition === kDividerMax
                                      ? {left: `calc(${dividerPosition}% - ${tabWidth}px - ${dividerLeftOffset}px)`}
                                      : {left: `calc(${dividerPosition}% - ${dividerLeftOffset}px)`};
  return (
    <div className="resize-panel-divider" style={dividerPositionStyle}>
      <div className="divider" />
      <div className="drag-handles">
        {!(dividerPosition  === kDividerMin) &&
          <LeftDragIcon className={`drag-left-handle ${dividerPosition  === kDividerMin ? "disabled" : "" }`}
                        onClick={() => onExpandWorkspace()} />
        }
        {!(dividerPosition  === kDividerMax) &&
          <RightDragIcon className={`drag-right-handle ${dividerPosition  === kDividerMax ? "disabled" : ""}`}
                         onClick={() => onExpandResources()} />
        }
      </div>
      <DragThumbnailIcon className="drag-thumbnail"/>
    </div>
  );
};
