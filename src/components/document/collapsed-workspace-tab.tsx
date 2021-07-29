import React from "react";
import ExpandIndicatorIcon from "../../assets/expand-indicator-icon.svg";
import "./collapsed-workspace-tab.scss";

interface IProps {
  workspaceType: string;
  onExpandWorkspace: (expand: boolean) => void;
}
export const CollapsedWorkspaceTab: React.FC<IProps> = ({ workspaceType, onExpandWorkspace }) => {
  return (
    <div className={`collapsed-workspace-tab ${workspaceType}`} onClick={() => onExpandWorkspace(true)}>
      <div className="collapsed-tab-label">My Workspaces</div>
      <div className="expand-right-indicator">
        <ExpandIndicatorIcon />
      </div>
    </div>
  );
};
