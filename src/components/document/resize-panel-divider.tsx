import React from "react";
import DragThumbnailIcon from "../../assets/drag-thumb-icon.svg";
import LeftRightDragIcon from "../../assets/left-right-drag.svg";
import "./resize-panel-divider.sass";

export const ResizePanelDivider: React.FC = () => {
  return (
    <div className="resize-panel-divider">
      <DragThumbnailIcon />
      <LeftRightDragIcon />
    </div>
  );
};
