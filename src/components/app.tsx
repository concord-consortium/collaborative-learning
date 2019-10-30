import { inject, observer } from "mobx-react";
import * as React from "react";
import { authenticate } from "../lib/auth";
import { AppContentContainerComponent } from "./app-content";
import { BaseComponent, IBaseProps } from "./base";
import { urlParams } from "../utilities/url-params";
import { DemoCreatorComponment } from "./demo/demo-creator";

import { GroupChooserComponent } from "./group/group-chooser";
import { IStores } from "../models/stores/stores";
import { isDifferentUnitAndProblem, setUnitAndProblem } from "../models/curriculum/unit";
import { updateProblem } from "../lib/misc";
import "./app.sass";

interface IProps extends IBaseProps {}
interface IState {
  qaCleared: boolean;
  qaClearError?: string;
}

function initRollbar(stores: IStores, problemId: string) {
  const {user, problem, unit, appVersion} = stores;
  if (typeof (window as any).Rollbar !== "undefined") {
    const _Rollbar = (window as any).Rollbar;
    if (_Rollbar.configure) {
      const config = { payload: {
              class: user.classHash,
              offering: user.offeringId,
              person: { id: user.id },
              problemId: problemId || "",
              problem: stores.problem.title,
              role: user.type,
              unit: unit.title,
              version: appVersion
            }};
      _Rollbar.configure(config);
    }
  }
}

function resolveAppMode(
  stores: IStores,
  rawFirebaseJWT: string | undefined,
  onQAClear?: (result: boolean, err?: string) => void) {
  const { appMode, db, ui} = stores;
  if (appMode === "authed")  {
    if (rawFirebaseJWT) {
      db.connect({appMode, stores, rawFirebaseJWT}).catch(ui.setError);
    }
    else {
      ui.setError("No firebase token available to connect to db!");
    }
  }
  else {
    db.connect({appMode, stores})
      .then(() => {
        if (appMode === "qa") {
          const {qaClear, qaGroup} = urlParams;
          if (qaClear) {
            const cleared = (err?: string) => {
              if (onQAClear) {
                onQAClear(!err, err);
              }
            };
            db.clear(qaClear)
              .then(() => cleared())
              .catch(cleared);
          }
          else if (qaGroup) {
            db.leaveGroup().then(() => db.joinGroup(qaGroup));
          }
        }
      })
      .catch(ui.setError);
  }
}

export const authAndConnect = (stores: IStores, onQAClear?: (result: boolean, err?: string) => void) => {
  const {appConfig, appMode, user, ui} = stores;

  authenticate(appMode, appConfig, urlParams)
    .then(({authenticatedUser, classInfo, problemId, unitCode}) => {
      user.setAuthenticatedUser(authenticatedUser);
      if (classInfo) {
        stores.class.updateFromPortal(classInfo);
      }
      if (unitCode && problemId && isDifferentUnitAndProblem(stores, unitCode, problemId)) {
        setUnitAndProblem(stores, unitCode, problemId).then( () => {
          updateProblem(stores, problemId);
        });
      }
      initRollbar(stores, problemId || stores.appConfig.defaultProblemOrdinal);
      resolveAppMode(stores, authenticatedUser.rawFirebaseJWT, onQAClear);
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
export class AppComponent extends BaseComponent<IProps, IState> {

  public state: IState = {
    qaCleared: false,
    qaClearError: undefined
  };

  public UNSAFE_componentWillMount() {
    authAndConnect(this.stores, (qaCleared, qaClearError) => {
      this.setState({qaCleared, qaClearError});
    });
  }

  public componentWillUnmount() {
    this.stores.db.disconnect();
  }

  public render() {
    const {user, ui, db, groups} = this.stores;

    if (ui.showDemoCreator) {
      return this.renderApp(<DemoCreatorComponment />);
    }

    if (ui.error) {
      return this.renderApp(this.renderError(ui.error));
    }

    if (!user.authenticated || !db.listeners.isListening) {
      return this.renderApp(this.renderLoading());
    }

    if (urlParams.qaClear) {
      const {qaCleared, qaClearError} = this.state;
      return this.renderApp(
        <span className="qa-clear">
          {qaCleared ? `QA Cleared: ${qaClearError || "OK"}` : "QA Clearing..."}
        </span>
      );
    }

    if (user.isStudent && !groups.groupForUser(user.id)) {
      return this.renderApp(<GroupChooserComponent />);
    }

    return this.renderApp(<AppContentContainerComponent />);
  }

  private renderApp(children: JSX.Element | JSX.Element[]) {
    return (
      <div className="app">
        {children}
      </div>
    );
  }

  private renderLoading() {
    const { appConfig: { appName } } = this.stores;
    return (
      <div className="progress">
        Loading {appName} ...
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
