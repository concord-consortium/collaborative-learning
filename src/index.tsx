import React from "react";
import { createRoot } from "react-dom/client";

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

  const root = createRoot(document.getElementById("app")!);
  root.render(
    <AppProvider stores={stores} modalAppElement="#app">
      <AppComponent />
    </AppProvider>
  );
  removeLoadingMessage("Initializing");
}
