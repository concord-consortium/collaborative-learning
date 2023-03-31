import React from "react";
import ReactDOM from "react-dom";
import { DocEditorApp } from "./components/doc-editor-app";

import { appConfig, AppProvider, initializeApp } from "./initialize-app";

(window as any).DISABLE_FIREBASE_SYNC = true;

initializeApp("dev", true).then((stores) => {
  ReactDOM.render(
    <AppProvider stores={stores} modalAppElement="#app">
      <DocEditorApp appConfig={appConfig}/>
    </AppProvider>,
    document.getElementById("app")
  );
});
