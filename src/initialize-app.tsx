import "ts-polyfill";

import React, { useEffect } from "react";
import { Provider } from "mobx-react";
import { setLivelinessChecking } from "mobx-state-tree";
import Modal from "react-modal";
import { ModalProvider } from "@concord-consortium/react-modal-hook";
import { QueryClient, QueryClientProvider } from "react-query";

import { AppMode } from "./models/stores/store-types";
import { Logger } from "./lib/logger";
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

export const appConfig = AppConfigModel.create(appConfigSnapshot);

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

  const unitId = urlParams.unit || appConfigSnapshot.defaultUnit;
  const problemOrdinal = urlParams.problem || appConfigSnapshot.config.defaultProblemOrdinal;
  const showDemoCreator = urlParams.demo;
  const demoName = urlParams.demoName;

  const isPreviewing = !!(urlParams.domain && urlParams.domain_uid && !getBearerToken(urlParams));
  const stores = createStores({ appMode, appVersion, appConfig, user, showDemoCreator, demoName, isPreviewing });

  if (DEBUG_STORES) {
    (window as any).stores = stores;
  }

  await stores.setUnitAndProblem(unitId, problemOrdinal);

  gImageMap.initialize(stores.db);

  if (kEnableLivelinessChecking) {
    setLivelinessChecking("error");
  }

  // The logger will only be enabled if the appMode is "authed", or DEBUG_LOGGER is true
  Logger.initializeLogger(stores, { investigation: stores.investigation.title, problem: stores.problem.title });

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
