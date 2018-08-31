import { inject, observer } from "mobx-react";
import * as React from "react";
import { HeaderComponent } from "./header";
import { LearningLogComponent } from "./learning-log";
import { LeftNavComponent } from "./left-nav";
import { MyWorkComponent } from "./my-work";
import { WorkspaceComponent } from "./workspace";
import { BaseComponent, IBaseProps } from "./base";

import "./app-container.sass";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class AppContainerComponent extends BaseComponent<IProps, {}> {

  public render() {
    return (
      <div className="app-container">
        <HeaderComponent />
        <WorkspaceComponent />
        {this.stores.ui.allContracted ? null : this.renderBlocker()}
        <LeftNavComponent />
        <MyWorkComponent />
        <LearningLogComponent />
      </div>
    );
  }

  private handleRemoveBlocker = () => {
    this.stores.ui.contractAll();
  }

  private renderBlocker() {
    return (
      <div className="blocker" onClick={this.handleRemoveBlocker} />
    );
  }
}
