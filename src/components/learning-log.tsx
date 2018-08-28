import { inject, observer } from "mobx-react";
import * as React from "react";

import { IAllStores } from "..";
import { UIModelType } from "../models/ui";
import "./learning-log.sass";
import { TabComponent } from "./tab";
import { TabSetComponent } from "./tab-set";

interface IInjectedProps {
  ui: UIModelType;
}

@inject((allStores: IAllStores) => {
  const injected: IInjectedProps = {
    ui: allStores.ui,
  };
  return injected;
})
@observer
export class LearningLogComponent extends React.Component<{}, {}> {

  get injected() {
    return this.props as IInjectedProps;
  }

  public render() {
    const className = `learning-log${this.injected.ui.learningLogExpanded ? " expanded" : ""}`;
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
    this.injected.ui.toggleLearningLog();
  }
}
