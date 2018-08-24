import { inject, observer } from "mobx-react";
import * as React from "react";
import { ProblemModelType } from "../models/problem";
import { UserModelType } from "../models/user";
import { AllStores } from "./app";

import "./header.sass";

interface Props {
}

interface InjectedProps {
  user: UserModelType;
  problem: ProblemModelType;
}

@inject((allStores: AllStores) => {
  return {
    user: allStores.user,
    problem: allStores.problem,
  } as InjectedProps;
})
@observer
export class HeaderComponent extends React.Component<Props, {}> {

  get injected() {
    return this.props as InjectedProps;
  }

  public render() {
    const {user, problem} = this.injected;

    return (
      <div className="header">Collaborative Learning Environment: {user.name} / {problem.name} </div>
    );
  }
}
