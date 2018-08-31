import { Provider } from "mobx-react";
import * as React from "react";
import * as ReactDOM from "react-dom";

import { AppComponent } from "./components/app";
import { createStores } from "./models/stores";
import { UserModel } from "./models/user";
import { createFromJson } from "./models/curriculum";
import * as curriculumJson from "./curriculum/stretching-and-shrinking.json";
import { urlParams } from "./utilities/url-params";

import "./index.sass";

const host = window.location.host.split(":")[0];
// An explicitly set devMode takes priority
// Otherwise, assume that local users are devs, unless a token is specified,
// in which authentication is likely being tested
const devMode = urlParams.devMode != null
                  ? (urlParams.devMode === "true") || (urlParams.devMode === "1")
                  : urlParams.token == null && (
                      (host === "localhost") || (host === "127.0.0.1")
                    );

const user = UserModel.create();

const curriculumUnit = createFromJson(curriculumJson);
const defaultProblemOrdinal = "2.1";
const problemOrdinal = urlParams.problem || defaultProblemOrdinal;
const problem = curriculumUnit.getProblem(problemOrdinal) ||
                curriculumUnit.getProblem(defaultProblemOrdinal);

const stores = createStores({ devMode, user, problem });

ReactDOM.render(
  <Provider stores={stores}>
    <AppComponent />
  </Provider>,
  document.getElementById("app")
);
