import React from "react";
import ReactDOM from "react-dom";

import { AppProvider, initializeApp } from "./initialize-app";
import { AppComponent } from "./components/app";
import { getAppMode } from "./lib/auth";
import { urlParams } from "./utilities/url-params";
import { QAClear } from "./components/qa-clear";
import { setPageTitle } from "./lib/misc";

const host = window.location.host.split(":")[0];
const appMode = getAppMode(urlParams.appMode, urlParams.token, host);

if (appMode === "qa" && urlParams.qaClear === "all") {
  ReactDOM.render(
    <QAClear />,
    document.getElementById("app")
  );
} else {
  initializeApp(appMode).then((stores) => {
    setPageTitle(stores);
    stores.persistentUi.setShowDemoCreator(!!stores.showDemoCreator);
    stores.supports.createFromUnit({
      unit: stores.unit,
      investigation: stores.investigation,
      problem: stores.problem,
      documents: stores.documents,
      db: stores.db
    });

    ReactDOM.render(
      <AppProvider stores={stores} modalAppElement="#app">
        <AppComponent />
      </AppProvider>,
      document.getElementById("app")
    );
  });
}
