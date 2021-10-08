import React from "react";
import ExpandIndicatorIcon from "../../assets/expand-indicator-icon.svg";
import "./collapsed-workspace-tab.scss";

interface IProps {
  workspaceType: string;
  onExpandWorkspace: () => void;
}

export const CollapsedWorkspaceTab: React.FC<IProps> = ({ workspaceType, onExpandWorkspace }) => {
  return (
    <div className={`collapsed-workspace-tab ${workspaceType}`} onClick={() => onExpandWorkspace()}>
      <div className="collapsed-tab-label">My Workspace</div>
      <div className="expand-right-indicator">
        <ExpandIndicatorIcon />
      </div>
    </div>
  );
};
