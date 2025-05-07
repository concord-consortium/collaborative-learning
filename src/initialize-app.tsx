import "ts-polyfill";

import React, { useEffect } from "react";
import { Provider } from "mobx-react";
import { setLivelinessChecking } from "mobx-state-tree";
import Modal from "react-modal";
import { ModalProvider } from "@concord-consortium/react-modal-hook";
import { QueryClient, QueryClientProvider } from "react-query";

import { AppMode } from "./models/stores/store-types";
import { appConfigSnapshot, appIcons, createStores } from "./app-config";
import { AppConfigContext } from "./app-config-context";
import { AppConfigModel } from "./models/stores/app-config-model";
import { IStores } from "./models/stores/stores";
import { IStandaloneAuth, UserModel } from "./models/stores/user";
import { urlParams } from "./utilities/url-params";
import { getBearerToken } from "./utilities/auth-utils";
import { getAppMode } from "./lib/auth";
import { DEBUG_STORES } from "./lib/debug";
import { gImageMap } from "./models/image-map";
import PackageJson from "./../package.json";

import "./index.scss";

// set to true to enable MST liveliness checking
const kEnableLivelinessChecking = false;

/**
 * This function is used by the 3 different entry points supported
 * by CLUE:
 * - runtime (index.tsx)
 * - authoring (cms/document-editor.tsx)
 * - standalone doc editor (doc-editor.tsx)
 *
 * It is intended to only be called one time.
 * It is basically an async wrapper around createStores
 *
 * @param appMode
 * @returns
 */
type IInitializeAppOptions = {authoring?: boolean, standalone?: boolean, authDomain?: string};
export const initializeApp = ({authoring, standalone, authDomain}: IInitializeAppOptions = {}): IStores => {
  const appVersion = PackageJson.version;
  const bearerToken = getBearerToken(urlParams);

  const user = UserModel.create();

  let appMode: AppMode;
  let showDemoCreator = false;
  let standaloneAuth: IStandaloneAuth = standalone ? {state: "waiting"} : undefined;
  if (authoring) {
    // Support appMode=qa even when authoring so we can test some features that only show
    // up in the qa appMode
    appMode = urlParams.appMode === "qa" ? "qa" : "dev";
  } else {
    const host = window.location.host.split(":")[0];
    appMode = getAppMode(urlParams.appMode, bearerToken, host);

    // if we are waiting for a standalone auth, we need to set the appMode back to dev
    // and update the standaloneAuth state
    if (appMode === "authed" && standalone) {
      appMode = "dev";

      // when launched from the portal the authDomain is the "domain" query param
      // so fall back to that if the authDomain is not set in the hash parameters
      // checked in auth-utils.ts#initializeAuthorization and passed to this function
      authDomain = authDomain ?? urlParams.domain;

      if (bearerToken && authDomain) {
        standaloneAuth = {state: "haveBearerToken", bearerToken, authDomain};
      } else if (!bearerToken){
        standaloneAuth = {state: "error", message: "No bearer token found in URL"};
      } else {
        standaloneAuth = {state: "error", message: "No authDomain provided"};
      }
    }

    user.setStandaloneAuth(standaloneAuth);

    showDemoCreator = !!urlParams.demo;
    if (showDemoCreator) {
      // Override the app mode when the demo creator is being used.
      // `authenticate` is still called when the demo creator is shown
      // and with an undefined appMode then it will default to `authed` on
      // a remote host. This will cause an error as it looks for a token.
      // This error was always happening but for some reason before the app
      // was still rendering, and now it doesn't.
      appMode = "demo";
    }
  }
  const demoName = urlParams.demoName;

  const appConfig = AppConfigModel.create(appConfigSnapshot);
  const stores = createStores(
    { appMode, appVersion, appConfig, user, showDemoCreator, demoName,
      documentToDisplay: urlParams.studentDocument, documentHistoryId: urlParams.studentDocumentHistoryId });

  if (standalone) {
    stores.ui.setStandalone(true);
  }

  // Expose the stores if the debug flag is set or we are running in Cypress
  const aWindow = window as any;

  // The Cypress docs say you can just check window.Cypress but after a page reload in
  // some cases you have to use window.parent.Cypress
  let inCypress = false;
  try {
    inCypress = aWindow.Cypress || aWindow.parent?.Cypress;
  } catch (e) {
    // If we are running in a cross origin iframe this will throw an exception
  }

  if (DEBUG_STORES || inCypress) {
    aWindow.stores = stores;
  }


  // Only load the unit here if we are not authed, or we are authed and have a unit and problem param.
  // If we are authed with a unit and problem param we can go ahead and start the process of loading
  // the unit. If we are authed without a unit and problem params, the unit will be figured out later
  // from the information returned by the portal.
  //
  // TODO: A better approach would be to never use a default unit or problems.
  // Then this check could ignore the appMode. This approach isn't implemented
  // because it is still convenient for developers and demo'ers to use simple URLs.
  // Those cases can be handled by having the code automatically add the defaults
  // to the URL before this point.
  if (appMode !== "authed" || (urlParams.unit && urlParams.problem)) {
    const unitId = urlParams.unit || stores.curriculumConfig.defaultUnit;
    const problemOrdinal = urlParams.problem || appConfigSnapshot.config.defaultProblemOrdinal;

    // Run loadUnitAndProblem asynchronously. The bulk of the initialization code can continue
    // while that unit information is loaded, including getting the persistentUI loaded as
    // soon as possible so we only render what we need.
    // Code that requires the unit and problem to be loaded should wait on `stores.unitLoadedPromise`
    // This promise will resolve when the problem has been loaded.
    stores.loadUnitAndProblem(unitId, problemOrdinal);
  }

  gImageMap.initialize(stores.db);

  if (kEnableLivelinessChecking) {
    setLivelinessChecking("error");
  }

  if (authoring) {
    // Make the user a teacher and show solution tiles
    stores.user.setType("teacher");
    stores.persistentUI.toggleShowTeacherContent(true);
  }

  return stores;
};

const queryClient = new QueryClient();

interface IAppProviderProps {
  children: any;
  stores: IStores;
  modalAppElement: string;
}

export const AppProvider = ({ children, stores, modalAppElement }: IAppProviderProps) => {
  // react-modal needs to know the root element to hide it for accessibility when
  // the modal is visible. The modalAppElement is a css selector for this root element.
  // Typically this is the element that is passed to ReactDOM.render().
  useEffect(() => Modal.setAppElement(modalAppElement), [modalAppElement]);

  // We use the ModalProvider from react-modal-hook to place modals at the top of
  // the React component tree to minimize the potential that events propagating
  // up the tree from modal dialogs will interact adversely with other content.
  // cf. https://github.com/reactjs/react-modal/issues/699#issuecomment-496685847
  return (
    <ModalProvider>
      <QueryClientProvider client={queryClient}>
        <AppConfigContext.Provider value={{ appIcons }} >
          <Provider stores={stores}>
            {children}
          </Provider>
        </AppConfigContext.Provider>
      </QueryClientProvider>
    </ModalProvider>
  );
};
