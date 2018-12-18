import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "../base";
import { GroupModelType } from "../../models/stores/groups";

import "./teacher-group-tab.sass";

interface IProps extends IBaseProps {}

interface IState {
  selectedGroup?: GroupModelType;
}

@inject("stores")
@observer
export class TeacherGroupTabComponent extends BaseComponent<IProps, IState> {
  public state: IState = {};

  public render() {
    const { selectedGroup } = this.state;
    return (
      <div className="teacher-group-tab">
        {this.renderGroups()}
        {selectedGroup ? this.renderGroup(selectedGroup) : null}
      </div>
    );
  }

  private renderGroups() {
    const {groups} = this.stores;
    const groupElements = groups.allGroups.map((group) => {
      const users = group.users.map((user) => {
        const className = `user ${user.connected ? "connected" : "disconnected"}`;
        const title = `${user.name}: ${user.connected ? "connected" : "disconnected"}`;
        return <span key={user.id} className={className} title={title}>{user.initials}</span>;
      });
      return (
        <div
          className="group"
          key={group.id}
          onClick={this.handleChooseGroup(group)}
        >
          <div className="group-title">{`Group ${group.id}`}</div>
          <div className="group-users">
            {users}
          </div>
        </div>
      );
    });

    return (
      <div className="group-list">
        {groupElements}
      </div>
    );
  }

  private renderGroup(group: GroupModelType) {
    // TODO: add this to content when view learning logs story (#160072708) is worked on
    // <TeacherStudentTabComponent group={group} />
    return (
      <div className="selected-group">
        <div className="title">
          <div className="info">
            Group {group.id}
          </div>
          <div className="actions">
            <span onClick={this.handleGhostGroup(group)}>Join Group</span>
          </div>
        </div>
        <div className="content" />
      </div>
    );
  }

  private handleChooseGroup = (group: GroupModelType) => {
    return (e: React.MouseEvent<HTMLElement>) => {
      this.setState({selectedGroup: group});
    };
  }

  private handleGhostGroup = (group: GroupModelType) => {
    return (e: React.MouseEvent<HTMLElement>) => {
      this.stores.groups.ghostGroup(this.stores.user.id, group.id);
    };
  }
}
