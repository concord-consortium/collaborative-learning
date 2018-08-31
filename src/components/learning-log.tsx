import { inject, observer } from "mobx-react";
import * as React from "react";

import "./learning-log.sass";
import { TabComponent } from "./tab";
import { TabSetComponent } from "./tab-set";
import { BaseComponent } from "./base";

@inject("stores")
@observer
export class LearningLogComponent extends BaseComponent<{}, {}> {

  public render() {
    const className = `learning-log${this.stores.ui.learningLogExpanded ? " expanded" : ""}`;
    return (
      <div className={className} onClick={this.handleClick}>
        <TabSetComponent>
          <TabComponent>LL</TabComponent>
          <TabComponent>M</TabComponent>
          <TabComponent>C</TabComponent>
        </TabSetComponent>
        <div className="expanded-area">
          <div className="tbd">TBD</div>
        </div>
      </div>
    );
  }

  private handleClick = () => {
    this.stores.ui.toggleLearningLog();
  }
}
