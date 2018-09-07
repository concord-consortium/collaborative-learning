import { inject, observer } from "mobx-react";
import * as React from "react";
import { authenticate } from "../lib/auth";
import { AppContainerComponent } from "./app-container";
import { BaseComponent, IBaseProps } from "./base";
import { urlParams } from "../utilities/url-params";

import "./app.sass";
import { GroupChooserComponent } from "./group-chooser";
import { observable } from "mobx";
import { IStores } from "../models/stores";

interface IProps extends IBaseProps {}

export const authAndConnect = (stores: IStores) => {
  const {appMode, user, db, ui} = stores;

  authenticate(appMode, urlParams.token, urlParams.domain)
    .then(({authenticatedUser, classInfo}) => {
      user.setAuthenticatedUser(authenticatedUser);
      if (classInfo) {
        stores.class.updateFromPortal(classInfo);
      }

      if (appMode === "authed")  {
        const { rawFirebaseJWT } = authenticatedUser;
        if (rawFirebaseJWT) {
          db.connect({appMode, stores, rawFirebaseJWT}).catch(ui.setError);
        }
        else {
          ui.setError("No firebase token available to connect to db!");
        }
      }
      else {
        db.connect({appMode, stores}).catch(ui.setError);
      }
    })
    .catch((error) => {
      let errorMessage = error.toString();
      if ((errorMessage.indexOf("Cannot find AccessGrant") !== -1) ||
          (errorMessage.indexOf("AccessGrant has expired") !== -1)) {
        errorMessage = "Your authorization has expired.  Please close this window and re-run the activity.";
      }
      ui.setError(errorMessage);
    });
};

@inject("stores")
@observer
export class AppComponent extends BaseComponent<IProps, {}> {

  public componentWillMount() {
    authAndConnect(this.stores);
  }

  public componentWillUnmount() {
    this.stores.db.disconnect();
  }

  public render() {
    const {user, ui, db, groups} = this.stores;

    if (ui.error) {
      return this.renderApp(this.renderError(ui.error));
    }

    if (!user.authenticated || !db.isListening) {
      return this.renderApp(this.renderLoading());
    }

    if (!groups.groupForUser(user.id)) {
      return this.renderApp(<GroupChooserComponent />);
    }

    return this.renderApp(<AppContainerComponent />);
  }

  private renderApp(children: JSX.Element | JSX.Element[]) {
    return (
      <div className="app">
        {children}
      </div>
    );
  }

  private renderLoading() {
    return (
      <div className="progress">
        Loading CLUE ...
      </div>
    );
  }

  private renderError(error: string) {
    return (
      <div className="error">
        {error.toString()}
      </div>
    );
  }
}
