import React from "react";
import ReactDOM from "react-dom";

import { AppProvider, initializeApp } from "./initialize-app";
import { AppComponent } from "./components/app";
import { removeLoadingMessage, showLoadingMessage } from "./utilities/loading-utils";

removeLoadingMessage("Loading the application");
showLoadingMessage("Initializing");

const stores = initializeApp(false);
stores.ui.setStandalone(true);
stores.user.setWaitingForStandaloneAuth(true);

ReactDOM.render(
  <AppProvider stores={stores} modalAppElement="#app">
    <AppComponent />
  </AppProvider>,
  document.getElementById("app")
);

removeLoadingMessage("Initializing");
