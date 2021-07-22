import React from "react";
import "./collapsed-workspace-tab.scss";

export const CollapsedWorkspaceTab: React.FC = () => {
  //needs to get which document type was open to get color of tab
  return (
    <div className="collapsed-workspace-tab">
      <div className="collapsed-tab-label">My Workspaces</div>
    </div>
  );
};
