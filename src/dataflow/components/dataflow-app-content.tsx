import { inject, observer } from "mobx-react";
import * as React from "react";
import { DataflowHeaderComponent } from "./dataflow-header";
import { DataflowPanelType } from "./dataflow-types";
import { BaseComponent, IBaseProps } from "./dataflow-base";
import { DocumentWorkspaceComponent } from "../../components/document/document-workspace";
import { DialogComponent } from "../../components/utilities/dialog";
import { HubListComponent } from "./hub-list";

import "./dataflow-app-content.sass";

interface IProps extends IBaseProps {}

interface IState {
  panel: DataflowPanelType;
}

@inject("stores")
@observer
export class DataflowAppContentComponent extends BaseComponent<IProps, IState> {

  public state: IState = { panel: "control-panels" };

  public componentWillMount() {
    const { iot } = this.stores;
    iot.connect(this.stores);
  }

  public componentWillUnmount() {
    const { iot } = this.stores;
    iot.disconnect();
  }

  public render() {
    return (
      <div className="dataflow-app-content">
        <DataflowHeaderComponent
          current={this.state.panel}
          onPanelChange={this.handlePanelChange} />
        <div className="dataflow-panel">
          {this.renderPanel()}
        </div>
        <DialogComponent dialog={this.stores.ui.dialog} />
      </div>
    );
  }

  private handlePanelChange = (panel: DataflowPanelType) => {
    this.setState({ panel });
  }

  private renderPanel() {
    const isGhostUser = this.stores.groups.ghostUserId === this.stores.user.id;
    switch (this.state.panel) {
      case "workspace":
        return <DocumentWorkspaceComponent isGhostUser={isGhostUser} />;
      case "control-panels":
      default:
        return <HubListComponent />;
    }
  }

}
