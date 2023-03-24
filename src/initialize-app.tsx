import "ts-polyfill";

import React from "react";
import { Provider } from "mobx-react";
import { QueryClient, QueryClientProvider } from "react-query";
import { setLivelinessChecking } from "mobx-state-tree";
import { ModalProvider } from "@concord-consortium/react-modal-hook";

import { appConfigSnapshot, appIcons, createStores } from "./app-config";
import { AppConfigContext } from "./app-config-context";
import { DocEditorApp, IDocEditorAppProps } from "./components/doc-editor-app";
import { AppConfigModel } from "./models/stores/app-config-model";
import { IStores, setUnitAndProblem } from "./models/stores/stores";
import { UserModel } from "./models/stores/user";
import { urlParams } from "./utilities/url-params";
import { getAppMode } from "./lib/auth";
import { DEBUG_STORES } from "./lib/debug";
import { Logger } from "./lib/logger";
import { setPageTitle } from "./lib/misc";
import { gImageMap } from "./models/image-map";
import PackageJson from "./../package.json";

import "./index.scss";

// set to true to enable MST liveliness checking
const kEnableLivelinessChecking = false;

(window as any).DISABLE_FIREBASE_SYNC = true;

const appConfig = AppConfigModel.create(appConfigSnapshot);

export interface IAppProperties {
  queryClient: QueryClient;
  stores: IStores;
}
export const initializeApp = async () => {
  const host = window.location.host.split(":")[0];
  const appMode = getAppMode(urlParams.appMode, urlParams.token, host);
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

  // TODO: It'd be better to have another way to do this since we are just editing a document.
  // However we do want to support configuring which tools to use based on a unit and problem.
  // So for the time being this approach lets us do that via url parameters.
  await setUnitAndProblem(stores, unitId, problemOrdinal);

  gImageMap.initialize(stores.db);

  Logger.initializeLogger(stores, { investigation: stores.investigation.title, problem: stores.problem.title });

  if (kEnableLivelinessChecking) {
    setLivelinessChecking("error");
  }

  setPageTitle(stores);
  stores.ui.setShowDemoCreator(!!showDemoCreator);
  stores.supports.createFromUnit({
    unit: stores.unit,
    investigation: stores.investigation,
    problem: stores.problem,
    documents: stores.documents,
    db: stores.db
  });

  const queryClient = new QueryClient();

  return { queryClient, stores };
};

interface IAppProviderProps {
  children: any;
  stores: IStores;
}
export const AppProvider = ({ children, stores }: IAppProviderProps) => {
  return (
    <AppConfigContext.Provider value={{ appIcons }} >
      <Provider stores={stores}>
        {children}
      </Provider>
    </AppConfigContext.Provider>
  );
};

interface IEditorAppProps {
  docEditorAppProps?: Partial<IDocEditorAppProps>;
  queryClient: QueryClient;
  stores: IStores;
}
export const EditorApp = ({ docEditorAppProps, queryClient, stores }: IEditorAppProps) => {
  return (
    <AppProvider stores={stores}>
      <ModalProvider>
        <QueryClientProvider client={queryClient}>
          <DocEditorApp
            { ...docEditorAppProps }
            appConfig={appConfig}
          />
        </QueryClientProvider>
      </ModalProvider>
    </AppProvider>
  );
};
