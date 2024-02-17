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
import { UserModel } from "./models/stores/user";
import { urlParams } from "./utilities/url-params";
import { getBearerToken } from "./utilities/auth-utils";
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
export const initializeApp = async (appMode: AppMode, authoring?: boolean): Promise<IStores> => {
  const appVersion = PackageJson.version;

  const user = UserModel.create();

  const showDemoCreator = urlParams.demo;
  const demoName = urlParams.demoName;

  const isPreviewing = !!(urlParams.domain && urlParams.domain_uid && !getBearerToken(urlParams));
  const appConfig = AppConfigModel.create(appConfigSnapshot);
  const stores = createStores({ appMode, appVersion, appConfig, user, showDemoCreator, demoName, isPreviewing });

  if (DEBUG_STORES) {
    (window as any).stores = stores;
  }


  // Only load the unit here if we have a unit param or we are not launched from the portal.
  // If we are launched from the portal and we don't have a unit param, then the unit
  // will be figured out later on.

  // FIXME: since we are now only using the default unit if we are not launched from the portal.
  // It is possible there are some portal links for students that don't include a unit
  // so this change would break these resources.
  // TODO: A better approach than this would be to never use a default unit
  // Then this check would just look at the unit param.
  if (urlParams.unit || appMode !== "authed") {
    const unitId = urlParams.unit || appConfigSnapshot.defaultUnit;
    const problemOrdinal = urlParams.problem || appConfigSnapshot.config.defaultProblemOrdinal;

    // Start setUnitAndProblem asynchronously. The bulk of the initialization code can continue
    // while that unit information is loaded, including getting the persistentUI loaded as
    // soon as possible so we only render what we need.
    // Code that requires the unit and problem to be loaded should wait on `stores.problemLoadedPromise`
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
