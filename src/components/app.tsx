import { inject, observer } from "mobx-react";
import * as React from "react";
import { authenticate } from "../lib/auth";
import { AppContainerComponent } from "./app-container";
import { BaseComponent, IBaseProps } from "./base";

import "./app.sass";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class AppComponent extends BaseComponent<IProps, {}> {

  public componentWillMount() {
    authenticate(this.stores.devMode).then((authenticatedUser) => {
      if (authenticatedUser) {
        const user = this.stores.user;
        user.setName(authenticatedUser.fullName);
        user.setClassName(authenticatedUser.className);
        user.setAuthentication(true);
      }
    });
  }

  public render() {
    return (
      <div className="app">
        <AppContainerComponent />
      </div>
    );
  }
}
