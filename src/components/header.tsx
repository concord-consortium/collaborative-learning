import { inject, observer } from "mobx-react";
import * as React from "react";
import { ProblemModelType } from "../models/problem";
import { UserModelType } from "../models/user";
import { IAllStores } from "./app";

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

    return (
      <div className="header">Collaborative Learning Environment: {user.name} / {problem.name} </div>
    );
  }
}
