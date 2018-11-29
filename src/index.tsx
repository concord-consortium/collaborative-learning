import { Provider } from "mobx-react";
import * as React from "react";
import * as ReactDOM from "react-dom";

import { AppComponent } from "./components/app";
import { createStores } from "./models/stores";
import { UserModel } from "./models/user";
import { createFromJson } from "./models/curriculum/unit";
import * as curriculumJson from "./curriculum/stretching-and-shrinking/stretching-and-shrinking.json";
import { urlParams, DefaultProblemOrdinal } from "./utilities/url-params";
import { getAppMode } from "./lib/auth";
import { Logger } from "./lib/logger";
import { setTitle } from "./lib/misc";
import { gImageMap } from "./models/image-map";
import { setLivelynessChecking } from "mobx-state-tree";
// set to true to enable MST liveliness checking
const kEnableLivelinessChecking = false;

import "./index.sass";

const host = window.location.host.split(":")[0];
const appMode = getAppMode(urlParams.appMode, urlParams.token, host);

const user = UserModel.create();

const unit = createFromJson(curriculumJson);
const problemOrdinal = urlParams.problem || DefaultProblemOrdinal;
const {investigation, problem} = unit.getProblem(problemOrdinal) ||
                                 unit.getProblem(DefaultProblemOrdinal);
const showDemoCreator = urlParams.demo;
const stores = createStores({ appMode, user, problem, showDemoCreator, unit });
gImageMap.initialize(stores.db, user.id);

Logger.initializeLogger(stores, investigation, problem);

if (kEnableLivelinessChecking) {
  setLivelynessChecking("error");
}

setTitle(showDemoCreator, problem);
stores.ui.setShowDemoCreator(!!showDemoCreator);

stores.supports.createFromUnit(unit, investigation, problem);

ReactDOM.render(
  <Provider stores={stores}>
    <AppComponent />
  </Provider>,
  document.getElementById("app")
);
