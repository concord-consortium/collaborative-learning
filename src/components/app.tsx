import { inject, observer } from "mobx-react";
import React from "react";
import Modal from "react-modal";
import { ModalProvider } from "react-modal-hook";
import { QueryClient, QueryClientProvider } from "react-query";
import { authenticate } from "../lib/auth";
import { AppContentContainerComponent } from "./app-content";
import { BaseComponent, IBaseProps } from "./base";
import { urlParams } from "../utilities/url-params";
import { DemoCreatorComponent } from "./demo/demo-creator";

import { GroupChooserComponent } from "./group/group-chooser";
import { IStores, setAppMode, setUnitAndProblem } from "../models/stores/stores";
import { isDifferentUnitAndProblem } from "../models/curriculum/unit";
import { updateProblem } from "../lib/misc";
import ErrorAlert from "./utilities/error-alert";

import "./app.sass";

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

  authenticate(appMode, appConfig, urlParams)
    .then(({appMode: newAppMode, authenticatedUser, classInfo, problemId, unitCode}) => {
      // authentication can trigger appMode change (e.g. preview => demo)
      if (newAppMode && (newAppMode !== appMode)) {
        setAppMode(stores, newAppMode);
      }
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
      return resolveAppMode(stores, authenticatedUser.rawFirebaseJWT, onQAClear);
    })
    .then(() => {
      return user.isTeacher
              ? db.firestore.getFirestoreUser(user.id)
              : undefined;
    })
    .then(firestoreUser => {
      if (firestoreUser) {
        user.setNetworks(firestoreUser.network, firestoreUser.networks);
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

const queryClient = new QueryClient();

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

  public componentDidMount() {
    Modal.setAppElement(".app");
  }

  public componentWillUnmount() {
    this.stores.db.disconnect();
  }

  public render() {
    const {appConfig, user, ui, db, groups} = this.stores;

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

    const isPreviewing = urlParams.domain && urlParams.domain_uid && !urlParams.token;
    if (user.isStudent) {
      if (!groups.groupForUser(user.id)) {
        if (appConfig.autoAssignStudentsToIndividualGroups || isPreviewing) {
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
    // We use the ModalProvider from react-modal-hook to place modals at the top of
    // the React component tree to minimize the potential that events propagating
    // up the tree from modal dialogs will interact adversely with other content.
    // cf. https://github.com/reactjs/react-modal/issues/699#issuecomment-496685847
    return (
      <ModalProvider>
        <QueryClientProvider client={queryClient}>
          <div className="app">
            {children}
          </div>
        </QueryClientProvider>
      </ModalProvider>
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
  }
}
