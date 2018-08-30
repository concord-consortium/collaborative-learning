import { inject, observer } from "mobx-react";
import * as React from "react";
import { IAllStores } from "../index";
import { ProblemModelType } from "../models/problem";
import { UserModelType } from "../models/user";

import "./header.sass";

interface IInjectedProps {
  user: UserModelType;
  problem: ProblemModelType;
}

@inject((allStores: IAllStores) => {
  const injected: IInjectedProps = {
    problem: allStores.problem,
    user: allStores.user,
  };
  return injected;
})
@observer
export class HeaderComponent extends React.Component<{}, {}> {

  get injected() {
    return this.props as IInjectedProps;
  }

  public render() {
    const {user, problem} = this.injected;
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
