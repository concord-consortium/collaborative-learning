import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "../base";
import { GroupUsersMap } from "../../lib/db";

import "./group-chooser.sass";
import { GroupModelType } from "../../models/stores/groups";

const MAX_GROUPS = 99;

interface IProps extends IBaseProps {
  iotValues: {[deviceId: string]: number};
}

interface IState {
  error?: string;
}

@inject("stores")
@observer
export class GroupChooserComponent extends BaseComponent<IProps, IState> {
  public state: IState = {};
  private groupSelect: HTMLSelectElement|null;
  private _isMounted: boolean;

  public componentDidMount() {
    this._isMounted = true;
  }

  public componentWillUnmount() {
    this._isMounted = false;
  }

  public render() {
    const {db, user, groups} = this.stores;
    return (
      <div className="join">
        <div className="join-title">Sensor Values</div>
        <div className="join-content">
          {Object.keys(this.props.iotValues).map(deviceName => {
            return this.renderDevice(deviceName, this.props.iotValues[deviceName]);
          })}
        </div>
      </div>
    );
  }

  private renderDevice(deviceName: string, value: number) {
    return (
      <div key={deviceName}>
        {`${deviceName}: ${value}`}
      </div>
    );
  }

  private renderChooseNewGroup() {
    const {allGroups} = this.stores.groups;
    const groupIds = allGroups.map((group) => group.id);
    const items: JSX.Element[] = [];
    const haveExistingGroups = groupIds.length > 0;
    for (let i = 1; i <= MAX_GROUPS; i++) {
      if (groupIds.indexOf(`${i}`) === -1) {
        items.push(<option value={i} key={i}>Group {i}</option>);
      }
    }
    return (
      <form className="create-group" onSubmit={this.handleChooseGroup}>
        <div>{haveExistingGroups ? "Or create a new group" : "Please create your group"}</div>
        <div>
          <select ref={(el) => this.groupSelect = el}>{items}</select>
          <input type="submit" className="button" value="Create Group" />
        </div>
      </form>
    );
  }

  private renderChooseExistingGroup() {
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
          onClick={this.handleChooseExistingGroup(group)}
        >
          <div className="group-title">{`Group ${group.id}`}</div>
          <div className="group-users">
            {users}
          </div>
        </div>
      );
    });

    return (
      <div className="groups">
        <div>Click to select an existing group</div>
        <div className="group-list">
          {groupElements}
        </div>
      </div>
    );
  }

  private renderError() {
    const {error} = this.state;
    if (error) {
      return (
        <div className="error">{error}</div>
      );
    }
  }

  private selectGroup = (groupId: string) => {
    this.stores.db.joinGroup(groupId)
      .then(() => { if (this._isMounted) this.setState({error: undefined}); })
      .catch((err) => { if (this._isMounted) this.setState({error: err.toString()}); });
  }

  private handleChooseExistingGroup = (group: GroupModelType) => {
    return (e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault();
      if (group.users.length >= 4) {
        this.setState({error: "Sorry, that group is full with four students"});
      }
      else {
        this.selectGroup(group.id);
      }
    };
  }

  private handleChooseGroup = (e: React.ChangeEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (this.groupSelect) {
      this.selectGroup(this.groupSelect.value);
    }
  }
}
