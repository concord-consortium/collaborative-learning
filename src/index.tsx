import React from "react";
import ReactDOM from "react-dom";

import { AppProvider, initializeApp } from "./initialize-app";
import { AppComponent } from "./components/app";
import { getAppMode } from "./lib/auth";
import { urlParams } from "./utilities/url-params";
import { QAClear } from "./components/qa-clear";
import { setPageTitle } from "./lib/misc";
import { getBearerToken, initializeAuthorization } from "./utilities/auth-utils";
import { removeLoadingMessage, showLoadingMessage } from "./utilities/loading-utils";

removeLoadingMessage("Loading the application");
showLoadingMessage("Initializing");

const redirectingToAuthDomain = initializeAuthorization();
if (!redirectingToAuthDomain) {
  const host = window.location.host.split(":")[0];
  const appMode = getAppMode(urlParams.appMode, getBearerToken(urlParams), host);

  if (appMode === "qa" && urlParams.qaClear === "all") {
    ReactDOM.render(
      <QAClear />,
      document.getElementById("app")
    );
  } else {
    initializeApp(appMode).then((stores) => {
      stores.unitLoadedPromise.then(() => setPageTitle(stores));
      stores.ui.setShowDemoCreator(!!stores.showDemoCreator);
      // I think supports are not used so we can get rid of this
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
      removeLoadingMessage("Initializing");
    });
  }
}
