import { Provider } from "mobx-react";
import * as React from "react";
import * as ReactDOM from "react-dom";

import { AppComponent } from "./components/app";
import { createStores } from "./models/stores";
import { UserModel } from "./models/user";
import { createFromJson } from "./models/curriculum/unit";
import * as curriculumJson from "./curriculum/stretching-and-shrinking.json";
import { urlParams } from "./utilities/url-params";
import { getAppMode } from "./lib/auth";

import "./index.sass";

const host = window.location.host.split(":")[0];
const appMode = getAppMode(urlParams.appMode, urlParams.token, host);

const user = UserModel.create();

const curriculumUnit = createFromJson(curriculumJson);
const defaultProblemOrdinal = "2.1";
const problemOrdinal = urlParams.problem || defaultProblemOrdinal;
const problem = curriculumUnit.getProblem(problemOrdinal) ||
                curriculumUnit.getProblem(defaultProblemOrdinal);

const stores = createStores({ appMode, user, problem });

if (problem) {
  document.title = `CLUE: ${problem.fullTitle}`;
  stores.ui.setActiveSection(problem.sections[0]);
}

ReactDOM.render(
  <Provider stores={stores}>
    <AppComponent />
  </Provider>,
  document.getElementById("app")
);
