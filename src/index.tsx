import { Provider } from "mobx-react";
import * as React from "react";
import * as ReactDOM from "react-dom";

import { AppComponent } from "./components/app";
import { ProblemModel, ProblemModelType, ProblemSectionModel } from "./models/problem";
import { UIModel, UIModelType } from "./models/ui";
import { UserModel, UserModelType } from "./models/user";

import "./index.sass";

// import this type into other components when using @inject
export interface IAllStores {
  devMode: boolean;
  ui: UIModelType;
  user: UserModelType;
  problem: ProblemModelType;
}

const host = window.location.host.split(":")[0];
const devMode = (host === "localhost") || (host === "127.0.0.1");

const user = UserModel.create({
  authenticated: devMode,
  name: devMode ? "Jane Q. Developer" : null,
});

const problem = ProblemModel.create({
  name: "Sample Problem",
  sections: [
    {
      name: "Introduction",
      shortName: "In",
    },
    {
      name: "Initial Challenge",
      shortName: "IC",
    },
    {
      name: "What If...?",
      shortName: "W?",
    },
    {
      name: "Now What Do You Know?",
      shortName: "N?",
    },
  ],
});

const ui = UIModel.create({
  learningLogExpanded: false,
  leftNavExpanded: false,
  myWorkExpanded: false,
});

ReactDOM.render(
  <Provider devMode={devMode} user={user} problem={problem} ui={ui}>
    <AppComponent />
  </Provider>,
  document.getElementById("app"),
);
