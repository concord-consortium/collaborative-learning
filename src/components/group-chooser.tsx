import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "./base";

import "./group-chooser.sass";

const MAX_GROUPS = 99;

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class GroupChooserComponent extends BaseComponent<IProps, {}> {
  public render() {
    const user = this.stores.user;
    return (
      <div className="join">
        <div className="join-title">Join Group</div>
        <div className="join-content">
          {user ? <div className="welcome">Welcome {user.name}</div> : null}
          {this.renderChooseNewGroup([])}
          {this.renderChooseExistingGroup()}
        </div>
      </div>
    );
  }

  private selectGroup = (key: string) => {
    this.stores.user.setGroup(key);
  }

  private handleChooseGroup = (e: React.ChangeEvent<HTMLFormElement>) => {
    e.preventDefault();
    const select = e.currentTarget.querySelector("select");
    if (select) {
      this.selectGroup(select.value);
    }
  }

  private renderChooseNewGroup(groupKeys: string[]) {
    const items: JSX.Element[] = [];
    const haveExistingGroups = groupKeys.length > 0;
    for (let i = 1; i <= MAX_GROUPS; i++) {
      if (groupKeys.indexOf(`${i}`) === -1) {
        items.push(<option value={i} key={i}>Group {i}</option>);
      }
    }
    return (
      <form className="create-group" onSubmit={this.handleChooseGroup}>
        <div>{haveExistingGroups ? "Or create a new group" : "Please create your group"}</div>
        <div>
          <select>{items}</select>
          <input type="submit" className="button" value="Create Group" />
        </div>
      </form>
    );
  }

  private chooseExistingGroup = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    const title = (e.target as HTMLElement).firstChild;
    this.selectGroup(title && title.textContent ? title.textContent : "");
  }

  private renderChooseExistingGroup() {
    const groups: {[key: string]: string[]} = {
      "Group 1": ["EK", "AB"],
      "Group 2": ["CD"]
    };
    const groupElements: JSX.Element[] = [];
    Object.keys(groups).forEach((key) => {
      const users = groups[key];
      groupElements.push(
        <div className="group" key={key} onClick={this.chooseExistingGroup}>
          <div className="group-title">{key}</div>
          {
            users.map((initials, i) => (
              <span key={i} className="user">
                {initials}
              </span>
            ))
          }
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
}
