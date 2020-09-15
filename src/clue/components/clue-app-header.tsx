import { inject, observer } from "mobx-react";
import React from "react";
import { EPanelId, IPanelGroupSpec } from "../../components/app-header";
import { BaseComponent, IBaseProps } from "../../components/base";
import { ClassMenuContainer } from "../../components/class-menu-container";
import { ProblemMenuContainer } from "../../components/problem-menu-container";
import { ToggleGroup } from "@concord-consortium/react-components";
import { GroupModelType, GroupUserModelType } from "../../models/stores/groups";
import { CustomSelect } from "./custom-select";

// cf. https://mattferderer.com/use-sass-variables-in-typescript-and-javascript
import styles from "./toggle-buttons.scss";

import "../../components/utilities/blueprint.sass";
import "./clue-app-header.sass";

interface IProps extends IBaseProps {
  panels: IPanelGroupSpec;
  current: string;
  onPanelChange: (panelId: EPanelId) => void;
  showGroup: boolean;
}

@inject("stores")
@observer
export class ClueAppHeaderComponent extends BaseComponent<IProps> {

  public render() {
    const { showGroup } = this.props;
    const { appConfig, appMode, appVersion, db, user, problem, groups, investigation, unit } = this.stores;
    const myGroup = showGroup ? groups.groupForUser(user.id) : undefined;
    const userTitle = appMode !== "authed" ? `Firebase UID: ${db.firebase.userId}` : undefined;

    if (user.isTeacher && appConfig.showClassSwitcher) {
      return this.renderTeacherHeader(userTitle);
    }
    return (
      <div className="app-header">
        <div className="left">
          <div className="unit">
            <div className="title" data-test="unit-title">
              {unit.title}
            </div>
            <div className="investigation" data-test="investigation">
              {investigation.title}
            </div>
          </div>
          <div className="separator"/>
          <CustomSelect
            items={[{text: `${problem.title}: ${problem.subtitle}`}]}
            isDisabled={true}
          />
        </div>
        <div className="middle student">
          {this.renderPanelButtons()}
        </div>
        <div className="right">
          <div className="version">Version {appVersion}</div>
          {myGroup ? this.renderGroup(myGroup) : null}
          <div className="user">
            <div className="user-contents">
              <div className="name" title={userTitle} data-test="user-name">{user.name}</div>
              <div className="class" data-test="user-class">{user.className}</div>
            </div>
            <div className="profile-icon">
              <div className="profile-icon-inner"/>
            </div>
          </div>
        </div>
      </div>
    );
  }

  private renderTeacherHeader(userTitle: string | undefined) {
    const { investigation, unit } = this.stores;
    return (
      <div className="app-header">
        <div className="left">
          <div className="unit" data-test="investigation-title">
            <div className="title">
              {unit.title}
            </div>
            <div className="investigation">
              {investigation.title}
            </div>
          </div>
          <div className="separator"/>
          <div className="problem-dropdown" data-test="user-class">
            <ProblemMenuContainer />
          </div>
        </div>
        <div className="middle">
          {this.renderPanelButtons()}
        </div>
        <div className="right">
          <div className="user teacher">
            <div className="class" data-test="user-class">
              <ClassMenuContainer />
            </div>
            <div className="profile-icon teacher">
              <div className="profile-icon-inner"/>
            </div>
          </div>
        </div>
      </div>
    );
  }

  private renderPanelButtons() {
    const { panels, onPanelChange, current} = this.props;
    if (!panels || (panels.length < 2)) return;

    const panelButtons = panels
      .filter(spec => spec.label.length > 0)
      .map(spec => {
        const { label, panelId } = spec;
        const onClick = () => { onPanelChange?.(panelId); };
        const key = panelId;
        const selected = key === current;
        const colors = panelId === EPanelId.workspace || panelId === EPanelId.dashboard
          ? {
            unselectedColor: {
              color: panelId === EPanelId.workspace
                     ? styles.toggleButtonWorkspaceColor
                     : styles.toggleButtonDashboardColor,
              background: panelId === EPanelId.workspace
                          ? styles.toggleButtonWorkspaceBackgroundColor
                          : styles.toggleButtonDashboardBackgroundColor
            },
            hoverColor: {
              color: panelId === EPanelId.workspace
                     ? styles.toggleButtonWorkspaceColor
                     : styles.toggleButtonDashboardColor,
              background: panelId === EPanelId.workspace
                          ? styles.toggleButtonWorkspaceHoverBackgroundColor
                          : styles.toggleButtonDashboardHoverBackgroundColor
            },
            selectedColor: {
              color: panelId === EPanelId.workspace
                     ? styles.toggleButtonWorkspaceColor
                     : styles.toggleButtonDashboardColor,
              background: panelId === EPanelId.workspace
                          ? styles.toggleButtonWorkspaceSelectedBackgroundColor
                          : styles.toggleButtonDashboardSelectedBackgroundColor,
            }
          }
          : undefined;
        return { label, onClick, key, selected, colors };
      });
    return <ToggleGroup options={panelButtons} />;
  }

  private renderGroup(group: GroupModelType) {
    const {user} = this.stores;
    const groupUsers = group.users.slice();
    const userIndex = groupUsers.findIndex((groupUser) => groupUser.id === user.id);
    // Put the main user first to match 4-up colors
    if (userIndex > -1) {
      groupUsers.unshift(groupUsers.splice(userIndex, 1)[0]);
    }
    return (
      <div onClick={this.handleResetGroup} className="group">
        <div className="name" data-test="group-name">{`Group ${group.id}`}</div>
        <div className="group-center"/>
        <div className="members" data-test="group-members">
          <div className="row">
            {this.renderGroupUser(groupUsers, 0, "nw")}
            {this.renderGroupUser(groupUsers, 1, "ne")}
          </div>
          <div className="row">
            {this.renderGroupUser(groupUsers, 3, "sw")}
            {this.renderGroupUser(groupUsers, 2, "se")}
          </div>
        </div>
      </div>
    );
  }

  private renderGroupUser(groupUsers: GroupUserModelType[], index: number, direction: "nw" | "ne" | "se" | "sw") {
    if (groupUsers.length <= index) {
      return (
        <div key={`empty-${index}`} className={`member empty ${direction}`}/>
      );
    }

    const user = groupUsers[index];
    const className = `member ${user.connected ? "connected" : "disconnected"}`;
    const title = `${user.name}: ${user.connected ? "connected" : "disconnected"}`;
    return (
      <div
        key={user.id}
        className={`${className} ${direction}`}
        title={title}
      >
        <div className="initials">{user.initials}</div>
      </div>
    );
  }

  private handleResetGroup = () => {
    const {ui, db} = this.stores;
    ui.confirm("Do you want to leave this group?", "Leave Group")
      .then((ok) => {
        if (ok) {
          db.leaveGroup();
        }
      });
  }
}
