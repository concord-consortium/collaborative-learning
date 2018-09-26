import { Provider } from "mobx-react";
import * as React from "react";
import * as ReactDOM from "react-dom";

import { AppComponent } from "./components/app";
import { createStores } from "./models/stores";
import { UserModel } from "./models/user";
import { createFromJson } from "./models/curriculum/unit";
import * as curriculumJson from "./curriculum/stretching-and-shrinking/stretching-and-shrinking.json";
import { urlParams } from "./utilities/url-params";
import { getAppMode } from "./lib/auth";

import "./index.sass";

const host = window.location.host.split(":")[0];
const appMode = getAppMode(urlParams.appMode, urlParams.token, host);

const user = UserModel.create();

const unit = createFromJson(curriculumJson);
const defaultProblemOrdinal = "2.1";
const problemOrdinal = urlParams.problem || defaultProblemOrdinal;
const {investigation, problem} = unit.getProblem(problemOrdinal) ||
                                 unit.getProblem(defaultProblemOrdinal);
const showDemoCreator = urlParams.demo;
const stores = createStores({ appMode, user, problem, showDemoCreator, unit });

document.title = showDemoCreator ? `CLUE: Demo Creator` : (problem ? `CLUE: ${problem.fullTitle}` : document.title);
stores.ui.setShowDemoCreator(!!showDemoCreator);

stores.supports.createFromUnit(unit, investigation, problem);

ReactDOM.render(
  <Provider stores={stores}>
    <AppComponent />
  </Provider>,
  document.getElementById("app")
);
