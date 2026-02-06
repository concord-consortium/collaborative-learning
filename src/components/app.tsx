import { inject, observer } from "mobx-react";
import React from "react";
import { authenticate } from "../lib/auth";
import { syncTeacherClassesAndOfferings } from "../lib/teacher-network";
import { AppContentContainerComponent } from "./app-content";
import { BaseComponent, IBaseProps } from "./base";
import { urlParams } from "../utilities/url-params";
import { DemoCreatorComponent } from "./demo/demo-creator";

import { GroupManagementModal } from "./group/group-management-modal";
import { IStores } from "../models/stores/stores";
import ErrorAlert from "./utilities/error-alert";
import { getCurrentLoadingMessage, removeLoadingMessage, showLoadingMessage } from "../utilities/loading-utils";

// used for tooltips in various parts of the application
import "react-tippy/dist/tippy.css";
import "./app.scss";

interface IProps extends IBaseProps {}

function resolveAppMode(
  stores: IStores,
  rawFirebaseJWT: string | undefined
) {
  const { appMode, db, ui, user} = stores;
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
        // Only students can be part of groups
        if (appMode === "qa" && user.isStudent) {
          const {qaGroup} = urlParams;
          if (qaGroup) {
            db.leaveGroup().then(() => db.joinGroup(qaGroup));
          }
        }
      })
      .catch(error => {
        return ui.setError(error);
      });
  }
}

export const authAndConnect = async (stores: IStores) => {
  const {appConfig, appMode, curriculumConfig, db, portal, user, ui} = stores;
  let rawPortalJWT: string | undefined;

  showLoadingMessage("Connecting");

  try {
    const {appMode: newAppMode, authenticatedUser, classInfo, problemId, unitCode} =
      await authenticate(appMode, appConfig, curriculumConfig, portal, urlParams, user);

    // authentication can trigger appMode change (e.g. preview => demo)
    if (newAppMode && (newAppMode !== appMode)) {
      stores.setAppMode(newAppMode);
    }
    user.setAuthenticatedUser(authenticatedUser);
    rawPortalJWT = authenticatedUser.rawPortalJWT;

    // If the URL has a unit param or if the appMode is not "authed", then
    // `stores.loadUnitAndProblem` would have been called in initializeApp,
    // and startedLoadingUnitAndProblem will be true.
    //
    // In the case of a teacher launch from the portal, the window.location should
    // not have a unit param. Instead the unit and problem is figured out by
    // `authenticate` from the portal's resource information.
    //
    // Note: If the external report in the portal is misconfigured with a unit
    // parameter, then window.location will have a unit param and the resource
    // information will be incorrectly ignored here.
    if (!stores.startedLoadingUnitAndProblem) {
      // The unit and problem are required for portal resources so the behavior
      // is more clear:
      // - If the unit is optional for portal resources, then a student launch
      // without a unit would not start loading the unit in initializeApp.
      // - If the problem is optional, then the defaultProblemOrdinal might not
      // exist in the specified unit.
      // We don't enforce this requirement in initializeApp because during a
      // teacher launch, we don't know the resource info.
      //
      // To test this you can make a CLUE resource in the portal that does not have
      // a unit param. And then launch it
      if (!unitCode || !problemId) {
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

    // We don't want to connect to the database while we are authenticating the user in standalone mode.
    // Once that finishes user.standaloneAuth will be undefined and this function will be called
    // again to connect to the database
    if (user.standaloneAuth) {
      removeLoadingMessage("Connecting");
      return;
    }

    await resolveAppMode(stores, authenticatedUser.rawFirebaseJWT);

    if (classInfo) {
      const timeOffset = await db.firebase.getServerTimeOffset();
      classInfo.serverTimestamp = classInfo.localTimestamp + timeOffset;
      const includeAIUser = appConfig.aiEvaluation !== undefined;
      stores.class.updateFromPortal(classInfo, includeAIUser);
    }

    // RESEARCHER-ACCESS: should this be changed to isTeacherOrResearcher?
    const firestoreUser = user.isTeacher
              ? await db.firestore.getFirestoreUser(user.id)
              : undefined;
    if (firestoreUser?.network) {
      user.setNetworks(firestoreUser.network, firestoreUser.networks);
    }
    syncTeacherClassesAndOfferings(db.firestore, user, stores.class, rawPortalJWT);

    removeLoadingMessage("Connecting");
  } catch(error) {
    let customMessage = undefined;
    const errorMessage = String(error);
    if ((errorMessage.indexOf("Cannot find AccessGrant") !== -1) ||
        (errorMessage.indexOf("AccessGrant has expired") !== -1)) {
      customMessage = "Your authorization has expired. Please return to the Concord site to re-run the activity.";
    }

    ui.setError(error, customMessage);
  }
};

const checkStandaloneUnitParam = ({ui}: IStores) => {
  if (!ui.standalone || urlParams.unit) {
    return true;
  }

  const error = new Error("Using CLUE in Standalone Mode requires a unit.");
  ui.setError(error, undefined, () => {
    return (
      <div>
        <p>
          Using CLUE in Standalone Mode requires a unit. Please adjust your URL and try again.
        </p>
        <p>
          Need assistance? Contact us at <a href="mailto:help@concord.org">help@concord.org</a>.
        </p>
      </div>
    );
  });
  return false;
};

@inject("stores")
@observer
export class AppComponent extends BaseComponent<IProps> {

  constructor(props: IProps) {
    super(props);

    if (checkStandaloneUnitParam(this.stores)) {
      authAndConnect(this.stores);
    }
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
      return this.renderApp(this.renderError(ui.errorContent ?? ui.error));
    }

    // if we're in standalone mode and the user is not authenticated
    // then we need to show the "Get Started" button
    if (ui.standalone && user.standaloneAuth) {
      return this.renderApp(<AppContentContainerComponent />);
    }

    // `db.listeners.isListening` is often the slowest requirement to be true.
    // This requirement could be dropped, but several components would
    // have to be checked to make sure they render something reasonable
    // in this case.
    if (!user.authenticated || !db.listeners.isListening) {
      return this.renderApp(this.renderLoading());
    }

    if (user.isStudent) {
      if (!user.currentGroupId) {
        if (appConfig.autoAssignStudentsToIndividualGroups || this.stores.portal.isPortalPreview) {
          // use userId as groupId
          db.joinGroup(user.id);
        }
        else {
          return this.renderApp(
            <GroupManagementModal
              allowCancel={false}
              isOpen={true}
              mode="student"
              onClose={() => {
                // No-op: modal closes automatically after successful save.
                // Cancel is disabled for first-time join.
              }}
            />
          );
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

  private renderError(error: string | React.FC<any>) {
    const showButton = !this.stores.ui.errorContent;

    return (
      <div className="error">
        <ErrorAlert
          content={error}
          canCancel={false}
          buttonLabel={showButton ? "Proceed" : undefined}
          onClick={showButton ? this.handlePortalLoginRedirect : undefined}
        />
      </div>
    );
  }

  private handlePortalLoginRedirect = () => {
    window.location.href = urlParams.domain || "https://learn.concord.org";
  };
}
