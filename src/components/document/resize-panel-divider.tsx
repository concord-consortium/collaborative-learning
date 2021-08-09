import React from "react";
import DragThumbnailIcon from "../../assets/drag-thumb-icon.svg";
import LeftRightDragIcon from "../../assets/left-right-drag.svg";
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
      <DragThumbnailIcon className="drag-thumbnail"/>
      <div className="drag-handles">
        <div className="drag-left-handle" onClick={() => onExpandWorkspace()}></div>
        <LeftRightDragIcon className="left-right-drag"/>
        <div className="drag-right-handle" onClick={() => onExpandResources()}></div>
      </div>
    </div>
  );
};
