import { inject, observer } from "mobx-react";
import * as React from "react";
import { IStores } from "../models/stores";
import { authenticate } from "../lib/auth";
import { AppContainerComponent } from "./app-container";

import "./app.sass";

interface IProps {
  stores?: IStores;
}

@inject("stores")
@observer
export class AppComponent extends React.Component<IProps, {}> {

  get stores() {
    return this.props.stores as IStores;
  }

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
