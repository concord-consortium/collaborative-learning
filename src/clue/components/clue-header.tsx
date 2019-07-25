import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "../../components/base";
import { GroupModelType, GroupUserModelType } from "../../models/stores/groups";

import "./clue-header.sass";

interface IProps extends IBaseProps {
  isGhostUser: boolean;
}

@inject("stores")
@observer
export class ClueHeaderComponent extends BaseComponent<IProps, {}> {

  public render() {
    const {appMode, db, user, problem, groups} = this.stores;
    const myGroup = groups.groupForUser(user.id);
    const userTitle = appMode !== "authed" ? `Firebase UID: ${db.firebase.userId}` : undefined;

    return (
      <div className="clue-header">
        <div className="info">
          <div>
            <div className="problem" data-test="problem-title">{problem.fullTitle}</div>
            <div className="class" data-test="user-class">{user.className}</div>
          </div>
        </div>
        {myGroup ? this.renderGroup(myGroup) : null}
        <div className="user">
          <div className="name" title={userTitle} data-test="user-name">{user.name}</div>
        </div>
      </div>
    );
  }

  private renderGroup(group: GroupModelType) {
    const {appVersion, user} = this.stores;
    const groupUsers = group.users.slice();
    const userIndex = groupUsers.findIndex((groupUser) => groupUser.id === user.id);
    // Put the main user first to match 4-up colors
    if (userIndex > -1) {
      groupUsers.unshift(groupUsers.splice(userIndex, 1)[0]);
    }
    return (
      <div className="group">
        <div className="version">Version {appVersion}</div>
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
