import React from "react";
import { getAriaLabels } from "../../hooks/use-aria-labels";

import ExpandIndicatorIcon from "../../assets/expand-indicator-icon.svg";

import "./resources-expander.scss";

interface IProps {
  resourceType: string;
  onExpandResources: () => void;
}

export const ResourcesExpander: React.FC<IProps> = ({ resourceType, onExpandResources }) => {
  const ariaLabels = getAriaLabels();
  return (
    <div className={`resources-expander ${resourceType}`}
          onClick={() => onExpandResources()}>
      <div className="resources-expander-label">{ariaLabels.resourcesPane}</div>
      <div className="expand-left-indicator">
        <ExpandIndicatorIcon />
      </div>
    </div>
  );
};
