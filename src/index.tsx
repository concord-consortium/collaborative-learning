import { Provider } from "mobx-react";
import React from "react";
import ReactDOM from "react-dom";
import { appConfigSpec, createStores } from "./app-config";
import { AppComponent } from "./components/app";
import { AppConfigModel } from "./models/stores/app-config-model";
import { UserModel } from "./models/stores/user";
import { setUnitAndProblem } from "./models/curriculum/unit";
import { urlParams } from "./utilities/url-params";
import { getAppMode } from "./lib/auth";
import { Logger } from "./lib/logger";
import { setPageTitle } from "./lib/misc";
import { gImageMap } from "./models/image-map";
import PackageJson from "../package.json";
import { setLivelynessChecking } from "mobx-state-tree";
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
    setLivelynessChecking("error");
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
    <Provider stores={stores}>
      <AppComponent />
    </Provider>,
    document.getElementById("app")
  );
};

initializeApp();
