import { inject, observer } from "mobx-react";
import React from "react";
import { ClueAppHeaderComponent } from "./clue-app-header";
import { EPanelId, IPanelGroupSpec } from "../../components/app-header";
import { BaseComponent, IBaseProps } from "../../components/base";
import { WorkspaceComponent } from "../../components/workspace/workspace";
import { DialogComponent } from "../../components/utilities/dialog";
import { TeacherDashboardComponent } from "./teacher/teacher-dashboard";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";

import "./clue-app-content.sass";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class ClueAppContentComponent extends BaseComponent<IProps> {

  constructor(props: IProps) {
    super(props);
  }

  public render() {
    const { appConfig: {autoAssignStudentsToIndividualGroups}, user, persistentUi: ui } = this.stores;

    const panels: IPanelGroupSpec = [{
                    panelId: EPanelId.workspace,
                    label: "Workspace & Resources",
                    content: <WorkspaceComponent />
                  }];
    if (user && user.isTeacher) {
      panels.unshift({
        panelId: EPanelId.dashboard,
        label: "Dashboard",
        content: <TeacherDashboardComponent />
      });
    }
    const teacherPanelKey = ui.teacherPanelKey
      ? ui.teacherPanelKey
      : EPanelId.workspace;

    const currentPanelSpec = panels.find(spec => spec.panelId === teacherPanelKey);
    const currentPanelContent = currentPanelSpec && currentPanelSpec.content;

    return (
      <div className="clue-app-content">
        <ClueAppHeaderComponent panels={panels}
                            current={teacherPanelKey} onPanelChange={this.handlePanelChange}
                            // This assumes that when we auto-assign students to groups,
                            // we don't want to see the Groups in the header
                            showGroup={!autoAssignStudentsToIndividualGroups} />
        {currentPanelContent}
        <DialogComponent/>
      </div>
    );
  }

  private handlePanelChange = (panelId: EPanelId) => {
    const { user, persistentUi: ui } = this.stores;
    ui.setTeacherPanelKey(panelId);

    // log teacher dashboard panel changes
    if (user && user.isTeacher) {
      if (panelId === EPanelId.workspace) {
        Logger.log(LogEventName.DASHBOARD_TOGGLE_TO_WORKSPACE);
      }
      else if (panelId === EPanelId.dashboard) {
        Logger.log(LogEventName.DASHBOARD_TOGGLE_TO_DASHBOARD);
      }
    }
  };
}
