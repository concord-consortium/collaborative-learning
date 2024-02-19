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
import ErrorAlert from "./utilities/error-alert";
import { getCurrentLoadingMessage, removeLoadingMessage, showLoadingMessage } from "../utilities/loading-utils";

// used for tooltips in various parts of the application
import "react-tippy/dist/tippy.css";
import "./app.scss";

interface IProps extends IBaseProps {}
interface IState {
  qaCleared: boolean;
  qaClearError?: string;
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
      .catch(error => {
        return ui.setError(error);
      });
  }
}

export const authAndConnect = (stores: IStores, onQAClear?: (result: boolean, err?: string) => void) => {
  const {appConfig, appMode, db, user, ui} = stores;
  let rawPortalJWT: string | undefined;

  showLoadingMessage("Connecting");

  authenticate(appMode, appConfig, urlParams)
    .then(({appMode: newAppMode, authenticatedUser, classInfo, problemId, unitCode}) => {
      // authentication can trigger appMode change (e.g. preview => demo)
      if (newAppMode && (newAppMode !== appMode)) {
        stores.setAppMode(newAppMode);
      }
      user.setAuthenticatedUser(authenticatedUser);
      rawPortalJWT = authenticatedUser.rawPortalJWT;
      if (classInfo) {
        stores.class.updateFromPortal(classInfo);
      }

      // If the URL has a unit param, then stores.loadUnitAndProblem would have
      // been called in initializeApp, and startedLoadingUnitAndProblem will be
      // true.
      // In the case of a teacher launch from the portal the URL should not have
      // a unit param. Instead we figure out the unit and problem from the
      // portal's offering information.
      // Note: If the external report in the portal is misconfigured and includes
      // a unit parameter, then the offering information will be ignored.
      if (!stores.startedLoadingUnitAndProblem) {
        // TODO: It'd be better if we automatically computed the problemId as the first
        // problem of the unit. This way even without a problemId we wouldn't
        // error out here. This same logic could be used for both the problemId here and
        // the problemId passed at the beginning.  If we move the logic into
        // loadUnitAndProblem then we can just have problemId be undefined in that
        // case. However there are several places where `defaultProblemOrdinal` is used.
        // To make the code consistently handle URLs without a problem param we need to
        // update all of those places too.
        if (!unitCode || !problemId) {
          // To test this you can make a CLUE resource in the portal that does not have
          // a unit param. And then launch it

          // TODO: we should have a way to test this without actually launching from
          // the portal. This currently isn't easy to do without adding a lot of
          // complexity to the code.

          // If we get here, CLUE will hang because unitLoadedPromise will never
          // resolve so the listeners won't start and there will be no content
          // for CLUE to render. The error message below indicates the most likely
          // cause of this.
          stores.ui.setError(
            "This CLUE resource is incorrectly configured. The URL of the resource " +
            "requires a unit and problem parameter. " +
            "Contact the author of the resource to fix it. " +
            `unitCode: ${unitCode}, problemId: ${problemId}`);
        } else {
          // loadUnitAndProblem is asynchronous.
          // Code that requires the unit to be loaded should wait on `stores.unitLoadedPromise`
          stores.loadUnitAndProblem(unitCode, problemId);
        }
      }
      return resolveAppMode(stores, authenticatedUser.rawFirebaseJWT, onQAClear);
    })
    .then(() => {
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
    .then(() => {
      removeLoadingMessage("Connecting");
    })
    .catch((error) => {
      let customMessage = undefined;
      const errorMessage = error.toString();
      if ((errorMessage.indexOf("Cannot find AccessGrant") !== -1) ||
          (errorMessage.indexOf("AccessGrant has expired") !== -1)) {
        customMessage = "Your authorization has expired. Please return to the Concord site to re-run the activity.";
      }

      ui.setError(error, customMessage);
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

    // `db.listeners.isListening` is often the slowest requirement to be true.
    // This requirement could be dropped, but several components would
    // have to be checked to make sure they render something reasonable
    // in this case.
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
    return (
      // Shouldn't be any actual danger since we're only copying text from localStorage
      // eslint-disable-next-line react/no-danger
      <div id="loading-message" className="progress" dangerouslySetInnerHTML={{__html: getCurrentLoadingMessage()}}>
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
