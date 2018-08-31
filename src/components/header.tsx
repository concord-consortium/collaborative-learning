import { inject, observer } from "mobx-react";
import * as React from "react";
import { IStores } from "../models/stores";

import "./header.sass";

interface IProps {
  stores?: IStores;
}

@inject("stores")
@observer
export class HeaderComponent extends React.Component<IProps, {}> {

  get stores() {
    return this.props.stores as IStores;
  }

  public render() {
    const {user, problem} = this.stores;
    const subtitle = problem.subtitle ? `: ${problem.subtitle}` : "";
    const problemTitle = `${problem.title}${subtitle}`;

    return (
      <div className="header">
        <div className="info">
          <div>
            <div className="problem">{problemTitle}</div>
            <div className="class">{user.className}</div>
          </div>
        </div>
        <div className="group">
          <div>
            <div className="name">Group TBD</div>
            <div className="members">Members TBD</div>
          </div>
        </div>
        <div className="user">
          <div className="name">{user.name}</div>
        </div>
      </div>
    );
  }
}
