import { Provider } from "mobx-react";
import { destroy, getSnapshot } from "mobx-state-tree";
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

const stores: IAllStores = {
  devMode,

  user: UserModel.create({
    authenticated: devMode,
    name: devMode ? "Jane Q. Developer" : null,
  }),

  problem: ProblemModel.create({
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
  }),

  ui: UIModel.create({
    learningLogExpanded: false,
    leftNavExpanded: false,
    myWorkExpanded: false,
  }),
};

const renderApp = () => {
  ReactDOM.render(
    <Provider devMode={devMode} user={stores.user} problem={stores.problem} ui={stores.ui}>
      <AppComponent />
    </Provider>,
    document.getElementById("app"),
  );
};

renderApp();

if (devMode) {
  debugger;
  const hot = (module as any).hot;
  if (hot) {
    hot.accept();
    /*
    hot.accept(["./src/components/app.tsx"], () => {
      debugger;
      renderApp();
    });

    hot.accept(["./models/problem", "./models/ui", "./models/user"], () => {
      debugger;
      const snapshots = {
        problem: getSnapshot(stores.problem),
        ui: getSnapshot(stores.ui),
        user: getSnapshot(stores.user),
      };

      destroy(stores.problem);
      destroy(stores.ui);
      destroy(stores.user);

      stores.problem = ProblemModel.create(snapshots.problem);
      stores.ui = UIModel.create(snapshots.ui);
      stores.user = UserModel.create(snapshots.user);

      renderApp();
    });
    */
  }
}
