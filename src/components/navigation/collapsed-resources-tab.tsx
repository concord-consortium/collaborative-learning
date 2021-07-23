import React from "react";
import ExpandIndicatorIcon from "../../assets/expand-indicator-icon.svg";
import "./collapsed-resources-tab.scss";

interface IProps {
  resourceType: string;
  onExpandResources: (expand: boolean) => void;
}
export const CollapsedResourcesTab: React.FC<IProps> = ({ resourceType, onExpandResources }) => {
  return (
    <div className={`collapsed-resources-tab ${resourceType}`} onClick={()=>onExpandResources(true)}>
      <div className="collapsed-tab-label">My Resources</div>
      <div className="expand-left-indicator">
        <ExpandIndicatorIcon />
      </div>
    </div>
  );
};
