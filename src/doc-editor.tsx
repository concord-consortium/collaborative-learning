import React from "react";
import ReactDOM from "react-dom";
import { DocEditorApp } from "./components/doc-editor-app";
import { DialogComponent } from "./components/utilities/dialog";
import { urlParams } from "./utilities/url-params";

import { appConfig, AppProvider, initializeApp } from "./initialize-app";

(window as any).DISABLE_FIREBASE_SYNC = true;

initializeApp(urlParams.appMode || "dev", true).then((stores) => {
  ReactDOM.render(
    <AppProvider stores={stores} modalAppElement="#app">
      <DocEditorApp appConfig={appConfig}/>
      <DialogComponent dialog={stores.ui.dialog} />
    </AppProvider>,
    document.getElementById("app")
  );
});
