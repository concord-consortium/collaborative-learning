import React from "react";
import ExpandIndicatorIcon from "../../assets/expand-indicator-icon.svg";
import { translate } from "../../utilities/translation/translate";
import "./workspace-expander.scss";

interface IProps {
  workspaceType: string;
  onExpandWorkspace: () => void;
}

export const WorkspaceExpander: React.FC<IProps> = ({ workspaceType, onExpandWorkspace }) => {
  return (
    <div className={`workspace-expander ${workspaceType}`} onClick={() => onExpandWorkspace()}>
      <div className="workspace-expander-label">My {translate("Workspace")}</div>
      <div className="expand-right-indicator">
        <ExpandIndicatorIcon />
      </div>
    </div>
  );
};
