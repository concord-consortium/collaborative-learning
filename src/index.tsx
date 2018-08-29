import { Provider } from "mobx-react";
import * as React from "react";
import * as ReactDOM from "react-dom";

import { AppComponent } from "./components/app";
import { ProblemModel, ProblemModelType } from "./models/problem";
import { SectionType } from "./models/section";
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
const devMode = (window.location.search.indexOf("devMode=true") !== -1) ||
                (host === "localhost") ||
                (host === "127.0.0.1");

const user = UserModel.create({
  authenticated: devMode,
  name: devMode ? "Jane Q. Developer" : null,
});

const problem = ProblemModel.create({
  ordinal: 1,
  title: "Sample Problem",
  sections: [
    { type: SectionType.introduction },
    { type: SectionType.initialChallenge },
    { type: SectionType.whatIf },
    { type: SectionType.nowWhatDoYouKnow }
  ]
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
  document.getElementById("app")
);
