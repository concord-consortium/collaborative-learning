import React from "react";
import ReactDOM from "react-dom";

import { AppProvider, initializeApp } from "./initialize-app";
import { AppComponent } from "./components/app";
import { initializeAuthorization } from "./utilities/auth-utils";
import { removeLoadingMessage, showLoadingMessage } from "./utilities/loading-utils";

removeLoadingMessage("Loading the application");
showLoadingMessage("Initializing");

const {redirectingToAuthDomain} = initializeAuthorization();
if (!redirectingToAuthDomain) {
  const stores = initializeApp();
  stores.ui.setShowDemoCreator(!!stores.showDemoCreator);

  ReactDOM.render(
    <AppProvider stores={stores} modalAppElement="#app">
      <AppComponent />
    </AppProvider>,
    document.getElementById("app")
  );
  removeLoadingMessage("Initializing");
}
