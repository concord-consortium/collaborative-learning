import { inject, observer } from "mobx-react";
import React from "react";
import { ClueAppHeaderComponent } from "./clue-app-header";
import { EPanelId, IPanelGroupSpec } from "../../components/app-header";
import { BaseComponent, IBaseProps } from "../../components/base";
import { DocumentWorkspaceComponent } from "../../components/document/document-workspace";
import { DialogComponent } from "../../components/utilities/dialog";
import { TeacherDashboardComponent } from "./teacher/teacher-dashboard";
import { Logger, LogEventName } from "../../lib/logger";
import "./clue-app-content.sass";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class ClueAppContentComponent extends BaseComponent<IProps> {

  constructor(props: IProps) {
    super(props);
  }

  public render() {
    const { appConfig: {autoAssignStudentsToIndividualGroups}, user, ui } = this.stores;
    const isTeacher = user && user.isTeacher;

    const panels: IPanelGroupSpec = [{
                    panelId: EPanelId.workspace,
                    label: "Workspace & Resources",
                    content: <DocumentWorkspaceComponent />
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
      : isTeacher ? EPanelId.dashboard : EPanelId.workspace;

    const currentPanelSpec = panels.find(spec => spec.panelId === teacherPanelKey);
    const currentPanelContent = currentPanelSpec && currentPanelSpec.content;

    return (
      <div className="clue-app-content">
        <ClueAppHeaderComponent panels={panels}
                            current={teacherPanelKey} onPanelChange={this.handlePanelChange}
                            showGroup={!autoAssignStudentsToIndividualGroups} />
        {currentPanelContent}
        <DialogComponent dialog={ui.dialog} />
      </div>
    );
  }

  private handlePanelChange = (panelId: EPanelId) => {
    const { user, ui } = this.stores;
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
