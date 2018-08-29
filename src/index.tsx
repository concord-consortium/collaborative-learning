import { Provider } from "mobx-react";
import * as queryString from "query-string";
import * as React from "react";
import * as ReactDOM from "react-dom";

import { AppComponent } from "./components/app";
import { ProblemModelType } from "./models/problem";
import { UIModel, UIModelType } from "./models/ui";
import { UserModel, UserModelType } from "./models/user";
import { createFromJson } from "./models/curriculum";
import * as curriculumJson from "./curriculum/stretching-and-shrinking.json";
import { urlParams } from "./utilities/url-params";

import "./index.sass";

// import this type into other components when using @inject
export interface IAllStores {
  devMode: boolean;
  ui: UIModelType;
  user: UserModelType;
  problem: ProblemModelType;
}

const host = window.location.host.split(":")[0];
const urlParams = queryString.parse(window.location.search);
// An explicitly set devMode takes priority
// Otherwise, assume that local users are devs, unless a token is specified,
// in which authentication is likely being tested
const devMode = urlParams.devMode !== undefined
                  ? urlParams.devMode === "true"
                  : queryString.parse(window.location.search).token === undefined && (
                      (host === "localhost") ||
                      (host === "127.0.0.1")
                    );

const user = UserModel.create();

const curriculumUnit = createFromJson(curriculumJson);
const defaultProblemOrdinal = "2.1";
const problemOrdinal = urlParams.problem || defaultProblemOrdinal;
const problem = curriculumUnit.getProblem(problemOrdinal) ||
                curriculumUnit.getProblem(defaultProblemOrdinal);

const ui = UIModel.create({
  learningLogExpanded: false,
  leftNavExpanded: false,
  myWorkExpanded: false,
});

ReactDOM.render(
  <Provider devMode={devMode} user={user} problem={problem} ui={ui}>
    <AppComponent />
  </Provider>,
  document.getElementById("app")
);
