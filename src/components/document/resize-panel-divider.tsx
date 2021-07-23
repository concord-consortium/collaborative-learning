import React from "react";
import DragThumbnailIcon from "../../assets/drag-thumb-icon.svg";
import LeftRightDragIcon from "../../assets/left-right-drag.svg";
import "./resize-panel-divider.scss";

export const ResizePanelDivider: React.FC = () => {
  return (
    <div className="resize-panel-divider">
      <div className="divider" />
      <DragThumbnailIcon className="drag-thumbnail"/>
      <LeftRightDragIcon className="left-right-drag"/>
    </div>
  );
};
