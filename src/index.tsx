import "ts-polyfill";
import "regenerator-runtime/runtime";

import { Provider } from "mobx-react";
import React from "react";
import ReactDOM from "react-dom";
import { appConfigSpec, appIcons, createStores } from "./app-config";
import { AppConfigContext } from "./app-config-context";
import { AppComponent } from "./components/app";
import { AppConfigModel } from "./models/stores/app-config-model";
import { setUnitAndProblem } from "./models/stores/stores";
import { UserModel } from "./models/stores/user";
import { urlParams } from "./utilities/url-params";
import { getAppMode } from "./lib/auth";
import { Logger } from "./lib/logger";
import { setPageTitle } from "./lib/misc";
import { gImageMap } from "./models/image-map";
import PackageJson from "../package.json";
import { setLivelinessChecking } from "mobx-state-tree";
// set to true to enable MST liveliness checking
const kEnableLivelinessChecking = false;

import "./components/utilities/blueprint";
import "./index.sass";

const appConfig = AppConfigModel.create(appConfigSpec);

const initializeApp = async () => {
  const host = window.location.host.split(":")[0];
  const appMode = getAppMode(urlParams.appMode, urlParams.token, host);
  const appVersion = PackageJson.version;

  const user = UserModel.create();

  const unitId = urlParams.unit || appConfigSpec.defaultUnit;
  const problemOrdinal = urlParams.problem || appConfigSpec.defaultProblemOrdinal;
  const showDemoCreator = urlParams.demo;
  const demoName = urlParams.demoName;

  const stores = createStores({ appMode, appVersion, appConfig, user, showDemoCreator, demoName });

  await setUnitAndProblem(stores, unitId, problemOrdinal);

  gImageMap.initialize(stores.db, user.id);

  Logger.initializeLogger(stores, stores.investigation, stores.problem);

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

  ReactDOM.render(
    <AppConfigContext.Provider value={{ appIcons }} >
      <Provider stores={stores}>
        <AppComponent />
      </Provider>
    </AppConfigContext.Provider>,
    document.getElementById("app")
  );
};

initializeApp();
