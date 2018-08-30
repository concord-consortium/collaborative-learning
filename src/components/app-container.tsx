import { inject, observer } from "mobx-react";
import * as React from "react";
import { IAllStores } from "../index";
import { UIModelType } from "../models/ui";
import { HeaderComponent } from "./header";
import { LearningLogComponent } from "./learning-log";
import { LeftNavComponent } from "./left-nav";
import { MyWorkComponent } from "./my-work";
import { WorkspaceComponent } from "./workspace";

import "./app-container.sass";

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
export class AppContainerComponent extends React.Component<{}, {}> {

  get injected() {
    return this.props as IInjectedProps;
  }

  public render() {
    return (
      <div className="app-container">
        <HeaderComponent />
        <WorkspaceComponent />
        {this.injected.ui.allContracted ? null : this.renderBlocker()}
        <LeftNavComponent />
        <MyWorkComponent />
        <LearningLogComponent />
      </div>
    );
  }

  private handleRemoveBlocker = () => {
    this.injected.ui.contractAll();
  }

  private renderBlocker() {
    return (
      <div className="blocker" onClick={this.handleRemoveBlocker} />
    );
  }
}
