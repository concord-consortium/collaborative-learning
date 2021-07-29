import React from "react";
import DragThumbnailIcon from "../../assets/drag-thumb-icon.svg";
import LeftRightDragIcon from "../../assets/left-right-drag.svg";
import "./resize-panel-divider.scss";

interface IProps {
  isResourceExpanded: boolean,
  resourceWidth: string,
  onExpandWorkspace: (expand: boolean) => void;
  onExpandResources: (expand: boolean) => void;
}
export const ResizePanelDivider: React.FC <IProps> =
  ({isResourceExpanded, resourceWidth, onExpandWorkspace, onExpandResources}) => {
    const dividerPosition = !isResourceExpanded ? {left: 22}
                                                : resourceWidth==="full" ? {right : 22}
                                                                         : {right: "calc(50% - 22px)"};

  return (
    <div className="resize-panel-divider"  style={dividerPosition}>
      <div className="divider" />
      <DragThumbnailIcon className="drag-thumbnail"/>
      <div className="drag-handles">
        <div className="drag-left-handle" onClick={()=>onExpandResources(false)}></div>
        <LeftRightDragIcon className="left-right-drag"/>
        <div className="drag-right-handle" onClick={()=>onExpandWorkspace(false)}></div>
      </div>
    </div>
  );
};
