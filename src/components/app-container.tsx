import { inject, observer } from "mobx-react";
import * as React from "react";
import { IStores } from "../models/stores";
import { HeaderComponent } from "./header";
import { LearningLogComponent } from "./learning-log";
import { LeftNavComponent } from "./left-nav";
import { MyWorkComponent } from "./my-work";
import { WorkspaceComponent } from "./workspace";

import "./app-container.sass";

interface IProps {
  stores?: IStores;
}

@inject("stores")
@observer
export class AppContainerComponent extends React.Component<IProps, {}> {

  get stores() {
    return this.props.stores as IStores;
  }

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
