import React from "react";
import ReactDOM from "react-dom";
import { DocEditorApp } from "./components/doc-editor-app";
import { DialogComponent } from "./components/utilities/dialog";
import { urlParams } from "./utilities/url-params";

import { appConfig, AppProvider, initializeApp } from "./initialize-app";

(window as any).DISABLE_FIREBASE_SYNC = true;

initializeApp(urlParams.appMode || "dev", true)
  // Need wait for the unit to be loaded to safely render the components
  .then((stores) => stores.unitLoadedPromise
    .then(() => {
      ReactDOM.render(
        <AppProvider stores={stores} modalAppElement="#app">
          <DocEditorApp appConfig={appConfig}/>
          <DialogComponent/>
        </AppProvider>,
        document.getElementById("app")
      );
    })
  );
