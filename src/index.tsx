import { Provider } from "mobx-react";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { appConfigSpec, createStores } from "./app-config";
import { AppComponent } from "./components/app";
import { AppConfigModel } from "./models/stores/app-config-model";
import { UserModel } from "./models/stores/user";
import { createFromJson } from "./models/curriculum/unit";
import { urlParams, DefaultProblemOrdinal } from "./utilities/url-params";
import { getAppMode } from "./lib/auth";
import { Logger } from "./lib/logger";
import { setPageTitle } from "./lib/misc";
import { gImageMap } from "./models/image-map";
import * as PackageJson from "../package.json";
import { setLivelynessChecking } from "mobx-state-tree";
// set to true to enable MST liveliness checking
const kEnableLivelinessChecking = false;

import "./components/utilities/blueprint";
import "./index.sass";

const appConfig = AppConfigModel.create(appConfigSpec);

function getUnitJson() {
  const unitUrlParam = urlParams.unit && appConfig.units.get(urlParams.unit);
  const urlParam = unitUrlParam || appConfig.defaultUnit && appConfig.units.get(appConfig.defaultUnit);
  return fetch(urlParam!)
          .then(response => {
            if (response.ok) {
              return response.json();
            }
            else {
              throw Error(`Request rejected with status ${response.status}`);
            }
          })
          .catch(error => {
            throw Error(`Request rejected with exception`);
          });
}

const initializeApp = async () => {
  const host = window.location.host.split(":")[0];
  const appMode = getAppMode(urlParams.appMode, urlParams.token, host);
  const appVersion = PackageJson.version;

  const user = UserModel.create();

  const unitJson = await getUnitJson();
  const unit = createFromJson(unitJson);
  const problemOrdinal = urlParams.problem || DefaultProblemOrdinal;
  const {investigation, problem} = unit.getProblem(problemOrdinal) ||
                                   unit.getProblem(DefaultProblemOrdinal);
  const showDemoCreator = urlParams.demo;
  const stores = createStores({ appMode, appVersion, appConfig, user, problem, showDemoCreator, unit, investigation });
  stores.documents.setUnit(stores.unit);

  gImageMap.initialize(stores.db, user.id);

  Logger.initializeLogger(stores, investigation, problem);

  if (kEnableLivelinessChecking) {
    setLivelynessChecking("error");
  }

  setPageTitle(stores);
  stores.ui.setShowDemoCreator(!!showDemoCreator);

  stores.supports.createFromUnit({unit, investigation, problem, documents: stores.documents});

  ReactDOM.render(
    <Provider stores={stores}>
      <AppComponent />
    </Provider>,
    document.getElementById("app")
  );
};

initializeApp();
