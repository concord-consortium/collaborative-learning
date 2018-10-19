import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "./base";

import "./header.sass";
import { GroupModelType, GroupUserModelType } from "../models/groups";

interface IProps extends IBaseProps {
  isGhostUser: boolean;
}

@inject("stores")
@observer
export class HeaderComponent extends BaseComponent<IProps, {}> {

  public render() {
    const {appMode, db, user, problem, groups} = this.stores;
    const myGroup = groups.groupForUser(user.id);
    const userTitle = appMode !== "authed" ? `Firebase UID: ${db.firebase.userId}` : undefined;

    return (
      <div className="header">
        <div className="info">
          <div>
            <div className="problem">{problem.fullTitle}</div>
            <div className="class">{user.className}</div>
          </div>
        </div>
        {myGroup ? this.renderGroup(myGroup) : null}
        <div className="user">
          <div className="name" title={userTitle}>{user.name}</div>
        </div>
      </div>
    );
  }

  private renderGroup(group: GroupModelType) {
    return (
      <div className="group">
        <div onClick={this.handleResetGroup} className="name">{`Group ${group.id}`}</div>
        <div className="members">
          <div className="row">
            {this.renderGroupUser(group, 0, "nw")}
            {this.renderGroupUser(group, 1, "ne")}
          </div>
          <div className="row">
            {this.renderGroupUser(group, 3, "sw")}
            {this.renderGroupUser(group, 2, "se")}
          </div>
        </div>
      </div>
    );
  }

  private renderGroupUser(group: GroupModelType, index: number, direction: "nw" | "ne" | "se" | "sw") {
    if (group.users.length <= index) {
      return (
        <div key={`empty-${index}`} className={`member empty ${direction}`}/>
      );
    }

    const user = group.users[index];
    const className = `member ${user.connected ? "connected" : "disconnected"}`;
    const title = `${user.name}: ${user.connected ? "connected" : "disconnected"}`;
    return (
      <div
        key={user.id}
        className={`${className} ${direction}`}
        title={title}
      >
        {user.initials}
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
