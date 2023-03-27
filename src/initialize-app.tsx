import "ts-polyfill";

import React from "react";
import { Provider } from "mobx-react";
import { setLivelinessChecking } from "mobx-state-tree";

import { appConfigSnapshot, appIcons, createStores } from "./app-config";
import { AppConfigContext } from "./app-config-context";
import { AppConfigModel } from "./models/stores/app-config-model";
import { IStores, setUnitAndProblem } from "./models/stores/stores";
import { UserModel } from "./models/stores/user";
import { urlParams } from "./utilities/url-params";
import { DEBUG_STORES } from "./lib/debug";
import { gImageMap } from "./models/image-map";
import PackageJson from "./../package.json";

import "./index.scss";
import { AppMode } from "./models/stores/store-types";
import { ModalProvider } from "@concord-consortium/react-modal-hook";
import { QueryClient, QueryClientProvider } from "react-query";
import { Logger } from "./lib/logger";

// set to true to enable MST liveliness checking
const kEnableLivelinessChecking = false;

export const appConfig = AppConfigModel.create(appConfigSnapshot);

// TODO: we might as well just return
// stores instead of an object container stores
export interface IAppProperties {
  stores: IStores;
}

/**
 * This function is used by the 3 different entry points supported
 * by CLUE:
 * - runtime (index.tsx)
 * - authoring (CMS clue-control.tsx)
 * - standalone doc editor (doc-editor.tsx)
 *
 * It is intended to only be run one time.
 * It is basically an async wrapper around createStores
 *
 * @param appMode
 * @returns
 */
export const initializeApp = async (appMode: AppMode) => {
  const appVersion = PackageJson.version;

  const user = UserModel.create();

  const unitId = urlParams.unit || appConfigSnapshot.defaultUnit;
  const problemOrdinal = urlParams.problem || appConfigSnapshot.config.defaultProblemOrdinal;
  const showDemoCreator = urlParams.demo;
  const demoName = urlParams.demoName;

  const isPreviewing = !!(urlParams.domain && urlParams.domain_uid && !urlParams.token);
  const stores = createStores({ appMode, appVersion, appConfig, user, showDemoCreator, demoName, isPreviewing });

  if (DEBUG_STORES) {
    (window as any).stores = stores;
  }

  await setUnitAndProblem(stores, unitId, problemOrdinal);

  gImageMap.initialize(stores.db);

  if (kEnableLivelinessChecking) {
    setLivelinessChecking("error");
  }

  // The logger will only be enabled if the appMode is "authed", or DEBUG_LOGGER is true
  Logger.initializeLogger(stores, { investigation: stores.investigation.title, problem: stores.problem.title });

  return { stores };
};

const queryClient = new QueryClient();

interface IAppProviderProps {
  children: any;
  stores: IStores;
}

// FIXME: in some cases a warning is printed that the ModalProvider cannot find the
// app in order to disable it and prevent input.
export const AppProvider = ({ children, stores }: IAppProviderProps) => {
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
