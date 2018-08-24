import { Provider } from "mobx-react";
import * as React from "react";
import * as ReactDOM from "react-dom";

import { AppComponent } from "./components/app";
import { ProblemModel } from "./models/problem";
import { UserModel } from "./models/user";

import "./index.sass";

const host = window.location.host.split(":")[0];
const devMode = (host === "localhost") || (host === "127.0.0.1");

const user = UserModel.create({
  authenticated: devMode,
  name: devMode ? "Developer Mode" : null,
});

const problem = ProblemModel.create({
  name: "Sample Problem",
});

ReactDOM.render(
  <Provider devMode={devMode} user={user} problem={problem}>
    <AppComponent />
  </Provider>,
  document.getElementById("app"),
);
