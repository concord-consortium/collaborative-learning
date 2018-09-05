import { inject, observer } from "mobx-react";
import * as React from "react";
import { authenticate } from "../lib/auth";
import { AppContainerComponent } from "./app-container";
import { BaseComponent, IBaseProps } from "./base";
import { urlParams } from "../utilities/url-params";

import "./app.sass";
import { GroupChooserComponent } from "./group-chooser";
import { ModelDBConnector } from "../lib/model-db-connector";
import { observable } from "mobx";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class AppComponent extends BaseComponent<IProps, {}> {
  private modelDbConnector: ModelDBConnector | null;
  @observable private synced = false;

  public componentWillMount() {
    const {appMode, user, db, ui} = this.stores;

    authenticate(appMode, urlParams.token, urlParams.domain)
      .then((authenticatedUser) => {
        user.setAuthenticatedUser(authenticatedUser);

        if (appMode === "authed")  {
          if (authenticatedUser.rawFirebaseJWT) {
            db.connect({appMode, rawFirebaseToken: authenticatedUser.rawFirebaseJWT})
              .then(this.handleStartModelListeners)
              .catch(ui.setError);
          }
          else {
            ui.setError("No firebase token available to connect to db!");
          }
        }
        else {
          db.connect({appMode})
            .then(this.handleStartModelListeners)
            .catch(ui.setError);
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
  }

  public componentWillUnmount() {
    if (this.modelDbConnector) {
      this.modelDbConnector.stopListeners();
    }
  }

  public render() {
    const {user, ui} = this.stores;

    if (ui.error) {
      return this.renderApp(this.renderError(ui.error));
    }

    if (!user.authenticated || !this.synced) {
      return this.renderApp(this.renderAuthenticating());
    }

    if (!user.group) {
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

  private renderAuthenticating() {
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

  private setSynced = () => {
    this.synced = true;
  }

  private handleStartModelListeners = () => {
    this.modelDbConnector = new ModelDBConnector(this.stores, this.setSynced);
    this.modelDbConnector.startListeners();
  }
}
