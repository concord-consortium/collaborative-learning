import React from "react";
import ExpandIndicatorIcon from "../../assets/expand-indicator-icon.svg";
import "./collapsed-workspace-tab.scss";

interface IProps {
  onExpandWorkspace: (expand: boolean) => void;
}
export const CollapsedWorkspaceTab: React.FC<IProps> = ({ onExpandWorkspace }) => {
  //needs to get which document type was open to get color of tab
  return (
    <div className="collapsed-workspace-tab" onClick={()=>onExpandWorkspace(true)}>
      <div className="collapsed-tab-label">My Workspaces</div>
      <div className="expand-right-indicator">
        <ExpandIndicatorIcon />
      </div>
    </div>
  );
};
