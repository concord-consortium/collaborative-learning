import { inject, observer } from "mobx-react";
import * as React from "react";
import { AppHeaderComponent, IPanelGroupSpec } from "../../components/app-header";
import { BaseComponent, IBaseProps } from "../../components/base";
import { DocumentWorkspaceComponent } from "../../components/document/document-workspace";
import { TeacherDashboardComponent } from "../../components/teacher/teacher-dashboard";
import { DialogComponent } from "../../components/utilities/dialog";

import "./clue-app-content.sass";
import { Logger, LogEventName } from "../../lib/logger";

enum EPanelId {
  dashboard = "dashboard",
  workspace = "workspace"
}

interface IProps extends IBaseProps {}

interface IState {
  current: EPanelId;
}

@inject("stores")
@observer
export class ClueAppContentComponent extends BaseComponent<IProps, {}> {

  public state: IState;

  constructor(props: IProps) {
    super(props);

    const { user } = this.stores;
    const isTeacher = user && user.isTeacher;
    this.state = { current: isTeacher ? EPanelId.dashboard : EPanelId.workspace };
  }

  public render() {
    const { user } = this.stores;
    const isGhostUser = this.stores.groups.ghostUserId === this.stores.user.id;

    const panels: IPanelGroupSpec = [{
                    panelId: EPanelId.workspace,
                    label: "Workspace",
                    content: <DocumentWorkspaceComponent isGhostUser={isGhostUser} />
                  }];
    if (user && user.isTeacher) {
      panels.unshift({
        panelId: EPanelId.dashboard,
        label: "Dashboard",
        content: <TeacherDashboardComponent />
      });
    }

    const currentPanelSpec = panels.find(spec => spec.panelId === this.state.current);
    const currentPanelContent = currentPanelSpec && currentPanelSpec.content;

    return (
      <div className="clue-app-content">
        <AppHeaderComponent isGhostUser={isGhostUser} panels={panels}
                            current={this.state.current} onPanelChange={this.handlePanelChange}
                            showGroup={true} />
        {currentPanelContent}
        <DialogComponent dialog={this.stores.ui.dialog} />
      </div>
    );
  }

  private handlePanelChange = (panelId: string) => {
    const { user, ui } = this.stores;
    ui.toggleLeftNav(false);
    ui.toggleRightNav(false);
    this.setState({ current: panelId });

    // log teacher dashboard panel changes
    if (user && user.isTeacher) {
      if (panelId === EPanelId.workspace) {
        Logger.log(LogEventName.DASHBOARD_TOGGLE_TO_WORKSPACE);
      }
      else if (panelId === EPanelId.dashboard) {
        Logger.log(LogEventName.DASHBOARD_TOGGLE_TO_DASHBOARD);
      }
    }
  }
}
