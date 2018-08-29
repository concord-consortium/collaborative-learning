import { inject, observer } from "mobx-react";
import * as React from "react";
import { IAllStores } from "../index";
import { authenticate } from "../lib/auth";
import { UserModelType } from "../models/user";
import { AppContainerComponent } from "./app-container";

import "./app.sass";

interface IInjectedProps {
  user: UserModelType;
  devMode: boolean;
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
    authenticate(this.injected.devMode).then((userName) => {
      if (userName) {
        const user = this.injected.user;
        user.setName(userName);
        user.setAuthentication(true);
      }
    });
  }

  public render() {
    if (!this.injected.user.authenticated) {
      return (
        <div className="app">
          <div className="progress">Authenticating ...</div>
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
