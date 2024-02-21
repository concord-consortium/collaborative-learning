import React from "react";
import ReactDOM from "react-dom";
import { DocEditorApp } from "./components/doc-editor-app";
import { DialogComponent } from "./components/utilities/dialog";
import { urlParams } from "./utilities/url-params";

import { AppProvider, initializeApp } from "./initialize-app";

(window as any).DISABLE_FIREBASE_SYNC = true;

const stores = initializeApp(urlParams.appMode || "dev", true);

// Need wait for the unit to be loaded to safely render the components
stores.unitLoadedPromise.then(() => {
  ReactDOM.render(
    <AppProvider stores={stores} modalAppElement="#app">
      <DocEditorApp/>
      <DialogComponent/>
    </AppProvider>,
    document.getElementById("app")
  );
});
