import { inject, observer } from "mobx-react";
import * as React from "react";
import { ProblemModelType } from "../models/problem";
import { UserModelType } from "../models/user";
import { AppContainerComponent } from "./app-container";

import "./app.sass";

interface IInjectedProps {
  user: UserModelType;
  devMode: boolean;
}

// import this type into other components when using @inject
export interface IAllStores {
  devMode: boolean;
  user: UserModelType;
  problem: ProblemModelType;
}

@inject((allStores: IAllStores) => {
  const injected: IInjectedProps = {
    devMode: allStores.devMode,
    user: allStores.user,
  };
  return injected;
})
@observer
export class AppComponent extends React.Component<{}, {}> {

  get injected() {
    return this.props as IInjectedProps;
  }

  public componentWillMount() {
    if (!this.injected.user.authenticated) {
      // TODO: start user authentication here
      // NOTE: authenticated will always be true in developer mode so you may want
      // to check this.injected.devMode while developing this
    }
  }

  public render() {
    if (!this.injected.user.authenticated) {
      return (
        <div className="app">
          <div className="progress">Authenticating</div>
        </div>
      );
    }

    return (
      <div className="app">
        <AppContainerComponent />
      </div>
    );
  }
}
