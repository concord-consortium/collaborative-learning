import { inject, observer } from "mobx-react";
import * as React from "react";
import { DataflowAppHeaderComponent } from "./dataflow-app-header";
import { BaseComponent, IBaseProps } from "./dataflow-base";
import { EPanelId, IPanelGroupSpec } from "../../components/app-header";
import { DocumentWorkspaceComponent } from "../../components/document/document-workspace";
import { DialogComponent } from "../../components/utilities/dialog";
import { HubListComponent } from "./hub-list";

import "./dataflow-app-content.sass";
import { DataflowContentModelType } from "../models/tools/dataflow/dataflow-content";

interface IProps extends IBaseProps {}

interface IState {
  current: EPanelId;
}

@inject("stores")
@observer
export class DataflowAppContentComponent extends BaseComponent<IProps, IState> {

  public state: IState = { current: EPanelId.workspace };

  public componentDidMount() {
    const { ui, iot } = this.stores;
    iot.connect(this.stores);
  }

  public componentWillUnmount() {
    const { iot } = this.stores;
    iot.disconnect();
  }

  public render() {
    const isGhostUser = this.stores.groups.ghostUserId === this.stores.user.id;
    const panels: IPanelGroupSpec = [{
      panelId: EPanelId.controlPanel,
      label: "Control Panels",
      content: <HubListComponent />
    }, {
      panelId: EPanelId.workspace,
      label: "Workspace",
      content: <DocumentWorkspaceComponent isGhostUser={isGhostUser} />
    }];

    const currentPanelSpec = panels.find(spec => spec.panelId === this.state.current);
    const currentPanelContent = currentPanelSpec && currentPanelSpec.content;
    const runningProgramIndicator = this.userHasRunningPrograms();
    // use CSS class to switch icon in the right menu to indicate if a program is running
    const dfContainerClass = `dataflow-app-content${runningProgramIndicator}`;

    return (
      <div className={dfContainerClass}>
        <DataflowAppHeaderComponent isGhostUser={isGhostUser} panels={panels}
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
    this.stores.ui.restoreDefaultNavExpansion();
    this.setState({ current: panelId as EPanelId });
  }

  private userHasRunningPrograms = () => {
    const { documents } = this.stores;
    const personalDocs = documents.byType("personal");
    let isRunning = false;

    for (const d of personalDocs) {
      d.content.tileMap.forEach(tile => {
        if (tile.content.type === "Dataflow") {
          const programContent = tile.content as DataflowContentModelType;
          if (programContent.programIsRunning === "true") {
            // If a program was left running on the server but the application was closed, firebase won't
            // know that the program has completed until the next time we look. So if we find programs
            // that were previously running, double-check their run state by comparing end times.
            if (programContent.programEndTime < Date.now()) {
              programContent.setRunningStatus(programContent.programEndTime);
            } else {
              isRunning = true;
            }
          }
        }
      });
      if (isRunning) break;
    }
    return isRunning ? " running" : "";
  }
}
