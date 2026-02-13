import { inject, observer } from "mobx-react";
import React from "react";
import { EPanelId, IPanelGroupSpec } from "../../components/app-header";
import { BaseComponent, IBaseProps } from "../../components/base";
import { DialogComponent } from "../../components/utilities/dialog";
import { WorkspaceComponent } from "../../components/workspace/workspace";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";
import { kDividerHalf } from "../../models/stores/ui-types";
import { upperWords } from "../../utilities/string-utils";
import { translate } from "../../utilities/translation/translate";
import { ClueAppHeaderComponent } from "./clue-app-header";
import { TeacherDashboardComponent } from "./teacher/teacher-dashboard";
import { getAriaLabels } from "../../hooks/use-aria-labels";
import { getPanelVisibility } from "../../hooks/use-panel-visibility";

import "./clue-app-content.scss";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class ClueAppContentComponent extends BaseComponent<IProps> {

  constructor(props: IProps) {
    super(props);
  }

  public render() {
    const { appConfig: {autoAssignStudentsToIndividualGroups}, user, persistentUI } = this.stores;

    const panels: IPanelGroupSpec = [{
                    panelId: EPanelId.workspace,
                    label: `${upperWords(translate("workspace"))} & Resources`,
                    content: <WorkspaceComponent />
                  }];
    if (user && user.isTeacherOrResearcher) {
      panels.unshift({
        panelId: EPanelId.dashboard,
        label: "Dashboard",
        content: <TeacherDashboardComponent />
      });
    }
    const teacherPanelKey = persistentUI.teacherPanelKey
      ? persistentUI.teacherPanelKey
      : EPanelId.workspace;

    const currentPanelSpec = panels.find(spec => spec.panelId === teacherPanelKey);
    const currentPanelContent = currentPanelSpec && currentPanelSpec.content;

    // Skip links: show appropriate links based on which panel is active.
    const isWorkspaceActive = teacherPanelKey === EPanelId.workspace;
    const isDashboardActive = teacherPanelKey === EPanelId.dashboard;
    const { showLeftPanel, showRightPanel } = getPanelVisibility(this.stores);
    const showResourcesSkipLink = isWorkspaceActive && showLeftPanel;
    const showWorkspaceSkipLink = isWorkspaceActive && showRightPanel;
    const showDashboardSkipLink = isDashboardActive;
    const ariaLabels = getAriaLabels();

    return (
      <div className="clue-app-content">
        <nav className="skip-links">
          {showResourcesSkipLink &&
            <a href="#resources-panel" className="skip-link" onClick={this.handleResourcesSkipLink}>
              {ariaLabels.skipToResources}
            </a>
          }
          {showWorkspaceSkipLink &&
            <a href="#workspace-panel" className="skip-link" onClick={this.handleWorkspaceSkipLink}>
              {ariaLabels.skipToWorkspace}
            </a>
          }
          {showDashboardSkipLink &&
            <a href="#main-dashboard" className="skip-link" onClick={this.handleDashboardSkipLink}>
              {ariaLabels.skipToDashboard}
            </a>
          }
        </nav>
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
    const { user, persistentUI } = this.stores;
    persistentUI.setTeacherPanelKey(panelId);

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

  // Skip link handler: expands target panel if collapsed
  private handleSkipLinkClick = (isTargetVisible: boolean, targetElementId: string) => {
    if (!isTargetVisible) {
      this.stores.persistentUI.setDividerPosition(kDividerHalf);
      requestAnimationFrame(() => {
        document.getElementById(targetElementId)?.focus();
      });
    } else {
      document.getElementById(targetElementId)?.focus();
    }
  };

  private handleResourcesSkipLink = () => {
    this.handleSkipLinkClick(this.stores.persistentUI.navTabContentShown, "resources-panel");
  };

  private handleWorkspaceSkipLink = () => {
    this.handleSkipLinkClick(this.stores.persistentUI.workspaceShown, "workspace-panel");
  };

  private handleDashboardSkipLink = () => {
    this.handleSkipLinkClick(true, "main-dashboard");
  };
}
