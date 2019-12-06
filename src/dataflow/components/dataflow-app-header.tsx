import { Button, ButtonGroup } from "@blueprintjs/core";
import { inject, observer } from "mobx-react";
import * as React from "react";
import { IPanelGroupSpec } from "../../components/app-header";
import { BaseComponent, IBaseProps } from "../../components/base";
import { ClassMenuContainer } from "../../components/class-menu-container";
import { ProblemMenuContainer } from "../../components/problem-menu-container";
import { GroupModelType, GroupUserModelType } from "../../models/stores/groups";

import "../../components/utilities/blueprint.sass";
import "./dataflow-app-header.sass";

interface IProps extends IBaseProps {
  isGhostUser: boolean;
  panels: IPanelGroupSpec;
  current: string;
  onPanelChange: (panel: string) => void;
  showGroup: boolean;
}

@inject("stores")
@observer
export class DataflowAppHeaderComponent extends BaseComponent<IProps, {}> {

  public render() {
    const { showGroup } = this.props;
    const {appConfig, appMode, appVersion, db, user, problem, groups} = this.stores;
    const myGroup = showGroup ? groups.groupForUser(user.id) : undefined;
    const userTitle = appMode !== "authed" ? `Firebase UID: ${db.firebase.userId}` : undefined;

    if (user.isTeacher && appConfig.showClassSwitcher) {
      return this.renderTeacherHeader(userTitle);
    }

    return (
      <div className="app-header">
        <div className="left">
          <div>
            <div className="problem" data-test="problem-title">{problem.fullTitle}</div>
            <div className="class" data-test="user-class">{user.className}</div>
          </div>
        </div>
        <div className="middle">
          {this.renderPanelButtons()}
        </div>
        <div className="right">
          <div className="version">Version {appVersion}</div>
          {myGroup ? this.renderGroup(myGroup) : null}
          <div className="user">
            <div className="name" title={userTitle} data-test="user-name">{user.name}</div>
          </div>
        </div>
      </div>
    );
  }

  private renderTeacherHeader(userTitle: string | undefined) {
    const { investigation, user } = this.stores;
    return (
      <div className="app-header">
        <div className="left">
          <div className="problem" data-test="investigation-title">
            {investigation.title}
          </div>
          <div className="problem" data-test="user-class">
            <ProblemMenuContainer />
          </div>
        </div>
        <div className="middle">
          {this.renderPanelButtons()}
        </div>
        <div className="right">
          <div className="class" data-test="user-class">
            <ClassMenuContainer />
          </div>
          <div className="name" title={userTitle} data-test="user-name">
            {user.name}
          </div>
        </div>
      </div>
    );
  }

  private renderPanelButtons() {
    const { panels } = this.props;
    if (!panels || (panels.length < 2)) return;
    if (!this.stores.user.isTeacher) return;

    interface IPanelButtonProps {
      panelId: string;
      label: string;
      current: string;
      onPanelChange: (panel: string) => void;
    }

    const PanelButton: React.FC<IPanelButtonProps> = (props) => {
      const { panelId, label, current, onPanelChange } = props;
      const handlePanelChange = () => { onPanelChange && onPanelChange(panelId); };
      return (
        <Button active={current === panelId}
                disabled={(current !== panelId) && !onPanelChange}
                onClick={handlePanelChange}>
          {label}
        </Button>
      );
    };

    const panelButtons = panels
      .filter(spec => spec.label.length > 0)
      .map(spec => {
      return (
        <PanelButton
          key={spec.panelId}
          panelId={spec.panelId}
          label={spec.label}
          current={this.props.current}
          onPanelChange={this.props.onPanelChange} />
      );
    });

    return (
      <ButtonGroup>
        {panelButtons}
      </ButtonGroup>
    );
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
      <div className="group">
        <div onClick={this.handleResetGroup} className="name" data-test="group-name">{`Group ${group.id}`}</div>
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
    const {isGhostUser} = this.props;
    const {ui, db, groups} = this.stores;
    ui.confirm("Do you want to leave this group?", "Leave Group")
      .then((ok) => {
        if (ok) {
          if (isGhostUser) {
            groups.ghostGroup();
          }
          else {
            db.leaveGroup();
          }
        }
      });
  }
}
