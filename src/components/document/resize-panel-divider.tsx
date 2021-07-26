import React from "react";
import DragThumbnailIcon from "../../assets/drag-thumb-icon.svg";
import LeftRightDragIcon from "../../assets/left-right-drag.svg";
import "./resize-panel-divider.scss";

interface IProps {
  isResourceExpanded: boolean
  onExpandWorkspace: (expand: boolean) => void;
}
export const ResizePanelDivider: React.FC <IProps>= ({isResourceExpanded, onExpandWorkspace}) => {
  const dividerPosition = isResourceExpanded ? {right: "50%"} :  {left: 44};
  return (
    <div className="resize-panel-divider" onClick={()=>onExpandWorkspace(false)} style={dividerPosition}>
      <div className="divider" />
      <DragThumbnailIcon className="drag-thumbnail"/>
      <LeftRightDragIcon className="left-right-drag"/>
    </div>
  );
};
