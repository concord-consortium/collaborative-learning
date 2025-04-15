import React from "react";
import ReactDOM from "react-dom";

import { AppProvider, initializeApp } from "./initialize-app";
import { AppComponent } from "./components/app";
import { removeLoadingMessage, showLoadingMessage } from "./utilities/loading-utils";
import { initializeAuthorization } from "./utilities/auth-utils";

removeLoadingMessage("Loading the application");
showLoadingMessage("Initializing");

const {redirectingToAuthDomain, authDomain} = initializeAuthorization({standAlone: true});
if (!redirectingToAuthDomain) {
  const stores = initializeApp({standalone: true, authDomain});

  ReactDOM.render(
    <AppProvider stores={stores} modalAppElement="#app">
      <AppComponent />
    </AppProvider>,
    document.getElementById("app")
  );

  removeLoadingMessage("Initializing");
}
