import { inject, observer } from "mobx-react";
import React from "react";
import { authenticate } from "../lib/auth";
import { syncTeacherClassesAndOfferings } from "../lib/teacher-network";
import { AppContentContainerComponent } from "./app-content";
import { BaseComponent, IBaseProps } from "./base";
import { urlParams } from "../utilities/url-params";
import { DemoCreatorComponent } from "./demo/demo-creator";

import { GroupChooserComponent } from "./group/group-chooser";
import { IStores } from "../models/stores/stores";
import { isDifferentUnitAndProblem } from "../models/curriculum/unit";
import { updateProblem } from "../lib/misc";
import ErrorAlert from "./utilities/error-alert";

// used for tooltips in various parts of the application
import "react-tippy/dist/tippy.css";
import "./app.scss";

interface IProps extends IBaseProps {}
interface IState {
  qaCleared: boolean;
  qaClearError?: string;
}

function initRollbar(stores: IStores, problemId: string) {
  const {user, unit, appVersion} = stores;
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
      return db.connect({appMode, stores, rawFirebaseJWT}).catch(error => ui.setError(error));
    }
    else {
      ui.setError("No firebase token available to connect to db!");
    }
  }
  else {
    return db.connect({appMode, stores})
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
      .catch(error => ui.setError(error));
  }
}

export const authAndConnect = (stores: IStores, onQAClear?: (result: boolean, err?: string) => void) => {
  const {appConfig, appMode, db, user, ui} = stores;
  let rawPortalJWT: string | undefined;

  authenticate(appMode, appConfig, urlParams)
    .then(async ({appMode: newAppMode, authenticatedUser, classInfo, problemId, unitCode}) => {
      // authentication can trigger appMode change (e.g. preview => demo)
      if (newAppMode && (newAppMode !== appMode)) {
        stores.setAppMode(newAppMode);
      }
      user.setAuthenticatedUser(authenticatedUser);
      rawPortalJWT = authenticatedUser.rawPortalJWT;
      if (classInfo) {
        stores.class.updateFromPortal(classInfo);
      }
      if (unitCode && problemId && isDifferentUnitAndProblem(stores, unitCode, problemId)) {
        await stores.setUnitAndProblem(unitCode, problemId).then( () => {
          updateProblem(stores, problemId);
        });
      }
      initRollbar(stores, problemId || stores.appConfig.defaultProblemOrdinal);
      return resolveAppMode(stores, authenticatedUser.rawFirebaseJWT, onQAClear);
    })
    .then(() => {
      stores.persistentUI.initializePersistentUISync(user, db);
      return user.isTeacher
              ? db.firestore.getFirestoreUser(user.id)
              : undefined;
    })
    .then(firestoreUser => {
      if (firestoreUser?.network) {
        user.setNetworks(firestoreUser.network, firestoreUser.networks);

        if (rawPortalJWT) {
          syncTeacherClassesAndOfferings(db.firestore, user, rawPortalJWT);
        }
      }
    })
    .catch((error) => {
      let errorMessage = error.toString();
      if ((errorMessage.indexOf("Cannot find AccessGrant") !== -1) ||
          (errorMessage.indexOf("AccessGrant has expired") !== -1)) {
        errorMessage = "Your authorization has expired. Please return to the Concord site to re-run the activity.";
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

  constructor(props: IProps) {
    super(props);

    authAndConnect(this.stores, (qaCleared, qaClearError) => {
      this.setState({qaCleared, qaClearError});
    });
  }

  public componentWillUnmount() {
    this.stores.db.disconnect();
  }

  // TODO: it would be cleaner for render to
  // just be:
  // <div className="app">
  //   {renderContents}
  // </div>
  //
  // And then renderContents is basically the
  // render method below but it just returns
  // the results instead of calling renderApp each
  // time.

  public render() {
    const {appConfig, user, ui, db} = this.stores;

    if (ui.showDemoCreator) {
      return this.renderApp(<DemoCreatorComponent />);
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

    if (user.isStudent) {
      if (!user.currentGroupId) {
        if (appConfig.autoAssignStudentsToIndividualGroups || this.stores.isPreviewing) {
          // use userId as groupId
          db.joinGroup(user.id);
        }
        else {
          return this.renderApp(<GroupChooserComponent />);
        }
      }
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
        <ErrorAlert
          content={error}
          canCancel={false}
          buttonLabel="Proceed"
          onClick={this.handlePortalLoginRedirect}
        />
      </div>
    );
  }

  private handlePortalLoginRedirect = () => {
    window.location.href = urlParams.domain || "https://learn.concord.org";
  };
}
