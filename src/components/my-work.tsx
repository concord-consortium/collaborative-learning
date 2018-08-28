import { inject, observer } from "mobx-react";
import * as React from "react";

import { IAllStores } from "..";
import { UIModelType } from "../models/ui";
import "./my-work.sass";
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
})@observer
export class MyWorkComponent extends React.Component<{}, {}> {

  get injected() {
    return this.props as IInjectedProps;
  }

  public render() {
    const { myWorkExpanded } = this.injected.ui;
    const className = `my-work${myWorkExpanded ? " expanded" : ""}`;
    return (
      <div className={className}>
        <TabSetComponent>
          <TabComponent onClick={this.handleClick}>My Work</TabComponent>
        </TabSetComponent>
        <div className="expanded-area">
        <div className="tbd">TBD</div>
        </div>
      </div>
    );
  }

  private handleClick = () => {
    this.injected.ui.toggleMyWork();
  }
}
