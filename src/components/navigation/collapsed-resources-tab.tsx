import { inject, observer } from "mobx-react";
import React from "react";
import ExpandIndicatorIcon from "../../assets/expand-indicator-icon.svg";
import { BaseComponent } from "../base";
import "./collapsed-resources-tab.scss";

interface IProps {
  resourceType: string;
  onExpandResources: () => void;
}

@inject("stores")
@observer
export class CollapsedResourcesTab extends BaseComponent<IProps> {

  constructor(props: IProps) {
    super(props);
  }
  render() {
    const { resourceType, onExpandResources } = this.props;
    const { ui } = this.stores;
    return (
      <div className={`collapsed-resources-tab ${resourceType} ${!ui.navTabContentShown ? "shown" : ""}`}
           onClick={() => onExpandResources()}>
        <div className="collapsed-tab-label">My Resources</div>
        <div className="expand-left-indicator">
          <ExpandIndicatorIcon />
        </div>
      </div>
    );
  }
}
