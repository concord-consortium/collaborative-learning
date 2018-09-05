import { inject, observer } from "mobx-react";
import * as React from "react";
import { authenticate } from "../lib/auth";
import { AppContainerComponent } from "./app-container";
import { BaseComponent, IBaseProps } from "./base";
import { urlParams } from "../utilities/url-params";

import "./app.sass";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class AppComponent extends BaseComponent<IProps, {}> {

  public componentWillMount() {
    const {appMode, user, db, ui} = this.stores;

    authenticate(appMode, urlParams.token, urlParams.domain)
      .then((authenticatedUser) => {
        user.setName(authenticatedUser.fullName);
        user.setClassName(authenticatedUser.className);
        user.setAuthenticated(true);

        if (appMode === "authed")  {
          if (authenticatedUser.rawFirebaseJWT) {
            db.connect({appMode, rawFirebaseToken: authenticatedUser.rawFirebaseJWT}).catch(ui.setError);
          }
          else {
            ui.setError("No firebase token available to connect to db!");
          }
        }
        else {
          db.connect({appMode}).catch(ui.setError);
        }
      })
      .catch((error) => {
        if ((error.indexOf("Cannot find AccessGrant") !== -1) || (error.indexOf("AccessGrant has expired") !== -1)) {
          error = "Your authorization has expired.  Please close this window and re-run the activity.";
        }
        ui.setError(error);
      });
  }

  public render() {
    const {user, ui} = this.stores;

    if (ui.error) {
      return this.renderApp(this.renderError(ui.error));
    }

    if (!user.authenticated) {
      return this.renderApp(this.renderAuthenticating());
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

  private renderAuthenticating() {
    return (
      <div className="progress">
        Authenticating ...
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
