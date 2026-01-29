import React from "react";
import { inject, observer } from "mobx-react";
import { BaseComponent, IBaseProps } from "../base";
import { GroupModelType } from "../../models/stores/groups";
import { removeLoadingMessage, showLoadingMessage } from "../../utilities/loading-utils";
import { translate } from "../../utilities/translation/translate";

import "./group-chooser.scss";

const MAX_GROUPS = 99;

interface IProps extends IBaseProps {}

interface IState {
  error?: string;
}

@inject("stores")
@observer
export class GroupChooserComponent extends BaseComponent<IProps, IState> {
  public state: IState = {};
  private groupSelect: HTMLSelectElement|null;
  private _isMounted: boolean;

  private loadingMessageKey = "";

  constructor(props: IProps) {
    super(props);
  }

  public componentDidMount() {
    this._isMounted = true;
    const groupTermLower = translate("studentGroup").toLowerCase();
    this.loadingMessageKey = `Joining ${groupTermLower}`;
    showLoadingMessage(this.loadingMessageKey);
  }

  public componentWillUnmount() {
    this._isMounted = false;
    removeLoadingMessage(this.loadingMessageKey);
  }

  public render() {
    const {user, groups} = this.stores;
    return (
      <div className="join" data-testid="group-select">
        <div className="join-title">Join {translate("studentGroup")}</div>
        <div className="join-content">
          {user ? <div className="welcome">Welcome {user.name}</div> : null}
          {groups.allGroups.length > 0 && this.renderChooseExistingGroup()}
          {this.renderChooseNewGroup()}
          {this.renderError()}
        </div>
      </div>
    );
  }

  private renderChooseNewGroup() {
    const {allGroups} = this.stores.groups;
    const groupTerm = translate("studentGroup");
    const groupTermLower = groupTerm.toLowerCase();
    const groupIds = allGroups.map((group) => group.id);
    const items: JSX.Element[] = [];
    const haveExistingGroups = groupIds.length > 0;
    for (let i = 1; i <= MAX_GROUPS; i++) {
      if (groupIds.indexOf(`${i}`) === -1) {
        items.push(<option value={i} key={i}>{groupTerm} {i}</option>);
      }
    }
    return (
      <form className="create-group" onSubmit={this.handleChooseGroup} data-testid="create-group-form">
        <div>{haveExistingGroups ? `Or create a new ${groupTermLower}` : `Please create your ${groupTermLower}`}</div>
        <div>
          <select ref={(el) => this.groupSelect = el} data-testid="new-group-select">{items}</select>
          <input type="submit" className="button" value={`Create ${groupTerm}`} data-testid="create-group-button" />
        </div>
      </form>
    );
  }

  private renderChooseExistingGroup() {
    const {groups} = this.stores;
    const groupTerm = translate("studentGroup");
    const groupTermLower = groupTerm.toLowerCase();
    const groupElements = groups.allGroups.map((group) => {
      const users = group.activeUsers.map((user) => {
        const className = `user ${user.connected ? "connected" : "disconnected"}`;
        const title = `${user.name}: ${user.connected ? "connected" : "disconnected"}`;
        return <span key={user.id} className={className} title={title}>{user.initials}</span>;
      });
      return (
        <div
          className="group"
          key={group.id}
          onClick={this.handleChooseExistingGroup(group)}
          data-testid={`existing-group-${group.id}`}
        >
          <div className="group-title">{`${groupTerm} ${group.id}`}</div>
          <div className="group-users">
            {users}
          </div>
        </div>
      );
    });

    return (
      <div className="groups" data-testid="existing-groups">
        <div>Click to select an existing {groupTermLower}</div>
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
  };

  private handleChooseExistingGroup = (group: GroupModelType) => {
    return (e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault();
      if (group.activeUsers.length >= 4) {
        const groupTermLower = translate("studentGroup").toLowerCase();
        this.setState({error: `Sorry, that ${groupTermLower} is full with four students`});
      }
      else {
        this.selectGroup(group.id);
      }
    };
  };

  private handleChooseGroup = (e: React.ChangeEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (this.groupSelect) {
      this.selectGroup(this.groupSelect.value);
    }
  };
}
