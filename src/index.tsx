import { Provider } from "mobx-react";
import * as React from "react";
import * as ReactDOM from "react-dom";

import { AppComponent } from "./components/app";
import { createStores } from "./models/stores/stores";
import { UserModel } from "./models/stores/user";
import { createFromJson } from "./models/curriculum/unit";
import * as dataflowUnit from "./curriculum/dataflow/dataflow.json";
import * as movingStraightAheadUnit from "./curriculum/moving-straight-ahead/moving-straight-ahead.json";
import * as stretchingAndShrinkingUnit from "./curriculum/stretching-and-shrinking/stretching-and-shrinking.json";
import { urlParams, DefaultProblemOrdinal } from "./utilities/url-params";
import { getAppMode } from "./lib/auth";
import { Logger } from "./lib/logger";
import { setTitle } from "./lib/misc";
import { gImageMap } from "./models/image-map";
import * as PackageJson from "../package.json";
import { setLivelynessChecking } from "mobx-state-tree";
// set to true to enable MST liveliness checking
const kEnableLivelinessChecking = false;

import "./components/utilities/blueprint";
import "./index.sass";

function getCurriculumJson() {
  const unitMap: { [code: string]: any } = [];
  let defaultUnit;
  [dataflowUnit, movingStraightAheadUnit, stretchingAndShrinkingUnit]
    .forEach(_unit => {
      if (_unit && _unit.code) {
        unitMap[_unit.code] = _unit;
      }
      // last unit becomes default if no unit param is specified
      defaultUnit = _unit;
    });
  const unitParam = (urlParams.unit || "").toLowerCase();
  return unitMap[unitParam] || defaultUnit;
}

const host = window.location.host.split(":")[0];
const appMode = getAppMode(urlParams.appMode, urlParams.token, host);
const appVersion = PackageJson.version;

const user = UserModel.create();

const unit = createFromJson(getCurriculumJson());
const problemOrdinal = urlParams.problem || DefaultProblemOrdinal;
const {investigation, problem} = unit.getProblem(problemOrdinal) ||
                                 unit.getProblem(DefaultProblemOrdinal);
const showDemoCreator = urlParams.demo;
const stores = createStores({ appMode, appVersion, user, problem, showDemoCreator, unit });
stores.documents.setUnit(stores.unit);

gImageMap.initialize(stores.db, user.id);

Logger.initializeLogger(stores, investigation, problem);

if (kEnableLivelinessChecking) {
  setLivelynessChecking("error");
}

setTitle(showDemoCreator, unit, problem);
stores.ui.setShowDemoCreator(!!showDemoCreator);

stores.supports.createFromUnit(unit, investigation, problem);

ReactDOM.render(
  <Provider stores={stores}>
    <AppComponent />
  </Provider>,
  document.getElementById("app")
);
