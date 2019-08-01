import { inject, observer } from "mobx-react";
import * as React from "react";
import { AppHeaderComponent, IPanelGroupSpec } from "../../components/app-header";
import { DataflowPanelType } from "./dataflow-types";
import { BaseComponent, IBaseProps } from "./dataflow-base";
import { DocumentWorkspaceComponent } from "../../components/document/document-workspace";
import { DialogComponent } from "../../components/utilities/dialog";
import { HubListComponent } from "./hub-list";

import "./dataflow-app-content.sass";

interface IProps extends IBaseProps {}

interface IState {
  current: DataflowPanelType;
}

@inject("stores")
@observer
export class DataflowAppContentComponent extends BaseComponent<IProps, IState> {

  public state: IState = { current: DataflowPanelType.kWorkspacePanelId };

  public componentWillMount() {
    const { iot } = this.stores;
    iot.connect(this.stores);
  }

  public componentWillUnmount() {
    const { iot } = this.stores;
    iot.disconnect();
  }

  public render() {
    const isGhostUser = this.stores.groups.ghostUserId === this.stores.user.id;
    const panels: IPanelGroupSpec = [{
                    panelId: DataflowPanelType.kControlPanelId,
                    label: "Control Panels",
                    content: <HubListComponent />
                  }, {
                    panelId: DataflowPanelType.kWorkspacePanelId,
                    label: "Workspace",
                    content: <DocumentWorkspaceComponent isGhostUser={isGhostUser} />
                  }];

    const currentPanelSpec = panels.find(spec => spec.panelId === this.state.current);
    const currentPanelContent = currentPanelSpec && currentPanelSpec.content;

    return (
      <div className="dataflow-app-content">
        <AppHeaderComponent isGhostUser={isGhostUser} panels={panels}
                            current={this.state.current} onPanelChange={this.handlePanelChange}
                            showGroup={false} />
        <div className="dataflow-panel">
          {currentPanelContent}
        </div>
        <DialogComponent dialog={this.stores.ui.dialog} />
      </div>
    );
  }

  private handlePanelChange = (panelId: string) => {
    const { ui } = this.stores;
    ui.toggleLeftNav(false);
    ui.toggleRightNav(false);
    this.setState({ current: panelId as DataflowPanelType });
  }

}
