import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "./base";

import "./header.sass";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class HeaderComponent extends BaseComponent<IProps, {}> {

  public render() {
    const {user, problem} = this.stores;

    return (
      <div className="header">
        <div className="info">
          <div>
            <div className="problem">{problem.fullTitle}</div>
            <div className="class">{user.className}</div>
          </div>
        </div>
        <div className="group">
          <div>
            <div onClick={this.handleResetGroup} className="name">{`Group ${user.group}`}</div>
            <div className="members">Members TBD</div>
          </div>
        </div>
        <div className="user">
          <div className="name">{user.name}</div>
        </div>
      </div>
    );
  }

  private handleResetGroup = () => {
    if (confirm("Do you want to change groups?")) {
      this.stores.user.setGroup(null);
    }
  }
}
