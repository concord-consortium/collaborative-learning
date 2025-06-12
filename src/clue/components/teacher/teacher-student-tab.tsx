import { inject, observer } from "mobx-react";
import React from "react";
import { BaseComponent, IBaseProps } from "../../../components/base";
import { GroupUserModelType } from "../../../models/stores/groups";
import { TeacherSupports } from "./teacher-supports";
import { UserAudienceModel } from "../../../models/stores/supports";

import "./teacher-student-tab.scss";

interface IProps extends IBaseProps {
  groupId?: string;
}

interface IState {
  selectedUserId?: string;
}

@inject("stores")
@observer
export class TeacherStudentTabComponent extends BaseComponent<IProps, IState> {
  public state: IState = {};

  public UNSAFE_componentWillReceiveProps(nextProps: IProps) {
    if (nextProps.groupId !== this.props.groupId) {
      this.setState({selectedUserId: undefined});
    }
  }

  public render() {
    const { groups } = this.stores;
    const { selectedUserId } = this.state;
    const { groupId } = this.props;
    const group = groups.getGroupById(groupId);
    // TODO: if no group prop then get list of all users in class
    const users = group ? group.activeUsers : [];
    return (
      <div className="teacher-student-tab">
        {this.renderUsers(users)}
        {selectedUserId ? this.renderUser(selectedUserId) : null}
      </div>
    );
  }

  private renderUsers(users: GroupUserModelType[]) {
    const userElements = users.map((user) => {
      const className = `user ${user.connected ? "connected" : "disconnected"}`;
      const title = `${user.name}: ${user.connected ? "connected" : "disconnected"}`;
      return (
        <span
          key={user.id}
          className={className}
          title={title}
          onClick={this.handleChooseUser(user)}
        >
          {user.initials}
        </span>
      );
    });

    return (
      <div className="user-list">
        {userElements.length > 0
          ? userElements
          : (this.props.groupId
              ? "No students found."
              : "TDB: Student List (same as group student list but shows all students)")}
      </div>
    );
  }

  private renderUser(userId: string) {
    const { supports, groups } = this.stores;
    const { selectedUserId } = this.state;
    const { groupId } = this.props;
    const user = groups.getGroupById(groupId)!.getUserById(selectedUserId)!;
    return (
      <div className="selected-group">
        <div className="title">
          <div className="info">
            {user.name}
          </div>
        </div>
        <div className="content">
          <TeacherSupports
            audience={UserAudienceModel.create({identifier: user.id})}
            supports={supports.userSupports.filter(support => {
              return !support.deleted && support.audience.identifier === user.id;
            })}
          />
        </div>
      </div>
    );
  }

  private handleChooseUser = (user: GroupUserModelType) => {
    return (e: React.MouseEvent<HTMLElement>) => {
      this.setState({selectedUserId: user.id});
    };
  };
}
