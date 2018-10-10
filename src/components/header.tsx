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
          {group.users.map((user) => this.renderGroupUser(user))}
        </div>
      </div>
    );
  }

  private renderGroupUser(user: GroupUserModelType) {
    const {connected} = user;
    const className = `member ${user.connected ? "connected" : "disconnected"}`;
    const title = `${user.name}: ${user.connected ? "connected" : "disconnected"}`;
    return (
      <div
        key={user.id}
        className={className}
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
