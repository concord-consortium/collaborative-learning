import React from "react";
import { createRoot } from "react-dom/client";

import { AppProvider, initializeApp } from "./initialize-app";
import { AppComponent } from "./components/app";
import { removeLoadingMessage, showLoadingMessage } from "./utilities/loading-utils";
import { initializeAuthorization } from "./utilities/auth-utils";

removeLoadingMessage("Loading the application");
showLoadingMessage("Initializing");

const {redirectingToAuthDomain, authDomain} = initializeAuthorization({standAlone: true});
if (!redirectingToAuthDomain) {
  const stores = initializeApp({standalone: true, authDomain});

  const root = createRoot(document.getElementById("app")!);
  root.render(
    <AppProvider stores={stores} modalAppElement="#app">
      <AppComponent />
    </AppProvider>
  );

  removeLoadingMessage("Initializing");
}
