import React from "react";
import { upperWords } from "../../utilities/string-utils";
import { translate } from "../../utilities/translation/translate";

import ExpandIndicatorIcon from "../../assets/expand-indicator-icon.svg";

import "./workspace-expander.scss";

interface IProps {
  workspaceType: string;
  onExpandWorkspace: () => void;
}

export const WorkspaceExpander: React.FC<IProps> = ({ workspaceType, onExpandWorkspace }) => {
  return (
    <div className={`workspace-expander ${workspaceType}`} onClick={() => onExpandWorkspace()}>
      <div className="workspace-expander-label">My {upperWords(translate("workspace"))}</div>
      <div className="expand-right-indicator">
        <ExpandIndicatorIcon />
      </div>
    </div>
  );
};
