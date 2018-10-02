import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "./base";
import { GroupModelType, GroupUserModelType } from "../models/groups";

import "./teacher-student-tab.sass";

interface IProps extends IBaseProps {
  group?: GroupModelType;
}

interface IState {
  selectedUser?: GroupUserModelType;
}

@inject("stores")
@observer
export class TeacherStudentTabComponent extends BaseComponent<IProps, IState> {
  public state: IState = {};

  public componentWillReceiveProps(nextProps: IProps) {
    if (nextProps.group !== this.props.group) {
      this.setState({selectedUser: undefined});
    }
  }

  public render() {
    const { group } = this.props;
    const { selectedUser } = this.state;
    // TODO: if no group prop then get list of all users in class
    const users = group ? group.users : [];
    return (
      <div className="teacher-student-tab">
        {this.renderUsers(users)}
        {selectedUser ? this.renderUser(selectedUser) : null}
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
          : (this.props.group
              ? "No students found."
              : "TDB: Student List (same as group student list but shows all students)")}
      </div>
    );
  }

  private renderUser(user: GroupUserModelType) {
    return (
      <div className="selected-group">
        <div className="title">
          <div className="info">
            {user.name}
          </div>
        </div>
        <div className="content">
          TDB: Show student section documents and learning log thumbnails
          with each thumbnail linked to show it in a canvas under the list.
        </div>
      </div>
    );
  }

  private handleChooseUser = (user: GroupUserModelType) => {
    return (e: React.MouseEvent<HTMLElement>) => {
      this.setState({selectedUser: user});
    };
  }
}
